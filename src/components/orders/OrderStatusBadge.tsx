'use client';

import { cn } from '@/lib/utils';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Componente presentacional para mostrar badges de estado de pedidos
 * Sin lógica de Realtime - solo renderiza el badge con los colores correctos
 */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'sent':
        return {
          label: 'Enviado',
          className: 'bg-green-100 text-green-800',
        };
      case 'delivered':
        return {
          label: 'Entregado',
          className: 'bg-green-100 text-green-800',
        };
      case 'draft':
        return {
          label: 'Borrador',
          className: 'bg-gray-100 text-gray-800',
        };
      case 'review':
        return {
          label: 'Revisión',
          className: 'bg-yellow-100 text-yellow-800',
        };
      case 'sending':
        return {
          label: 'Enviando',
          className: 'bg-blue-100 text-blue-800',
        };
      case 'pending':
        return {
          label: 'Pendiente',
          className: 'bg-orange-100 text-orange-800',
        };
      case 'failed':
        return {
          label: 'Fallido',
          className: 'bg-red-100 text-red-800',
        };
      case 'processing':
        return {
          label: 'Procesando',
          className: 'bg-purple-100 text-purple-800',
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
