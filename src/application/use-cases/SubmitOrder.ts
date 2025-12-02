import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { canSubmitOrder } from '@/domain/orders/policies';
import type { Order, OrderItem } from '@/domain/types';

/**
 * SubmitOrderUseCase
 *
 * Orchestrates the submission of an order to suppliers:
 * 1. Validate order can be submitted (business rules)
 * 2. Fetch order items
 * 3. Create supplier orders (group items by supplier)
 * 4. Enqueue email jobs
 * 5. Update order status to 'sending'
 *
 * This separates the business logic from infrastructure concerns.
 */

export interface SubmitOrderInput {
  orderId: string;
  supabase: SupabaseClient<Database>;
}

export interface SubmitOrderOutput {
  success: boolean;
  message?: string;
  supplierOrdersCreated?: number;
}

export async function submitOrderUseCase(input: SubmitOrderInput): Promise<SubmitOrderOutput> {
  const { orderId, supabase } = input;

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

    // 2. Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError || !items) {
      return {
        success: false,
        message: 'Error al cargar los items del pedido',
      };
    }

    // 3. Check business rules
    if (!canSubmitOrder(order as Order, items as OrderItem[])) {
      return {
        success: false,
        message:
          'Este pedido no puede ser enviado. Verifica que esté en estado "review" y tenga items.',
      };
    }

    // 4. Create supplier orders (delegate to existing service)
    const { OrderService } = await import('@/services/orders');
    const supplierOrders = await OrderService.createSupplierOrders(orderId, supabase);

    if (supplierOrders.length === 0) {
      return {
        success: false,
        message: 'No se encontraron items para enviar',
      };
    }

    // 5. Enqueue email jobs
    const { JobQueue } = await import('@/services/queue');
    for (const supplierOrder of supplierOrders) {
      await JobQueue.enqueue(
        'SEND_SUPPLIER_ORDER',
        { supplierOrderId: supplierOrder.id },
        supabase
      );
    }

    // 6. Update order status to 'sending'
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'sending',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to update order status: ${updateError.message}`);
    }

    return {
      success: true,
      supplierOrdersCreated: supplierOrders.length,
    };
  } catch (error) {
    console.error('[SubmitOrderUseCase] Error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al enviar el pedido',
    };
  }
}
