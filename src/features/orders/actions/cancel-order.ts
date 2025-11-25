'use server';

import { getAuthedContext } from '@/lib/auth/context';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';

export async function cancelOrder(orderId: string) {
  const { supabase } = await getAuthedContext();

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' as Database['public']['Enums']['order_status'] })
    .eq('id', orderId);

  if (error) {
    console.error('Error cancelling order:', error);
    throw new Error('Error al cancelar pedido');
  }

  revalidatePath('/orders');
}
