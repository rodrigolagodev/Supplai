'use client';

import { HistoryItem as HistoryItemType } from '@/app/(protected)/[slug]/history/actions';
import { HistoryItem } from './HistoryItem';
import { Inbox } from 'lucide-react';

export function HistoryList({
  items,
  organizationSlug,
}: {
  items: HistoryItemType[];
  organizationSlug: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-stone-500">
        <div className="bg-stone-100 p-4 rounded-full mb-4">
          <Inbox className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-medium text-stone-900">No se encontraron pedidos</h3>
        <p className="text-sm">Intenta ajustar los filtros para ver más resultados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <HistoryItem
          key={`${item.type}-${item.id}`}
          item={item}
          organizationSlug={organizationSlug}
        />
      ))}
    </div>
  );
}
