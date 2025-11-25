'use server';

import { getOrderContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';

/**
 * Get order review data with items grouped by supplier
 */
export async function getOrderReview(orderId: string) {
  const { supabase, order, membership } = await getOrderContext(orderId);

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
 * Get supplier order details for read-only view (individual supplier order)
 * This is used when viewing a specific supplier_order from the history
 */
export async function getSupplierOrderDetails(supplierOrderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

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
 * Get order details for read-only view (sent/archived orders)
 * This function automatically detects if the ID is a regular order or a supplier_order
 */
export async function getOrderDetails(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

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
 * Get conversation history for an order
 */
export async function getOrderConversation(orderId: string) {
  const { supabase } = await getOrderContext(orderId);

  const { data, error } = await supabase
    .from('order_conversations')
    .select(
      `
      *,
      audio_file:order_audio_files(*)
    `
    )
    .eq('order_id', orderId)
    .order('sequence_number', { ascending: true });

  if (error) {
    console.error('Error fetching conversation:', error);
    throw new Error('Failed to fetch conversation');
  }

  return data;
}
