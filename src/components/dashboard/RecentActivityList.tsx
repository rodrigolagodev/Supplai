'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LiveOrderStatusBadge } from '@/components/orders/LiveOrderStatusBadge';

interface RecentOrder {
  id: string;
  displayId: string;
  status: string;
  createdAt: string;
  type: 'supplier_order' | 'order' | 'order_bundle';
  supplier?: {
    name: string;
  };
}

interface RecentActivityListProps {
  orders: RecentOrder[];
}

export function RecentActivityList({ orders }: RecentActivityListProps) {
  if (!orders || orders.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        No hay actividad reciente. ¡Crea tu primer pedido!
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {orders.map(item => (
        <div key={item.id} className="flex items-center justify-between p-6 hover:bg-gray-50">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">
                {item.type === 'supplier_order' && item.supplier
                  ? item.supplier.name
                  : `Pedido #${item.displayId}`}
              </span>
              {item.type === 'supplier_order' && (
                <span className="text-xs text-gray-500">#{item.displayId}</span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(item.createdAt), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <LiveOrderStatusBadge
              orderId={item.id}
              initialStatus={item.status}
              type={item.type === 'supplier_order' ? 'supplier_order' : 'order'}
            />
            <Button asChild variant="ghost" size="sm">
              <Link
                href={
                  item.type === 'supplier_order'
                    ? `/orders/${item.id}/details`
                    : item.status === 'review'
                      ? `/orders/${item.id}/review`
                      : `/orders/${item.id}`
                }
              >
                {item.status === 'draft' ? 'Continuar' : 'Ver'}
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
