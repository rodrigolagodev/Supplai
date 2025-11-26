'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseRealtimeOrderStatusProps {
  orderId: string;
  initialStatus: string;
  type?: 'order' | 'supplier_order';
}

/**
 * Hook para suscribirse a actualizaciones de estado en tiempo real
 * Funciona tanto para orders como supplier_orders
 * Fetch del estado actual al montar para evitar datos obsoletos del SSR
 */
export function useRealtimeOrderStatus({
  orderId,
  initialStatus,
  type = 'supplier_order',
}: UseRealtimeOrderStatusProps) {
  const [status, setStatus] = useState(initialStatus);
  const supabase = createClient();

  useEffect(() => {
    const table = type === 'order' ? 'orders' : 'supplier_orders';

    // Fetch current status on mount to ensure we have the latest data
    const fetchCurrentStatus = async () => {
      const { data, error } = await supabase
        .from(table)
        .select('status')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error(`[Realtime] Error fetching status:`, error);
        return;
      }

      if (data) {
        // Always update, even if same, to ensure we have fresh data
        setStatus(data.status);
      }
    };

    fetchCurrentStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`${table}-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${orderId}`,
        },
        payload => {
          if (payload.new.status) {
            setStatus(payload.new.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, type, supabase]);

  return status;
}
