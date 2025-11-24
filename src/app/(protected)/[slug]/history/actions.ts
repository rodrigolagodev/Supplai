'use server';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server';

export type HistoryFilter = {
  status?: string[];
  supplierId?: string;
  memberId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
};

export type HistoryItem = {
  id: string;
  type: 'supplier_order' | 'order_bundle';
  displayId: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  supplier: {
    name: string;
    id: string;
  } | null;
  totalItems: number;
  createdBy: {
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  originalOrderId: string;
};

export async function getHistoryOrders(slug: string, filters: HistoryFilter = {}, limit?: number) {
  const supabase = await createClient();

  // 1. Get Organization ID
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single();

  if (!org) throw new Error('Organization not found');

  const orgId = org.id;

  // Determine which types to fetch based on filters
  const supplierOrderStatuses = ['pending', 'sending', 'sent', 'failed', 'delivered'];
  const orderBundleStatuses = ['draft', 'review'];

  let showSupplierOrders = true;
  let showOrderBundles = true;

  if (filters.status && filters.status.length > 0) {
    // Check if filtering by supplier_order statuses or order statuses
    const hasSupplierOrderStatus = filters.status.some(s => supplierOrderStatuses.includes(s));
    const hasOrderBundleStatus = filters.status.some(s => orderBundleStatuses.includes(s));

    showSupplierOrders = hasSupplierOrderStatus;
    showOrderBundles = hasOrderBundleStatus;
  }

  // 2. Fetch Supplier Orders (individual orders per supplier)
  let supplierOrders: any[] = [];

  if (showSupplierOrders) {
    let supplierOrdersQuery = supabase
      .from('supplier_orders')
      .select(
        `
        id,
        status,
        created_at,
        sent_at,
        supplier_id,
        supplier:suppliers!inner(id, name),
        order:orders!inner(
          id,
          organization_id,
          created_by
        )
      `
      )
      .eq('order.organization_id', orgId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      const relevantStatuses = filters.status.filter(s => supplierOrderStatuses.includes(s));
      if (relevantStatuses.length > 0) {
        supplierOrdersQuery = supplierOrdersQuery.in('status', relevantStatuses as any);
      }
    }
    if (filters.supplierId) {
      supplierOrdersQuery = supplierOrdersQuery.eq('supplier_id', filters.supplierId);
    }
    if (filters.memberId) {
      supplierOrdersQuery = supplierOrdersQuery.eq('order.created_by', filters.memberId);
    }
    if (filters.dateFrom) {
      supplierOrdersQuery = supplierOrdersQuery.gte('created_at', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      supplierOrdersQuery = supplierOrdersQuery.lte('created_at', filters.dateTo.toISOString());
    }

    // If limit is provided and we are ONLY showing supplier orders, we can limit the query
    // But since we might merge with order bundles, we should fetch a bit more or handle it after merge
    // For now, let's fetch enough to cover the limit
    if (limit && !showOrderBundles) {
      supplierOrdersQuery = supplierOrdersQuery.limit(limit);
    }

    const { data, error } = await supplierOrdersQuery;

    if (error) {
      console.error('Error fetching supplier orders:', error);
    } else {
      supplierOrders = data || [];
    }
  }

  // 3. Fetch Order Bundles (ONLY draft and review status)
  let orderBundles: any[] = [];

  if (showOrderBundles) {
    let orderBundlesQuery = supabase
      .from('orders')
      .select(
        `
        id,
        status,
        created_at,
        sent_at,
        created_by
      `
      )
      .eq('organization_id', orgId)
      .in('status', ['draft', 'review'])
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      const relevantStatuses = filters.status.filter(s => orderBundleStatuses.includes(s));
      if (relevantStatuses.length > 0) {
        orderBundlesQuery = orderBundlesQuery.in('status', relevantStatuses as any);
      }
    }
    if (filters.memberId) {
      orderBundlesQuery = orderBundlesQuery.eq('created_by', filters.memberId);
    }
    if (filters.dateFrom) {
      orderBundlesQuery = orderBundlesQuery.gte('created_at', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      orderBundlesQuery = orderBundlesQuery.lte('created_at', filters.dateTo.toISOString());
    }

    // Same logic for limit
    if (limit && !showSupplierOrders) {
      orderBundlesQuery = orderBundlesQuery.limit(limit);
    }

    const { data, error } = await orderBundlesQuery;

    if (error) {
      console.error('Error fetching order bundles:', error);
    } else {
      orderBundles = data || [];
    }
  }

  // 4. Fetch Profiles and Item Counts
  const userIds = new Set<string>();
  const orderIds = new Set<string>();

  supplierOrders.forEach((so: any) => {
    userIds.add(so.order.created_by);
    orderIds.add(so.order.id);
  });
  orderBundles.forEach((order: any) => {
    userIds.add(order.created_by);
    orderIds.add(order.id);
  });

  // Fetch Profiles
  const profilesMap: Record<string, any> = {};
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', Array.from(userIds));

    if (profiles) {
      profiles.forEach(p => {
        profilesMap[p.id] = p;
      });
    }
  }

  // Fetch Items for Counts
  const itemCounts: Record<string, { total: number; bySupplier: Record<string, number> }> = {};
  if (orderIds.size > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, supplier_id')
      .in('order_id', Array.from(orderIds));

    if (items) {
      items.forEach((item: any) => {
        if (!itemCounts[item.order_id]) {
          itemCounts[item.order_id] = { total: 0, bySupplier: {} };
        }
        itemCounts[item.order_id]!.total++;

        if (item.supplier_id) {
          if (!itemCounts[item.order_id]!.bySupplier[item.supplier_id]) {
            itemCounts[item.order_id]!.bySupplier[item.supplier_id] = 0;
          }
          itemCounts[item.order_id]!.bySupplier[item.supplier_id]!++;
        }
      });
    }
  }

  // 5. Transform and Merge
  const historyItems: HistoryItem[] = [];

  // Add Supplier Orders (individual per supplier)
  supplierOrders.forEach((so: any) => {
    const profile = profilesMap[so.order.created_by] || {};
    const name = profile.full_name || 'Unknown';
    const avatar = profile.avatar_url || null;

    const count = itemCounts[so.order.id]?.bySupplier[so.supplier_id] || 0;

    historyItems.push({
      id: so.id,
      type: 'supplier_order',
      displayId: so.order.id.slice(0, 8),
      status: so.status,
      createdAt: so.created_at,
      sentAt: so.sent_at,
      supplier: so.supplier,
      totalItems: count,
      createdBy: {
        name,
        email: '',
        avatarUrl: avatar,
      },
      originalOrderId: so.order.id,
    });
  });

  // Add Order Bundles (draft/review only)
  orderBundles.forEach((order: any) => {
    const profile = profilesMap[order.created_by] || {};
    const name = profile.full_name || 'Unknown';
    const avatar = profile.avatar_url || null;

    const count = itemCounts[order.id]?.total || 0;

    historyItems.push({
      id: order.id,
      type: 'order_bundle',
      displayId: order.id.slice(0, 8),
      status: order.status,
      createdAt: order.created_at,
      sentAt: order.sent_at,
      supplier: null,
      totalItems: count,
      createdBy: {
        name,
        email: '',
        avatarUrl: avatar,
      },
      originalOrderId: order.id,
    });
  });

  const sortedItems = historyItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (limit) {
    return sortedItems.slice(0, limit);
  }

  return sortedItems;
}

export async function getSuppliersForFilter(slug: string) {
  const supabase = await createClient();
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single();
  if (!org) return [];

  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('name');
  return data || [];
}

export async function getMembersForFilter(slug: string) {
  const supabase = await createClient();
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single();

  if (!org) return [];

  const { data: memberships } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('organization_id', org.id);

  if (!memberships || memberships.length === 0) return [];

  const userIds = memberships.map(m => m.user_id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  return profiles || [];
}

/**
 * Client-side action to refresh orders with current filters
 * Used by useRealtimeOrders hook when realtime events occur
 */
export async function refreshHistoryOrders(
  organizationId: string,
  filters: HistoryFilter = {}
): Promise<HistoryItem[]> {
  const supabase = await createClient();

  // Similar logic to getHistoryOrders but using organizationId directly
  const supplierOrderStatuses = ['pending', 'sending', 'sent', 'failed', 'delivered'];
  const orderBundleStatuses = ['draft', 'review'];

  let showSupplierOrders = true;
  let showOrderBundles = true;

  if (filters.status && filters.status.length > 0) {
    const hasSupplierOrderStatus = filters.status.some(s => supplierOrderStatuses.includes(s));
    const hasOrderBundleStatus = filters.status.some(s => orderBundleStatuses.includes(s));

    showSupplierOrders = hasSupplierOrderStatus;
    showOrderBundles = hasOrderBundleStatus;
  }

  // Fetch Supplier Orders
  let supplierOrders: any[] = [];

  if (showSupplierOrders) {
    let supplierOrdersQuery = supabase
      .from('supplier_orders')
      .select(
        `
        id,
        status,
        created_at,
        sent_at,
        supplier_id,
        supplier:suppliers!inner(id, name),
        order:orders!inner(
          id,
          organization_id,
          created_by
        )
      `
      )
      .eq('order.organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (filters.status && filters.status.length > 0) {
      const relevantStatuses = filters.status.filter(s => supplierOrderStatuses.includes(s));
      if (relevantStatuses.length > 0) {
        supplierOrdersQuery = supplierOrdersQuery.in('status', relevantStatuses as any);
      }
    }
    if (filters.supplierId) {
      supplierOrdersQuery = supplierOrdersQuery.eq('supplier_id', filters.supplierId);
    }
    if (filters.memberId) {
      supplierOrdersQuery = supplierOrdersQuery.eq('order.created_by', filters.memberId);
    }
    if (filters.dateFrom) {
      supplierOrdersQuery = supplierOrdersQuery.gte('created_at', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      supplierOrdersQuery = supplierOrdersQuery.lte('created_at', filters.dateTo.toISOString());
    }

    const { data } = await supplierOrdersQuery;
    supplierOrders = data || [];
  }

  // Fetch Order Bundles
  let orderBundles: any[] = [];

  if (showOrderBundles) {
    let orderBundlesQuery = supabase
      .from('orders')
      .select(
        `
        id,
        status,
        created_at,
        sent_at,
        created_by
      `
      )
      .eq('organization_id', organizationId)
      .in('status', ['draft', 'review'])
      .order('created_at', { ascending: false });

    if (filters.status && filters.status.length > 0) {
      const relevantStatuses = filters.status.filter(s => orderBundleStatuses.includes(s));
      if (relevantStatuses.length > 0) {
        orderBundlesQuery = orderBundlesQuery.in('status', relevantStatuses as any);
      }
    }
    if (filters.memberId) {
      orderBundlesQuery = orderBundlesQuery.eq('created_by', filters.memberId);
    }
    if (filters.dateFrom) {
      orderBundlesQuery = orderBundlesQuery.gte('created_at', filters.dateFrom.toISOString());
    }
    if (filters.dateTo) {
      orderBundlesQuery = orderBundlesQuery.lte('created_at', filters.dateTo.toISOString());
    }

    const { data } = await orderBundlesQuery;
    orderBundles = data || [];
  }

  // Fetch Profiles and Item Counts
  const userIds = new Set<string>();
  const orderIds = new Set<string>();

  supplierOrders.forEach((so: any) => {
    userIds.add(so.order.created_by);
    orderIds.add(so.order.id);
  });
  orderBundles.forEach((order: any) => {
    userIds.add(order.created_by);
    orderIds.add(order.id);
  });

  const profilesMap: Record<string, any> = {};
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', Array.from(userIds));

    if (profiles) {
      profiles.forEach(p => {
        profilesMap[p.id] = p;
      });
    }
  }

  const itemCounts: Record<string, { total: number; bySupplier: Record<string, number> }> = {};
  if (orderIds.size > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('order_id, supplier_id')
      .in('order_id', Array.from(orderIds));

    if (items) {
      items.forEach((item: any) => {
        if (!itemCounts[item.order_id]) {
          itemCounts[item.order_id] = { total: 0, bySupplier: {} };
        }
        itemCounts[item.order_id]!.total++;

        if (item.supplier_id) {
          if (!itemCounts[item.order_id]!.bySupplier[item.supplier_id]) {
            itemCounts[item.order_id]!.bySupplier[item.supplier_id] = 0;
          }
          itemCounts[item.order_id]!.bySupplier[item.supplier_id]!++;
        }
      });
    }
  }

  // Transform and Merge
  const historyItems: HistoryItem[] = [];

  supplierOrders.forEach((so: any) => {
    const profile = profilesMap[so.order.created_by] || {};
    const name = profile.full_name || 'Unknown';
    const avatar = profile.avatar_url || null;

    const count = itemCounts[so.order.id]?.bySupplier[so.supplier_id] || 0;

    historyItems.push({
      id: so.id,
      type: 'supplier_order',
      displayId: so.order.id.slice(0, 8),
      status: so.status,
      createdAt: so.created_at,
      sentAt: so.sent_at,
      supplier: so.supplier,
      totalItems: count,
      createdBy: {
        name,
        email: '',
        avatarUrl: avatar,
      },
      originalOrderId: so.order.id,
    });
  });

  orderBundles.forEach((order: any) => {
    const profile = profilesMap[order.created_by] || {};
    const name = profile.full_name || 'Unknown';
    const avatar = profile.avatar_url || null;

    const count = itemCounts[order.id]?.total || 0;

    historyItems.push({
      id: order.id,
      type: 'order_bundle',
      displayId: order.id.slice(0, 8),
      status: order.status,
      createdAt: order.created_at,
      sentAt: order.sent_at,
      supplier: null,
      totalItems: count,
      createdBy: {
        name,
        email: '',
        avatarUrl: avatar,
      },
      originalOrderId: order.id,
    });
  });

  return historyItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Manually resend a failed supplier order
 * Creates a new job in the queue to retry sending
 */
export async function resendSupplierOrder(
  supplierOrderId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  // 1. Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: 'No autenticado' };
  }

  // 2. Fetch supplier order to verify access
  const { data: supplierOrder, error } = await supabase
    .from('supplier_orders')
    .select(
      `
      id,
      status,
      order:orders!inner(
        id,
        organization_id
      )
    `
    )
    .eq('id', supplierOrderId)
    .single();

  if (error || !supplierOrder) {
    return { success: false, message: 'Pedido no encontrado' };
  }

  // 3. Verify user belongs to organization
  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', (supplierOrder.order as any).organization_id)
    .single();

  if (!membership) {
    return { success: false, message: 'No tienes permiso para reenviar este pedido' };
  }

  // 4. Reset supplier_order status to pending
  const { error: updateError } = await supabase
    .from('supplier_orders')
    .update({
      status: 'pending',
      error_message: null,
    })
    .eq('id', supplierOrderId);

  if (updateError) {
    return { success: false, message: 'Error al actualizar estado del pedido' };
  }

  // 5. Create a new job in the queue
  const { error: jobError } = await supabase.from('jobs').insert({
    type: 'SEND_SUPPLIER_ORDER',
    payload: { supplierOrderId },
    status: 'pending',
    attempts: 0,
  });

  if (jobError) {
    return { success: false, message: 'Error al encolar trabajo de reenvío' };
  }

  return { success: true, message: 'Pedido reencolado para reenvío' };
}
