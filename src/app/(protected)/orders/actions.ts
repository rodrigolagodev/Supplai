'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { parseOrderText } from '@/lib/ai/gemini';
import { ClassifiedItem } from '@/lib/ai/classifier';

/**
 * Create a new draft order
 */
export async function createDraftOrder(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order');
  }

  return order;
}

/**
 * Save a message to the conversation history
 */
export async function saveConversationMessage(
  orderId: string,
  role: 'user' | 'assistant',
  content: string,
  audioFileId?: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check access via order membership
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  const { error } = await supabase.from('order_conversations').insert({
    order_id: orderId,
    role,
    content,
    audio_file_id: audioFileId || null,
  });

  if (error) {
    console.error('Error saving message:', error);
    throw new Error('Failed to save message');
  }
}

/**
 * Save parsed and classified items to the order
 */
export async function saveParsedItems(orderId: string, items: ClassifiedItem[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check access via order membership
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // Prepare items for insertion
  const dbItems = items.map(item => ({
    order_id: orderId,
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
    original_text: item.original_text,
    confidence_score: item.confidence,
    supplier_id: item.supplier_id, // Can be null
  }));

  const { error } = await supabase.from('order_items').insert(dbItems);

  if (error) {
    console.error('Error saving items:', error);
    throw new Error('Failed to save items');
  }

  revalidatePath(`/orders/${orderId}`);
}

/**
 * Process all messages in an order to extract items
 * - Fetches all user messages
 * - Aggregates text
 * - Parses with Gemini
 * - Classifies with Suppliers
 * - Replaces existing items
 */
export async function processOrderBatch(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 1. Get order and verify access
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // 2. Fetch all user messages
  const { data: messages } = await supabase
    .from('order_conversations')
    .select('content')
    .eq('order_id', orderId)
    .eq('role', 'user')
    .order('created_at', { ascending: true });

  if (!messages || messages.length === 0) {
    return { items: [], message: 'No hay mensajes para procesar.' };
  }

  // 3. Aggregate text
  const fullText = messages.map(m => m.content).join('\n\n');

  // 4. Fetch suppliers (needed for intelligent parsing)
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, category, custom_keywords')
    .eq('organization_id', order.organization_id);

  // 5. Parse with Gemini (includes supplier classification)
  const parsedItems = await parseOrderText(fullText, suppliers || []);

  if (parsedItems.length === 0) {
    return { items: [], message: 'No pude identificar productos en la conversación.' };
  }

  // 6. Map ParsedItem to ClassifiedItem format
  // Gemini now returns supplier_id directly, so we just need to ensure the format
  const classifiedItems = parsedItems.map(item => ({
    ...item,
    supplier_id: item.supplier_id || null,
    classification_confidence: item.confidence, // Use Gemini's confidence as classification confidence
  }));

  // 7. Replace existing items (Transaction-like)
  // First delete old items
  await supabase.from('order_items').delete().eq('order_id', orderId);

  // Then save new items
  await saveParsedItems(orderId, classifiedItems);

  // 8. Add assistant summary message
  const itemCount = classifiedItems.length;
  let summary = `He procesado todo el pedido. Encontré ${itemCount} producto${itemCount !== 1 ? 's' : ''}:\n\n`;

  classifiedItems.forEach(item => {
    const supplier = suppliers?.find(s => s.id === item.supplier_id);
    const supplierName = supplier?.name || 'Sin proveedor';
    summary += `- ${item.quantity} ${item.unit} de ${item.product} (${supplierName})\n`;
  });

  await saveConversationMessage(orderId, 'assistant', summary);

  // Return redirect URL instead of redirecting directly to avoid client-side try-catch issues
  return { success: true, redirectUrl: `/orders/${orderId}/review` };
}

/**
 * Get conversation history for an order
 */
export async function getOrderConversation(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check access via order membership
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  const { data, error } = await supabase
    .from('order_conversations')
    .select(
      `
      *,
      audio_file:order_audio_files(*)
    `
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation');
  }

  return data;
}

import { sendOrderEmail } from '@/lib/email/orders';

/**
 * Send an order to suppliers
 */
export async function sendOrder(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 1. Get order and verify access
  const { data: order } = await supabase
    .from('orders')
    .select('*, organization:organizations(name)')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // Verify status
  if (order.status !== 'draft' && order.status !== 'review') {
    throw new Error('Order can only be sent from draft or review status');
  }

  // 2. Get order items with supplier info
  const { data: items } = await supabase
    .from('order_items')
    .select(
      `
            product,
            quantity,
            unit,
            supplier_id,
            supplier:suppliers(id, name, email)
        `
    )
    .eq('order_id', orderId);

  if (!items || items.length === 0) {
    throw new Error('Order has no items');
  }

  // 3. Group items by supplier
  type SupplierGroup = {
    id: string;
    name: string;
    email?: string;
    items: {
      product: string;
      quantity: number;
      unit: string;
      supplierName: string;
    }[];
  };

  const itemsBySupplier = items.reduce((acc: Record<string, SupplierGroup>, item) => {
    if (!item.supplier_id || !item.supplier) return acc;

    const supplierId = item.supplier_id;
    const supplierName = item.supplier.name || 'Sin proveedor';

    if (!acc[supplierId]) {
      acc[supplierId] = {
        id: supplierId,
        name: supplierName,
        email: item.supplier.email,
        items: [],
      };
    }

    acc[supplierId].items.push({
      product: item.product,
      quantity: item.quantity,
      unit: item.unit,
      supplierName: supplierName,
    });
    return acc;
  }, {});

  // 4. Send emails
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  const supplierGroups = Object.values(itemsBySupplier);

  for (const group of supplierGroups) {
    if (!group.email) {
      console.warn(`Skipping email for supplier ${group.name} (no email)`);
      results.errors.push(`Proveedor ${group.name}: No tiene email registrado`);
      results.failed++;
      continue;
    }

    try {
      const result = await sendOrderEmail({
        to: group.email,
        orderId: order.id,
        organizationName: order.organization?.name || 'Organización',
        items: group.items,
      });

      if (result) {
        results.success++;

        // Update supplier_order status to 'sent'
        await supabase
          .from('supplier_orders')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)
          .eq('supplier_id', group.id);
      } else {
        throw new Error('Email service returned null');
      }

      // Add a small delay to be nice to the API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error sending email to ${group.name}:`, error);
      results.failed++;
      results.errors.push(`Proveedor ${group.name}: Error al enviar email`);

      // Update supplier_order status to 'failed'
      await supabase
        .from('supplier_orders')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('order_id', orderId)
        .eq('supplier_id', group.id);
    }
  }

  // 5. Update order status
  // Only mark as sent if at least one email was sent successfully
  if (results.success > 0) {
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      throw new Error('Failed to update order status');
    }
  }

  revalidatePath(`/orders/${orderId}`);

  // Return detailed status
  if (results.failed > 0) {
    return {
      success: results.success > 0, // Considered partial success if at least one sent
      message: `Se enviaron ${results.success} correos. Fallaron ${results.failed}.`,
      details: results,
    };
  }

  return { success: true };
}
