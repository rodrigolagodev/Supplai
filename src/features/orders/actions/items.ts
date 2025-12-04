'use server';

import { getOrderContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { ClassifiedItem } from '@/lib/ai/classifier';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database';

/**
 * Save parsed and classified items to the order
 */
export async function saveParsedItems(orderId: string, items: ClassifiedItem[]) {
  const { supabase } = await getOrderContext(orderId);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgSlug =
    (supabase as any).organization?.slug ||
    (await getOrderContext(orderId)).order.organization?.slug;
  revalidatePath(`/${orgSlug}/orders/${orderId}`);
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
  // First get the item to extract order_id
  const supabaseTemp = await createClient();
  const { data: item } = await supabaseTemp
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .single();

  if (!item) {
    throw new Error('Item not found');
  }

  const { supabase } = await getOrderContext(item.order_id);

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
  // First get the item to extract order_id
  const supabaseTemp = await createClient();
  const { data: item } = await supabaseTemp
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .single();

  if (!item) {
    throw new Error('Item not found');
  }

  const { supabase } = await getOrderContext(item.order_id);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgSlug =
    (item as any).order?.organization?.slug ||
    (await getOrderContext(item.order_id)).order.organization?.slug;

  // Revalidate
  revalidatePath(`/${orgSlug}/orders/${item.order_id}`);
  revalidatePath(`/${orgSlug}/orders/${item.order_id}/review`);

  return { success: true };
}

/**
 * Delete an unclassified order item
 */
export async function deleteOrderItem(itemId: string) {
  // First get the item to extract order_id
  const supabaseTemp = await createClient();
  const { data: item } = await supabaseTemp
    .from('order_items')
    .select('order_id')
    .eq('id', itemId)
    .single();

  if (!item) {
    throw new Error('Item not found');
  }

  const { supabase } = await getOrderContext(item.order_id);

  // Delete item
  const { error } = await supabase.from('order_items').delete().eq('id', itemId);

  if (error) {
    throw new Error('Error al eliminar item');
  }

  if (item) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgSlug =
      (item as any).order?.organization?.slug ||
      (await getOrderContext(item.order_id)).order.organization?.slug;
    revalidatePath(`/${orgSlug}/orders/${item.order_id}/review`);
  }
  return { success: true };
}

export interface OrderReviewItem {
  id: string;
  supplier_id: string | null;
  product: string;
  quantity: number;
  unit: string;
  confidence_score?: number | null;
  original_text?: string | null;
}

/**
 * Save all order items in batch
 */
export async function saveOrderItems(orderId: string, items: OrderReviewItem[]) {
  const { supabase } = await getOrderContext(orderId);

  // Separate new items from existing items
  const newItems = items.filter(item => item.id.toString().startsWith('temp'));
  const existingItems = items.filter(item => !item.id.toString().startsWith('temp'));

  // Helper to sanitize unit
  const sanitizeUnit = (unit: string): Database['public']['Enums']['item_unit'] => {
    if (unit === 'unidades') return 'units';
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
        throw new Error(
          `Error al actualizar item "${item.product}": ${updateError.message} (${updateError.details || 'Sin detalles'})`
        );
      }
    }
  }

  const orgSlug = (await getOrderContext(orderId)).order.organization?.slug;
  revalidatePath(`/${orgSlug}/orders/${orderId}/review`);
  return { success: true };
}

/**
 * Create a new order item manually
 */
export async function createOrderItem(
  orderId: string,
  supplierId: string,
  data: { product: string; quantity: number; unit: string }
) {
  const { supabase } = await getOrderContext(orderId);

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

  const orgSlug = (await getOrderContext(orderId)).order.organization?.slug;
  revalidatePath(`/${orgSlug}/orders/${orderId}/review`);
  return newItem;
}
