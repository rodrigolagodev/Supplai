'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

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

interface UseRealtimeOrdersOptions {
  initialOrders: HistoryItem[];
  organizationId: string;
  onRefresh: () => Promise<HistoryItem[]>;
}

/**
 * Hook to subscribe to realtime changes in orders and supplier_orders tables
 * and keep the UI updated without manual refreshes.
 *
 * @param initialOrders - Initial orders from server
 * @param organizationId - Organization ID to filter changes
 * @param onRefresh - Function to call to fetch fresh data when changes occur
 * @returns Current orders list that updates reactively
 */
export function useRealtimeOrders({
  initialOrders,
  organizationId,
  onRefresh,
}: UseRealtimeOrdersOptions) {
  const [orders, setOrders] = useState<HistoryItem[]>(initialOrders);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to refresh data
  const refresh = useCallback(async () => {
    if (isRefreshing) return; // Prevent duplicate refreshes

    setIsRefreshing(true);
    try {
      const freshOrders = await onRefresh();
      setOrders(freshOrders);
    } catch (error) {
      console.error('Error refreshing orders:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to supplier_orders changes
    const supplierOrdersChannel = supabase
      .channel('supplier_orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'supplier_orders',
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    // Subscribe to orders changes (for draft/review status)
    const ordersChannel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(supplierOrdersChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [organizationId, refresh]);

  return { orders, isRefreshing, refresh };
}
