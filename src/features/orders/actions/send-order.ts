'use server';

import { getOrderContext } from '@/lib/auth/context';
import { revalidatePath } from 'next/cache';
import { saveOrderItems } from '@/features/orders/actions/items';

/**
 * Send an order to suppliers
 */
export async function sendOrder(orderId: string) {
  const { supabase, order } = await getOrderContext(orderId);

  // Verify status
  if (order.status !== 'draft' && order.status !== 'review') {
    throw new Error('Order can only be sent from draft or review status');
  }

  // 2. Use command pattern to execute business logic
  const { OrderCommands } = await import('@/features/orders/server/services/order-commands');
  const commands = new OrderCommands(supabase);

  await commands.sendOrder(orderId);

  revalidatePath(`/orders/${orderId}`);

  return { success: true };
}

/**
 * Finalize order and mark as ready to send
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function finalizeOrder(orderId: string, items: any[]) {
  // Verify access to order first
  await getOrderContext(orderId);

  // First save all items
  await saveOrderItems(orderId, items);

  // Use shared sendOrder action
  await sendOrder(orderId);

  return { success: true, redirectUrl: `/orders/${orderId}/confirmation` };
}
