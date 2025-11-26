'use client';

import { OrderStatusBadge } from './OrderStatusBadge';
import { useRealtimeOrderStatus } from '@/hooks/useRealtimeOrderStatus';

interface LiveOrderStatusBadgeProps {
  orderId: string;
  initialStatus: string;
  type?: 'order' | 'supplier_order';
  className?: string;
}

/**
 * Badge de estado con actualizaciones en tiempo real vía Supabase Realtime
 * Combina el badge presentacional con el hook de Realtime
 *
 * Uso:
 * <LiveOrderStatusBadge
 *   orderId="123"
 *   initialStatus="pending"
 *   type="supplier_order"
 * />
 */
export function LiveOrderStatusBadge({
  orderId,
  initialStatus,
  type = 'supplier_order',
  className,
}: LiveOrderStatusBadgeProps) {
  const currentStatus = useRealtimeOrderStatus({
    orderId,
    initialStatus,
    type,
  });

  return <OrderStatusBadge status={currentStatus} className={className} />;
}
