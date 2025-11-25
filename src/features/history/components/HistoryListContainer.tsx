'use client';

import { useCallback } from 'react';
import { HistoryList } from './HistoryList';
import { useRealtimeOrders, type HistoryItem } from '@/hooks/useRealtimeOrders';
import { refreshHistoryOrders, type HistoryFilter } from '@/app/(protected)/[slug]/history/actions';

interface HistoryListContainerProps {
  initialOrders: HistoryItem[];
  organizationId: string;
  filters: HistoryFilter;
}

/**
 * Container component that wraps HistoryList with realtime functionality
 * Subscribes to order changes and automatically refreshes the list
 */
export function HistoryListContainer({
  initialOrders,
  organizationId,
  filters,
}: HistoryListContainerProps) {
  // Function to refresh orders when realtime events occur
  const handleRefresh = useCallback(async () => {
    return await refreshHistoryOrders(organizationId, filters);
  }, [organizationId, filters]);

  // Use realtime hook to keep orders updated
  const { orders } = useRealtimeOrders({
    initialOrders,
    organizationId,
    onRefresh: handleRefresh,
  });

  return <HistoryList items={orders} />;
}
