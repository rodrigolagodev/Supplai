'use server';

import { getOrderContext } from '@/lib/auth/context';
import { Database } from '@/types/database';
import { revalidatePath } from 'next/cache';

/**
 * Restore a cancelled order by changing its status back to 'draft'
 * This allows users to recover orders they previously cancelled
 */
export async function restoreOrder(orderId: string) {
  const { supabase } = await getOrderContext(orderId);

  const { error } = await supabase
    .from('orders')
    .update({ status: 'draft' as Database['public']['Enums']['order_status'] })
    .eq('id', orderId)
    .eq('status', 'cancelled'); // Only restore if currently cancelled

  if (error) {
    console.error('Error restoring order:', error);
    throw new Error('Error al restaurar pedido');
  }

  revalidatePath('/');
  revalidatePath('/history');
}
