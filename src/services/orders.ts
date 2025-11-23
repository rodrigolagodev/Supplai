import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export class OrderService {
  /**
   * Create supplier orders for a given order
   * Idempotent: checks if they exist first
   */
  static async createSupplierOrders(orderId: string, client?: SupabaseClient) {
    const supabase = client ?? (await createClient());

    // 1. Get order items with supplier info
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('supplier_id')
      .eq('order_id', orderId)
      .not('supplier_id', 'is', null);

    if (itemsError) throw new Error('Failed to fetch items');
    if (!items || items.length === 0) return [];

    // 2. Get unique supplier IDs
    const supplierIds = [...new Set(items.map(i => i.supplier_id))];

    const createdOrders = [];

    // 3. Create supplier_orders
    for (const supplierId of supplierIds) {
      if (!supplierId) continue;

      // Check if exists
      const { data: existing } = await supabase
        .from('supplier_orders')
        .select('id')
        .eq('order_id', orderId)
        .eq('supplier_id', supplierId)
        .single();

      if (existing) {
        createdOrders.push(existing);
        continue;
      }

      // Create new
      const { data: newOrder, error: createError } = await supabase
        .from('supplier_orders')
        .insert({
          order_id: orderId,
          supplier_id: supplierId,
          status: 'pending', // Initial status
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating supplier order:', createError);
        // Continue with others? Or throw?
        // Throwing is safer to ensure consistency
        throw new Error(`Failed to create supplier order for ${supplierId}`);
      }

      createdOrders.push(newOrder);
    }

    return createdOrders;
  }

  /**
   * Update the main order status based on supplier orders
   */
  static async updateMainOrderStatus(orderId: string, client?: SupabaseClient) {
    const supabase = client ?? (await createClient());

    // Get all supplier orders
    const { data: supplierOrders } = await supabase
      .from('supplier_orders')
      .select('status')
      .eq('order_id', orderId);

    if (!supplierOrders || supplierOrders.length === 0) return;

    // Logic:
    // If ALL are 'sent' -> 'sent'
    // If ANY is 'sent' -> 'sent' (Partial success is still sent)
    // If ALL are 'failed' -> 'failed' (or keep as draft/review?)

    const hasSent = supplierOrders.some(o => o.status === 'sent' || o.status === 'delivered');

    if (hasSent) {
      await supabase
        .from('orders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }
  }
}
