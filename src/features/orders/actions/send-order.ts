'use server';

import { getOrderContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { saveOrderItems } from '@/features/orders/actions/items';

/**
 * Send an order to suppliers
 *
 * This is now a thin controller that delegates to SubmitOrderUseCase
 */
export async function sendOrder(orderId: string, redirectPath?: string) {
  const { supabase } = await getOrderContext(orderId);

  // Delegate to use case
  const { submitOrderUseCase } = await import('@/application/use-cases/SubmitOrder');

  const result = await submitOrderUseCase({
    orderId,
    supabase,
  });

  if (!result.success) {
    throw new Error(result.message || 'Failed to send order');
  }

  // Redirect after successful submission
  if (redirectPath) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect(redirectPath as any);
  }

  return { success: true };
}

/**
 * Finalize order and mark as ready to send
 */
import type { OrderReviewItem } from '@/features/orders/actions/items';

/**
 * Finalize order and mark as ready to send
 */
export async function finalizeOrder(orderId: string, items: OrderReviewItem[]) {
  // Verify access to order first
  const { order } = await getOrderContext(orderId);

  // First save all items
  await saveOrderItems(orderId, items);

  // Use shared sendOrder action
  await sendOrder(orderId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgSlug = (order as any).organization?.slug;

  return { success: true, redirectUrl: `/${orgSlug}/orders/${orderId}/confirmation` };
}
