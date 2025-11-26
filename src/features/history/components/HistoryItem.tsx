'use client';

import { useState } from 'react';
import {
  HistoryItem as HistoryItemType,
  resendSupplierOrder,
} from '@/app/(protected)/[slug]/history/actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { LiveOrderStatusBadge } from '@/components/orders/LiveOrderStatusBadge';

import { LucideIcon } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: 'Borrador', color: 'bg-stone-100 text-stone-700', icon: Package },
  review: { label: 'En Revisión', color: 'bg-amber-100 text-amber-700', icon: Clock },
  pending: { label: 'Pendiente', color: 'bg-blue-100 text-blue-700', icon: Clock },
  sending: { label: 'Enviando', color: 'bg-blue-100 text-blue-700', icon: Truck },
  sent: { label: 'Enviado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Fallido', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export function HistoryItem({ item }: { item: HistoryItemType }) {
  const [expanded, setExpanded] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const config = statusConfig[item.status] || {
    label: item.status,
    color: 'bg-gray-100',
    icon: Package,
  };
  const StatusIcon = config.icon;

  const handleResend = async () => {
    if (item.type !== 'supplier_order') return;

    setIsResending(true);
    try {
      const result = await resendSupplierOrder(item.id);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error resending order:', error);
      toast.error('Error al reenviar pedido');
    } finally {
      setIsResending(false);
    }
  };

  const detailsHref = (
    item.type === 'supplier_order'
      ? `/orders/${item.id}/details`
      : item.status === 'review'
        ? `/orders/${item.originalOrderId}/review`
        : `/orders/${item.originalOrderId}`
  ) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-full ${config.color}`}>
            <StatusIcon className="w-5 h-5" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900">
                {item.supplier ? item.supplier.name : 'Pedido (Bundle)'}
              </span>
              <span className="text-xs text-stone-500">#{item.displayId}</span>
            </div>
            <div className="text-sm text-stone-500 flex items-center gap-2">
              <span>{format(new Date(item.createdAt), "d 'de' MMMM, HH:mm", { locale: es })}</span>
              <span>•</span>
              <span>{item.totalItems} items</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <LiveOrderStatusBadge
            orderId={item.id}
            initialStatus={item.status}
            type={item.type === 'supplier_order' ? 'supplier_order' : 'order'}
          />

          <div className="hidden md:flex items-center gap-2">
            {item.createdBy.avatarUrl ? (
              <img
                src={item.createdBy.avatarUrl}
                alt={item.createdBy.name}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-stone-200 flex items-center justify-center">
                <User className="w-3 h-3 text-stone-500" />
              </div>
            )}
            <span className="text-xs text-stone-500 truncate max-w-[100px]">
              {item.createdBy.name}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-stone-100 bg-stone-50/50">
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-stone-500 mb-1">Detalles del envío</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Enviado:</span>
                  <span className="font-medium">
                    {item.sentAt
                      ? format(new Date(item.sentAt), 'd MMM, HH:mm', { locale: es })
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Creado por:</span>
                  <span className="font-medium">{item.createdBy.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-end gap-2">
              {item.type === 'supplier_order' && item.status === 'failed' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Reenviar
                    </>
                  )}
                </Button>
              )}
              <Link href={detailsHref}>
                <Button size="sm" className="gap-2">
                  {item.type === 'supplier_order'
                    ? 'Ver detalle'
                    : item.status === 'draft'
                      ? 'Continuar pedido'
                      : 'Ver pedido completo'}
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
