'use server';

import { getOrderContext } from '@/lib/auth/context';
import { revalidatePath } from 'next/cache';

/**
 * Permanently delete an order
 * This action is irreversible
 */
export async function cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await getOrderContext(orderId);

    // Permanently delete the order (cascade will handle related records)
    const { error } = await supabase.from('orders').delete().eq('id', orderId);

    if (error) {
      console.error('Error deleting order:', error);
      return {
        success: false,
        error: 'Error al eliminar pedido',
      };
    }

    revalidatePath('/');
    revalidatePath('/history');

    return { success: true };
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar pedido',
    };
  }
}
