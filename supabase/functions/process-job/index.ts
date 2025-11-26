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

interface Supplier {
  id: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

interface Organization {
  name: string;
  [key: string]: unknown;
}

interface Order {
  id: string;
  organization?: Organization;
  [key: string]: unknown;
}

interface SupplierOrder {
  id: string;
  order_id: string;
  supplier_id: string;
  order?: Order;
  supplier?: Supplier;
  [key: string]: unknown;
}

interface OrderItem {
  id: string;
  order_id: string;
  supplier_id: string;
  product: string;
  quantity: number;
  unit: string;
  [key: string]: unknown;
}

interface Job {
  id: string;
  status: string;
  attempts: number;
  [key: string]: unknown;
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

    if (jobFetchError || !currentJob) {
      console.error(`[EdgeFunction] Job ${jobId} not found:`, jobFetchError);
      throw new Error(`Job not found: ${jobFetchError?.message}`);
    }

    const job = currentJob as Job;

    // If already completed, return success without reprocessing
    if (job.status === 'completed') {
      console.log(`[EdgeFunction] Job ${jobId} already completed, skipping`);
      return new Response(JSON.stringify({ message: 'Job already completed', jobId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If not pending, skip (might be processing by another instance)
    if (job.status !== 'pending') {
      console.warn(`[EdgeFunction] Job ${jobId} has status ${job.status}, skipping`);
      return new Response(JSON.stringify({ message: `Job status is ${job.status}`, jobId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as processing
    await supabaseClient
      .from('jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // 1. Fetch supplier order with full details
    const { data: supplierOrderData, error: orderError } = await supabaseClient
      .from('supplier_orders')
      .select(
        `
        *,
        order: orders(*, organization: organizations(name)),
        supplier: suppliers(*)
      `
      )
      .eq('id', supplierOrderId)
      .single();

    if (orderError || !supplierOrderData) {
      console.error(`[EdgeFunction] Order ${supplierOrderId} not found:`, orderError);
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    const supplierOrder = supplierOrderData as SupplierOrder;
    const supplier = supplierOrder.supplier;
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

    // 2. Update status to sending
    await supabaseClient
      .from('supplier_orders')
      .update({ status: 'sending' })
      .eq('id', supplierOrderId);

    // 3. Fetch items for this supplier
    const { data: itemsData, error: itemsError } = await supabaseClient
      .from('order_items')
      .select('*')
      .eq('order_id', supplierOrder.order_id)
      .eq('supplier_id', supplierOrder.supplier_id);

    if (itemsError || !itemsData || itemsData.length === 0) {
      console.error(`[EdgeFunction] No items found for supplier order ${supplierOrderId}`);
      throw new Error('No items found for this supplier order');
    }

    const items = itemsData as OrderItem[];

    // 4. Generate Email Content with proper template
    const organizationName = supplierOrder.order?.organization?.name || 'Organización';
    const itemsHtml = items
      .map(
        item => `
        <li style="margin-bottom: 4px;">
          <strong>${item.quantity} ${item.unit}</strong> de ${item.product}
        </li>
      `
      )
      .join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 32px; margin-bottom: 24px;">
            <h1 style="color: #1e40af; margin: 0 0 16px 0; font-size: 24px;">
              Nuevo Pedido
            </h1>
            <p style="margin: 0 0 16px 0;">
              Hola, <strong>${organizationName}</strong> ha realizado un nuevo pedido.
            </p>

            <div style="background-color: white; border-radius: 6px; padding: 16px; border: 1px solid #e2e8f0;">
              <div style="margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
                <h3 style="color: #475569; margin: 0 0 8px 0; font-size: 16px;">${supplier.name}</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${itemsHtml}
                </ul>
              </div>
            </div>

            <p style="margin: 24px 0 0 0; font-size: 14px; color: #64748b;">
              Este es un mensaje automático enviado desde Pedidos AI.
            </p>
          </div>
        </body>
      </html>
    `;

    // 5. Send Email via Resend
    console.log(`[EdgeFunction] Sending email to ${supplier.email}`);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'Pedidos <onboarding@resend.dev>',
      to: [supplier.email],
      subject: `Nuevo pedido de ${organizationName}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error(`[EdgeFunction] Resend error for job ${jobId}:`, emailError);

      // Determine if error is retriable
      const isRetriable = isRetriableError(emailError);

      if (isRetriable && job.attempts < 2) {
        // Mark as pending for retry
        await supabaseClient
          .from('jobs')
          .update({
            status: 'pending',
            attempts: job.attempts + 1,
            last_error: `Resend error: ${emailError.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        // Revert supplier_order status back to pending for retry
        await supabaseClient
          .from('supplier_orders')
          .update({
            status: 'pending',
            error_message: `Rate limit exceeded - will retry (attempt ${job.attempts + 1})`,
          })
          .eq('id', supplierOrderId);

        console.log(`[EdgeFunction] Job ${jobId} marked for retry (attempt ${job.attempts + 1})`);
      } else {
        // Mark as failed permanently
        await supabaseClient
          .from('jobs')
          .update({
            status: 'failed',
            attempts: job.attempts + 1,
            last_error: `Resend error: ${emailError.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        // Mark supplier_order as failed
        await supabaseClient
          .from('supplier_orders')
          .update({
            status: 'failed',
            error_message: `Resend error: ${emailError.message}`,
          })
          .eq('id', supplierOrderId);

        console.error(`[EdgeFunction] Job ${jobId} marked as failed permanently`);
      }

      throw new Error(`Resend error: ${emailError.message}`);
    }

    console.log(
      `[EdgeFunction] Email sent successfully for job ${jobId}, email ID: ${emailData?.id}`
    );

    // 6. Update Job Status to completed
    await supabaseClient
      .from('jobs')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // 7. Update Supplier Order Status (for Realtime feedback)
    await supabaseClient
      .from('supplier_orders')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null,
      })
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
