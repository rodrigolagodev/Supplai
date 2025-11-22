'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database } from '@/types/database';

/**
 * Get order review data with items grouped by supplier
 */
export async function getOrderReview(orderId: string) {
  const supabase = await createClient();

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // DEBUG: Check memberships
  const { data: myMemberships } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', user.id);
  console.log('User:', user.id);
  console.log('Memberships:', myMemberships);

  // DEBUG: Check visible orders
  const { data: visibleOrders } = await supabase
    .from('orders')
    .select('id, organization_id')
    .limit(5);
  console.log('Visible orders sample:', visibleOrders);

  // Get order first (without join to isolate errors)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error('Error fetching order:', orderError);
    console.error('OrderId:', orderId);
    throw new Error('Pedido no encontrado');
  }

  // Get organization details
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', order.organization_id)
    .single();

  if (orgError || !organization) {
    console.error('Error fetching organization:', orgError);
    throw new Error('Organización no encontrada');
  }

  // Combine for compatibility
  const orderWithOrg = { ...order, organization };

  // Verify user membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('organization_id', order.organization_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    throw new Error('No tienes acceso a este pedido');
  }

  // Get all items
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');

  if (itemsError) {
    throw new Error('Error al cargar items');
  }

  // Get suppliers
  const { data: suppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', order.organization_id)
    .order('name');

  if (suppliersError) {
    throw new Error('Error al cargar proveedores');
  }

  return {
    order: orderWithOrg,
    items: items || [],
    suppliers: suppliers || [],
    userRole: membership.role,
  };
}

/**
 * Update an order item
 */
export async function updateOrderItem(
  itemId: string,
  data: {
    product?: string;
    quantity?: number;
    unit?: Database['public']['Enums']['item_unit'];
  }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // Update item
  const { error } = await supabase.from('order_items').update(data).eq('id', itemId);

  if (error) {
    throw new Error('Error al actualizar item');
  }

  return { success: true };
}

/**
 * Reassign item to a different supplier
 */
export async function reassignItem(itemId: string, supplierId: string | null) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // Update supplier_id
  const { error } = await supabase
    .from('order_items')
    .update({
      supplier_id: supplierId,
      // Update confidence when manually assigned
      confidence_score: supplierId ? 1.0 : null,
    })
    .eq('id', itemId);

  if (error) {
    console.error('Error reassigning item:', error);
    throw new Error(`Error al reasignar item: ${error.message}`);
  }

  // Revalidate
  const { data: item } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .single();

  if (item) {
    revalidatePath(`/orders/${item.order_id}/review`);
  }

  return { success: true };
}

/**
 * Delete an unclassified order item
 */
export async function deleteOrderItem(itemId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // Get order_id first for revalidation
  const { data: item } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .single();

  // Delete item
  const { error } = await supabase.from('order_items').delete().eq('id', itemId);

  if (error) {
    throw new Error('Error al eliminar item');
  }

  if (item) {
    revalidatePath(`/orders/${item.order_id}/review`);
  }
  return { success: true };
}

/**
 * Save all order items in batch
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveOrderItems(orderId: string, items: any[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // Prepare data for upsert
  // We only want to update editable fields and ensure order_id/user ownership
  const itemsToUpsert = items.map(item => ({
    id: item.id.startsWith('temp-') ? undefined : item.id, // Let DB generate ID for new items
    order_id: orderId,
    supplier_id: item.supplier_id,
    product: item.product,
    quantity: item.quantity,
    unit: item.unit as Database['public']['Enums']['item_unit'],
    confidence_score: item.confidence_score,
    original_text: item.original_text,
    // Don't include created_at to let DB handle it
  }));

  const { error } = await supabase.from('order_items').upsert(itemsToUpsert, { onConflict: 'id' });

  if (error) {
    console.error('Error saving items:', error);
    throw new Error('Error al guardar los items');
  }

  revalidatePath(`/orders/${orderId}/review`);
  return { success: true };
}

/**
 * Finalize order and mark as ready to send
 */
/**
 * Finalize order and mark as ready to send
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function finalizeOrder(orderId: string, items: any[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // First save all items
  await saveOrderItems(orderId, items);

  // Use shared sendOrder action
  const { sendOrder } = await import('../actions');
  await sendOrder(orderId);

  return { success: true, redirectUrl: `/orders/${orderId}/confirmation` };
}

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  category: z.enum([
    'fruits_vegetables',
    'meats',
    'fish_seafood',
    'dry_goods',
    'dairy',
    'beverages',
    'cleaning',
    'packaging',
    'other',
  ]),
});

export async function createQuickSupplier(organizationId: string, formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    category: formData.get('category'),
  };

  const result = supplierSchema.safeParse(rawData);

  if (!result.success) {
    return { error: result.error.flatten() };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      ...result.data,
      organization_id: organizationId,
    } as unknown as Database['public']['Tables']['suppliers']['Insert'])
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating supplier:', error);
    return { error: { formErrors: ['Error al crear proveedor'], fieldErrors: {} } };
  }

  revalidatePath('/orders');
  return { success: true, supplier: data };
}

/**
 * Create a new order item manually
 */
export async function createOrderItem(
  orderId: string,
  supplierId: string,
  data: { product: string; quantity: number; unit: string }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: newItem, error } = await supabase
    .from('order_items')
    .insert({
      order_id: orderId,
      supplier_id: supplierId,
      product: data.product,
      quantity: data.quantity,
      unit: data.unit as Database['public']['Enums']['item_unit'],
      confidence_score: 1.0, // Manual entry is 100% confident
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating item:', error);
    throw new Error('Error al crear producto');
  }

  revalidatePath(`/orders/${orderId}/review`);
  return newItem;
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

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
