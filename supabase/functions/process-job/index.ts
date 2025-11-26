import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobRecord {
  id: string;
  type: string;
  payload: { supplierOrderId: string };
  status: string;
  attempts: number;
  supplier_order_id?: string;
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let jobId: string | undefined;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const { record } = await req.json();

    if (!record || !record.id) {
      console.error('[EdgeFunction] No record provided');
      throw new Error('No record provided');
    }

    const jobRecord = record as JobRecord;
    jobId = jobRecord.id;
    const supplierOrderId = jobRecord.payload?.supplierOrderId || jobRecord.supplier_order_id;

    console.log(`[EdgeFunction] Processing job ${jobId} for supplier order ${supplierOrderId}`);

    // IDEMPOTENCY CHECK: Verify job hasn't been processed already
    const { data: currentJob, error: jobFetchError } = await supabaseClient
      .from('jobs')
      .select('status, attempts')
      .eq('id', jobId)
      .single();

    if (jobFetchError) {
      console.error(`[EdgeFunction] Job ${jobId} not found:`, jobFetchError);
      throw new Error(`Job not found: ${jobFetchError.message}`);
    }

    // If already completed, return success without reprocessing
    if (currentJob.status === 'completed') {
      console.log(`[EdgeFunction] Job ${jobId} already completed, skipping`);
      return new Response(JSON.stringify({ message: 'Job already completed', jobId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If not pending, skip (might be processing by another instance)
    if (currentJob.status !== 'pending') {
      console.warn(`[EdgeFunction] Job ${jobId} has status ${currentJob.status}, skipping`);
      return new Response(
        JSON.stringify({ message: `Job status is ${currentJob.status}`, jobId }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Mark as processing
    await supabaseClient
      .from('jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // 1. Fetch supplier order and supplier details
    const { data: supplierOrder, error: orderError } = await supabaseClient
      .from('supplier_orders')
      .select('*, suppliers(*)')
      .eq('id', supplierOrderId)
      .single();

    if (orderError || !supplierOrder) {
      console.error(`[EdgeFunction] Order ${supplierOrderId} not found:`, orderError);
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    const supplier = supplierOrder.suppliers;
    if (!supplier || !supplier.email) {
      console.error(`[EdgeFunction] Supplier email not found for order ${supplierOrderId}`);
      // This is a permanent error - mark as failed immediately
      await supabaseClient
        .from('jobs')
        .update({
          status: 'failed',
          last_error: 'Supplier email not found',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      throw new Error('Supplier email not found');
    }

    // 2. Generate Email Content
    const emailHtml = `
      <h1>New Order from PedidosAI</h1>
      <p>Order ID: ${supplierOrder.id}</p>
      <p>Order Number: ${supplierOrder.order_number || 'N/A'}</p>
      <p>Please check the attached details.</p>
      <p>${supplierOrder.message || ''}</p>
    `;

    // 3. Send Email via Resend
    console.log(`[EdgeFunction] Sending email to ${supplier.email}`);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'PedidosAI <orders@pedidosai.com>',
      to: [supplier.email],
      subject: `New Order #${supplierOrder.order_number || supplierOrder.id}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error(`[EdgeFunction] Resend error for job ${jobId}:`, emailError);

      // Determine if error is retriable
      const isRetriable = isRetriableError(emailError);

      if (isRetriable && currentJob.attempts < 2) {
        // Mark as pending for retry
        await supabaseClient
          .from('jobs')
          .update({
            status: 'pending',
            attempts: currentJob.attempts + 1,
            last_error: `Resend error: ${emailError.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
        console.log(
          `[EdgeFunction] Job ${jobId} marked for retry (attempt ${currentJob.attempts + 1})`
        );
      } else {
        // Mark as failed permanently
        await supabaseClient
          .from('jobs')
          .update({
            status: 'failed',
            attempts: currentJob.attempts + 1,
            last_error: `Resend error: ${emailError.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
        console.error(`[EdgeFunction] Job ${jobId} marked as failed permanently`);
      }

      throw new Error(`Resend error: ${emailError.message}`);
    }

    console.log(
      `[EdgeFunction] Email sent successfully for job ${jobId}, email ID: ${emailData?.id}`
    );

    // 4. Update Job Status to completed
    await supabaseClient
      .from('jobs')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // 5. Update Supplier Order Status (for Realtime feedback)
    await supabaseClient
      .from('supplier_orders')
      .update({ status: 'sent' })
      .eq('id', supplierOrderId);

    console.log(`[EdgeFunction] Job ${jobId} completed successfully`);

    return new Response(
      JSON.stringify({
        message: 'Job processed successfully',
        jobId,
        emailId: emailData?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error(`[EdgeFunction] Error processing job ${jobId}:`, error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        jobId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to determine if an error is retriable
function isRetriableError(error: any): boolean {
  // Retriable errors: network issues, rate limits, 5xx errors
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorName = error?.name?.toLowerCase() || '';

  // Check for rate limiting (429)
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return true;
  }

  // Check for server errors (5xx)
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504')
  ) {
    return true;
  }

  // Check for timeout
  if (errorMessage.includes('timeout') || errorName.includes('timeout')) {
    return true;
  }

  // Check for network errors
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return true;
  }

  // Otherwise, treat as permanent error (4xx errors like invalid email, etc.)
  return false;
}
