import { createClient } from '@/lib/supabase/server';
import { sendOrderEmail } from '@/lib/email/orders';
import { OrderService } from './orders';
import { SupabaseClient } from '@supabase/supabase-js';

export class NotificationService {
  /**
   * Send a specific supplier order via configured channels (Email, etc.)
   */
  static async sendSupplierOrder(supplierOrderId: string, client?: SupabaseClient) {
    const supabase = client ?? (await createClient());

    // 1. Fetch full details
    const { data: supplierOrder, error } = await supabase
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

    if (error || !supplierOrder) {
      throw new Error('Supplier order not found');
    }

    // 2. Update status to sending
    await supabase.from('supplier_orders').update({ status: 'sending' }).eq('id', supplierOrderId);

    try {
      // 3. Fetch items for this supplier
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', supplierOrder.order_id)
        .eq('supplier_id', supplierOrder.supplier_id);

      if (!items || items.length === 0) {
        throw new Error('No items found for this supplier order');
      }

      // 4. Send Email
      if (supplierOrder.supplier.email) {
        const emailResult = await sendOrderEmail({
          to: supplierOrder.supplier.email,
          orderId: supplierOrder.order_id,
          organizationName: supplierOrder.order.organization?.name || 'Organización',
          items: items.map(i => ({
            product: i.product,
            quantity: i.quantity,
            unit: i.unit,
            supplierName: supplierOrder.supplier.name,
          })),
        });

        if (!emailResult) {
          throw new Error('Email service returned null');
        }
      } else {
        // No email? Maybe WhatsApp in future. For now, if no email, it's a "manual" send or error.
        // We'll mark as failed for now if no contact method exists.
        throw new Error('Supplier has no email address');
      }

      // 5. Mark as Sent
      await supabase
        .from('supplier_orders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', supplierOrderId);

      // 6. Update main order status
      await OrderService.updateMainOrderStatus(supplierOrder.order_id, client);
    } catch (error) {
      console.error(`Error sending supplier order ${supplierOrderId}: `, error);

      // Mark as Failed
      await supabase
        .from('supplier_orders')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', supplierOrderId);

      throw error; // Re-throw so JobQueue knows it failed
    }
  }
}
