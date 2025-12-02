import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Product Suggestions Service
 * Provides intelligent product recommendations based on user history
 */

interface FrequentProduct {
  product: string;
  unit: string;
  avgQuantity: number;
  frequency: number;
}

interface LastOrderItem {
  product: string;
  quantity: number;
  unit: string;
  supplier_name?: string;
}

/**
 * Get the user's most frequently ordered products
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @param limit - Maximum number of products to return (default: 10)
 * @returns Array of frequent products with metadata
 */
export async function getFrequentProducts(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string,
  limit = 10
): Promise<FrequentProduct[]> {
  // Get orders from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: items, error } = await supabase
    .from('order_items')
    .select(
      `
      product,
      unit,
      quantity,
      orders!inner(
        created_by,
        organization_id,
        created_at,
        status
      )
    `
    )
    .eq('orders.created_by', userId)
    .eq('orders.organization_id', organizationId)
    .gte('orders.created_at', ninetyDaysAgo.toISOString())
    .eq('orders.status', 'sent'); // Only sent orders

  if (error || !items || items.length === 0) {
    return [];
  }

  // Group by product-unit combination and calculate frequency + avg quantity
  const productMap = new Map<string, { quantities: number[]; count: number }>();

  items.forEach(item => {
    const key = `${item.product}|${item.unit}`;
    const existing = productMap.get(key);

    if (existing) {
      existing.quantities.push(item.quantity);
      existing.count++;
    } else {
      productMap.set(key, {
        quantities: [item.quantity],
        count: 1,
      });
    }
  });

  // Convert to array and calculate averages
  const frequentProducts: FrequentProduct[] = Array.from(productMap.entries())
    .map(([key, data]) => {
      const parts = key.split('|');
      const product = parts[0] || '';
      const unit = parts[1] || '';
      const avgQuantity = data.quantities.reduce((sum, q) => sum + q, 0) / data.quantities.length;

      return {
        product,
        unit,
        avgQuantity: Math.round(avgQuantity * 100) / 100, // Round to 2 decimals
        frequency: data.count,
      };
    })
    .sort((a, b) => b.frequency - a.frequency) // Sort by frequency descending
    .slice(0, limit);

  return frequentProducts;
}

/**
 * Get the user's last completed order
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @returns Array of items from the last order, or empty array if none
 */
export async function getLastOrder(
  supabase: SupabaseClient<Database>,
  userId: string,
  organizationId: string
): Promise<LastOrderItem[]> {
  // Get the most recent completed order
  const { data: lastOrder, error: orderError } = await supabase
    .from('orders')
    .select('id, created_at')
    .eq('created_by', userId)
    .eq('organization_id', organizationId)
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError || !lastOrder) {
    return [];
  }

  // Get items from that order
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select(
      `
      product,
      quantity,
      unit,
      suppliers(name)
    `
    )
    .eq('order_id', lastOrder.id);

  if (itemsError || !items) {
    return [];
  }

  return items.map(item => ({
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
    supplier_name: item.suppliers?.name,
  }));
}

/**
 * Format frequent products for AI context
 */
export function formatFrequentProductsForPrompt(products: FrequentProduct[]): string {
  if (products.length === 0) {
    return 'El usuario no tiene productos frecuentes registrados.';
  }

  return products
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.product} - ${p.avgQuantity} ${p.unit} (pedido ${p.frequency} veces)`
    )
    .join('\n');
}

/**
 * Format last order for AI context
 */
export function formatLastOrderForPrompt(items: LastOrderItem[]): string {
  if (items.length === 0) {
    return 'El usuario no tiene pedidos anteriores.';
  }

  return items
    .map(item => {
      const supplier = item.supplier_name ? ` (${item.supplier_name})` : '';
      return `- ${item.quantity} ${item.unit} de ${item.product}${supplier}`;
    })
    .join('\n');
}
