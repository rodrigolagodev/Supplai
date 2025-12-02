'use client';

import React, { useEffect, useState } from 'react';
import { useLocalOrder } from '@/features/orders/hooks/useLocalOrder';
import { useSync } from '@/context/SyncContext';
import { OrderReviewBoard } from './OrderReviewBoard';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOrderReview } from '@/features/orders/queries/get-order';

interface OrderReviewClientProps {
  orderId: string;
  initialData?: Awaited<ReturnType<typeof getOrderReview>> | null;
}

export function OrderReviewClient({ orderId, initialData }: OrderReviewClientProps) {
  const { order: localOrder } = useLocalOrder(orderId);
  const { isOnline } = useSync();
  const [serverData, setServerData] = useState(initialData);

  // If we have initial data, use it.
  // If not, and we are online, try to fetch it (e.g. after a sync).

  useEffect(() => {
    if (initialData) return;

    const fetchServerData = async () => {
      if (!isOnline) return;

      try {
        const data = await getOrderReview(orderId);
        setServerData(data);
      } catch (error) {
        console.error('Failed to fetch server data:', error);
      }
    };

    fetchServerData();
  }, [orderId, isOnline, initialData, localOrder?.sync_status]);

  // Logic:
  // 1. If we have serverData, show the Board.
  // 2. If not, check localOrder.
  // 3. If localOrder is pending/review, show "Waiting for Processing".

  if (serverData) {
    return (
      <OrderReviewBoard
        orderId={orderId}
        initialItems={serverData.items}
        suppliers={serverData.suppliers}
        userRole={serverData.userRole}
        organizationId={serverData.order.organization_id}
        organizationSlug={serverData.order.organization.slug}
      />
    );
  }

  if (localOrder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 text-center p-4">
        <div className="bg-muted/50 p-6 rounded-full">
          {isOnline ? (
            <RefreshCw className="h-12 w-12 text-primary animate-spin" />
          ) : (
            <WifiOff className="h-12 w-12 text-muted-foreground" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isOnline ? 'Procesando tu pedido...' : 'Esperando conexión'}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {isOnline
              ? 'La Inteligencia Artificial está analizando tus mensajes para generar la lista de productos. Esto puede tomar unos segundos.'
              : 'Tu pedido se ha guardado localmente. En cuanto recuperes la conexión, se procesará automáticamente.'}
          </p>
        </div>

        {isOnline && (
          <div className="flex gap-2">
            <Button disabled={true} variant="outline">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sincronizando
            </Button>
          </div>
        )}

        {!isOnline && (
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recargar página
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
