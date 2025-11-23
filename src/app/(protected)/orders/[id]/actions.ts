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
  // const { data: myMemberships } = await supabase
  //   .from('memberships')
  //   .select('organization_id, role')
  //   .eq('user_id', user.id);

  // DEBUG: Check visible orders
  // const { data: visibleOrders } = await supabase
  //   .from('orders')
  //   .select('id, organization_id')
  //   .limit(5);

  // Get order first (without join to isolate errors)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    // Check if this is a supplier_order (which can't be reviewed)
    const { data: supplierOrder } = await supabase
      .from('supplier_orders')
      .select('id')
      .eq('id', orderId)
      .single();

    if (supplierOrder) {
      throw new Error(
        'Los pedidos de proveedor individuales no se pueden revisar. Usa la vista de detalles.'
      );
    }

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
 * Get order details for read-only view (sent/archived orders)
 * This function automatically detects if the ID is a regular order or a supplier_order
 */
export async function getOrderDetails(orderId: string) {
  const supabase = await createClient();

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // First, try to fetch as a regular order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  // If not found as an order, try as supplier_order
  if (orderError || !order) {
    const { data: supplierOrder } = await supabase
      .from('supplier_orders')
      .select('id')
      .eq('id', orderId)
      .single();

    if (supplierOrder) {
      // Delegate to supplier order handler
      return getSupplierOrderDetails(orderId);
    }

    // Neither found, throw error
    console.error('Error fetching order:', orderError);
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

  // Get all items with supplier info
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*, supplier:suppliers(name, category)')
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
  };
}

/**
 * Get supplier order details for read-only view (individual supplier order)
 * This is used when viewing a specific supplier_order from the history
 */
export async function getSupplierOrderDetails(supplierOrderId: string) {
  const supabase = await createClient();

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('No autenticado');
  }

  // Get supplier_order with related order and supplier info
  const { data: supplierOrder, error: supplierOrderError } = await supabase
    .from('supplier_orders')
    .select(
      `
      *,
      order:orders!inner(*),
      supplier:suppliers(*)
    `
    )
    .eq('id', supplierOrderId)
    .single();

  if (supplierOrderError || !supplierOrder) {
    console.error('Error fetching supplier order:', supplierOrderError);
    throw new Error('Pedido de proveedor no encontrado');
  }

  const order = supplierOrder.order;

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

  // Get items ONLY for this specific supplier
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*, supplier:suppliers(name, category)')
    .eq('order_id', order.id)
    .eq('supplier_id', supplierOrder.supplier_id)
    .order('created_at');

  if (itemsError) {
    throw new Error('Error al cargar items');
  }

  // Get only this supplier (not all suppliers)
  const supplier = supplierOrder.supplier;
  const suppliers = supplier ? [supplier] : [];

  // Combine for compatibility
  const orderWithOrg = { ...order, organization };

  return {
    order: orderWithOrg,
    items: items || [],
    suppliers,
    isSupplierOrder: true,
    supplierOrder,
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

  // Separate new items from existing items
  const newItems = items.filter(item => item.id.toString().startsWith('temp'));
  const existingItems = items.filter(item => !item.id.toString().startsWith('temp'));

  // Helper to sanitize unit
  const sanitizeUnit = (unit: string): Database['public']['Enums']['item_unit'] => {
    if (unit === 'unidades') return 'units';
    // Add other mappings if necessary, or return as is if it matches the enum
    const validUnits = ['kg', 'g', 'units', 'dozen', 'liters', 'ml', 'packages', 'boxes'];
    if (validUnits.includes(unit)) return unit as Database['public']['Enums']['item_unit'];
    return 'units'; // Default fallback
  };

  // Validate items before processing
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) {
      throw new Error(`La cantidad para "${item.product}" debe ser mayor a 0`);
    }
    if (!item.product || item.product.trim() === '') {
      throw new Error('El producto no puede estar vacío');
    }
  }

  // 1. Insert new items
  if (newItems.length > 0) {
    const itemsToInsert = newItems.map(item => ({
      order_id: orderId,
      supplier_id: item.supplier_id,
      product: item.product,
      quantity: item.quantity,
      unit: sanitizeUnit(item.unit),
      confidence_score: item.confidence_score,
      original_text: item.original_text,
    }));

    const { error: insertError } = await supabase.from('order_items').insert(itemsToInsert);

    if (insertError) {
      console.error('Error inserting new items:', insertError);
      throw new Error('Error al guardar nuevos items');
    }
  }

  // 2. Update existing items
  if (existingItems.length > 0) {
    // Use sequential updates to avoid issues with upsert and permissions
    for (const item of existingItems) {
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          supplier_id: item.supplier_id,
          product: item.product,
          quantity: item.quantity,
          unit: sanitizeUnit(item.unit),
          confidence_score: item.confidence_score,
          // We don't update order_id or original_text as they shouldn't change
        })
        .eq('id', item.id)
        .eq('order_id', orderId); // Extra safety check

      if (updateError) {
        console.error(`Error updating item ${item.id}:`, updateError);
        // Include specific error details for debugging
        throw new Error(
          `Error al actualizar item "${item.product}": ${updateError.message} (${updateError.details || 'Sin detalles'})`
        );
      }
    }
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
