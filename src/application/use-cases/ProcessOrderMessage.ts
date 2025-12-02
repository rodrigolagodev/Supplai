import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { parseOrder, aggregateMessages } from '@/domain/orders/OrderParsingService';
import { canProcessOrder } from '@/domain/orders/policies';
import type { Order, ParsedItem } from '@/domain/types';

/**
 * ProcessOrderMessageUseCase
 *
 * Orchestrates the complete flow of processing an order:
 * 1. Validate user has access (done by caller via getOrderContext)
 * 2. Fetch order and messages
 * 3. Check business rules (canProcessOrder)
 * 4. Aggregate messages
 * 5. Parse with domain service
 * 6. Save items to database
 * 7. Update order status
 * 8. Create summary message
 *
 * This is a "controller" that coordinates domain logic and infrastructure.
 */

export interface ProcessOrderInput {
  orderId: string;
  organizationId: string;
  supabase: SupabaseClient<Database>;
}

export interface ProcessOrderOutput {
  success: boolean;
  redirectUrl?: string;
  message?: string;
  itemsProcessed?: number;
}

export async function processOrderMessageUseCase(
  input: ProcessOrderInput
): Promise<ProcessOrderOutput> {
  const { orderId, organizationId, supabase } = input;

  try {
    // 1. Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return {
        success: false,
        message: 'Pedido no encontrado',
      };
    }

    // 2. Check if order can be processed (business rule)
    if (!canProcessOrder(order as Order)) {
      return {
        success: false,
        message: 'Este pedido ya fue procesado',
      };
    }

    // 3. Fetch user messages
    const { data: messages, error: messagesError } = await supabase
      .from('order_conversations')
      .select('content')
      .eq('order_id', orderId)
      .eq('role', 'user')
      .order('created_at', { ascending: true });

    if (messagesError || !messages || messages.length === 0) {
      return {
        success: false,
        message: 'No hay mensajes para procesar',
      };
    }

    // 4. Aggregate messages into single text (domain logic)
    const fullText = aggregateMessages(messages);

    // 5. Fetch suppliers for classification context
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, category, custom_keywords')
      .eq('organization_id', organizationId);

    // 6. Parse order with domain service
    const parseResult = await parseOrder({
      text: fullText,
      suppliers: suppliers || [],
    });

    if (parseResult.itemCount === 0) {
      return {
        success: false,
        message: 'No pude identificar productos en la conversación',
      };
    }

    // 7. Delete existing items (idempotent replace)
    await supabase.from('order_items').delete().eq('order_id', orderId);

    // 8. Save parsed items
    const itemsToInsert = parseResult.items.map(item => ({
      order_id: orderId,
      product: item.product,
      quantity: item.quantity,
      unit: item.unit,
      supplier_id: item.supplier_id || null,
      confidence_score: item.confidence,
      original_text: item.original_text || null,
    }));

    const { error: insertError } = await supabase.from('order_items').insert(itemsToInsert);

    if (insertError) {
      throw new Error(`Failed to save items: ${insertError.message}`);
    }

    // 9. Update order status to 'review'
    await supabase
      .from('orders')
      .update({ status: 'review', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    // 10. Create summary message
    const summary = createSummaryMessage(parseResult.items, suppliers || []);

    await saveSummaryMessage(supabase, orderId, summary, messages.length);

    return {
      success: true,
      redirectUrl: `/orders/${orderId}/review`,
      itemsProcessed: parseResult.itemCount,
    };
  } catch (error) {
    console.error('[ProcessOrderUseCase] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al procesar el pedido',
    };
  }
}

/**
 * Helper: Create a human-readable summary of parsed items
 */
function createSummaryMessage(
  items: ParsedItem[],
  suppliers: Array<{ id: string; name: string }>
): string {
  const itemCount = items.length;
  let summary = `He procesado todo el pedido. Encontré ${itemCount} producto${
    itemCount !== 1 ? 's' : ''
  }:\n\n`;

  items.forEach(item => {
    const supplier = suppliers.find(s => s.id === item.supplier_id);
    const supplierName = supplier?.name || 'Sin proveedor';
    summary += `- ${item.quantity} ${item.unit} de ${item.product} (${supplierName})\n`;
  });

  return summary;
}

/**
 * Helper: Save summary message to conversation
 */
async function saveSummaryMessage(
  supabase: SupabaseClient<Database>,
  orderId: string,
  content: string,
  _nextSequence: number
): Promise<void> {
  await supabase.from('order_conversations').insert({
    order_id: orderId,
    role: 'assistant',
    content,
    created_at: new Date().toISOString(),
  });
}
