'use server';

import { getOrderContext } from '@/lib/auth/context';
import { revalidatePath } from 'next/cache';

/**
 * Permanently delete an order
 * This action is irreversible
 */
export async function cancelOrder(orderId: string) {
  const { supabase } = await getOrderContext(orderId);

  // Permanently delete the order (cascade will handle related records)
  const { error } = await supabase.from('orders').delete().eq('id', orderId);

  if (error) {
    console.error('Error deleting order:', error);
    throw new Error('Error al eliminar pedido');
  }

  revalidatePath('/');
  revalidatePath('/history');
}
