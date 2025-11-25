'use server';

import { getAuthedContext } from '@/lib/auth/context';

/**
 * Create a new draft order
 */
export async function createDraftOrder(organizationId: string) {
  const { user, supabase } = await getAuthedContext(organizationId);

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      organization_id: organizationId,
      created_by: user.id,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating order:', error);
    throw new Error('Failed to create order');
  }

  return order;
}
