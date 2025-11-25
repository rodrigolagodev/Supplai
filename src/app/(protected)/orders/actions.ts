'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ClassifiedItem } from '@/lib/ai/classifier';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Create a new draft order
 */
export async function createDraftOrder(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

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

/**
 * Save a message to the conversation history
 */
export async function saveConversationMessage(
  orderId: string,
  role: 'user' | 'assistant',
  content: string,
  audioFileId?: string,
  sequenceNumber?: number
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check access via order membership
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // Use command pattern to execute business logic
  const { OrderCommands } = await import('@/application/commands/OrderCommands');
  const commands = new OrderCommands(supabase);

  await commands.addMessage({
    orderId,
    role,
    content,
    audioFileId,
    sequenceNumber: sequenceNumber || 0,
  });
}

/**
 * Save parsed and classified items to the order
 */
export async function saveParsedItems(orderId: string, items: ClassifiedItem[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check access via order membership
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // Prepare items for insertion
  const dbItems = items.map(item => ({
    order_id: orderId,
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
    original_text: item.original_text,
    confidence_score: item.confidence,
    supplier_id: item.supplier_id, // Can be null
  }));

  const { error } = await supabase.from('order_items').insert(dbItems);

  if (error) {
    console.error('Error saving items:', error);
    throw new Error('Failed to save items');
  }

  revalidatePath(`/orders/${orderId}`);
}

/**
 * Process all messages in an order to extract items
 * - Fetches all user messages
 * - Aggregates text
 * - Parses with Gemini
 * - Classifies with Suppliers
 * - Replaces existing items
 */
export async function processOrderBatch(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 1. Get order and verify access
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // 2. Use command pattern to execute business logic
  const { OrderCommands } = await import('@/application/commands/OrderCommands');
  const commands = new OrderCommands(supabase);

  return await commands.processOrder(orderId, order.organization_id);
}

/**
 * Get conversation history for an order
 */
export async function getOrderConversation(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Check access via order membership
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

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

/**
 * Send an order to suppliers
 */
export async function sendOrder(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 1. Get order and verify access
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id, status')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  // Verify status
  if (order.status !== 'draft' && order.status !== 'review') {
    throw new Error('Order can only be sent from draft or review status');
  }

  // 2. Use command pattern to execute business logic
  const { OrderCommands } = await import('@/application/commands/OrderCommands');
  const commands = new OrderCommands(supabase);

  await commands.sendOrder(orderId);

  revalidatePath(`/orders/${orderId}`);

  return { success: true };
}

/**
 * Clean up empty draft orders older than a specified number of days
 * This function is designed to be called by a cron job with admin privileges
 *
 * @param supabaseAdmin - Supabase client with admin/service role privileges
 * @param daysOld - Number of days to consider a draft as "old" (default: 7)
 * @returns Object with count of deleted orders and any errors
 */
export async function cleanupEmptyDrafts(
  supabaseAdmin: SupabaseClient<Database>,
  daysOld: number = 7
): Promise<{ deletedCount: number; errors: string[] }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Find draft orders older than cutoff date
    const { data: oldDrafts, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at')
      .eq('status', 'draft')
      .lt('created_at', cutoffDate.toISOString());

    if (fetchError) {
      console.error('[Cleanup] Error fetching old drafts:', fetchError);
      return { deletedCount: 0, errors: [fetchError.message] };
    }

    if (!oldDrafts || oldDrafts.length === 0) {
      console.error('[Cleanup] No old draft orders found');
      return { deletedCount: 0, errors: [] };
    }

    console.error(`[Cleanup] Found ${oldDrafts.length} old draft orders`);

    const deletedIds: string[] = [];
    const errors: string[] = [];

    // Check each draft for messages and delete if empty
    for (const draft of oldDrafts) {
      try {
        // Check if order has any messages
        const { data: messages, error: msgError } = await supabaseAdmin
          .from('order_conversations')
          .select('id')
          .eq('order_id', draft.id)
          .limit(1);

        if (msgError) {
          errors.push(`Error checking messages for order ${draft.id}: ${msgError.message}`);
          continue;
        }

        // If no messages, delete the order
        if (!messages || messages.length === 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', draft.id);

          if (deleteError) {
            errors.push(`Error deleting order ${draft.id}: ${deleteError.message}`);
          } else {
            deletedIds.push(draft.id);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Error processing order ${draft.id}: ${errorMsg}`);
      }
    }

    console.error(`[Cleanup] Deleted ${deletedIds.length} empty draft orders`);
    if (errors.length > 0) {
      console.error('[Cleanup] Errors during cleanup:', errors);
    }

    return { deletedCount: deletedIds.length, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cleanup] Fatal error during cleanup:', errorMsg);
    return { deletedCount: 0, errors: [errorMsg] };
  }
}

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
  // No need to import, it's in the same file
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
