import { Suspense } from 'react';
import {
  getHistoryOrders,
  getSuppliersForFilter,
  getMembersForFilter,
  HistoryFilter,
} from './actions';
import { HistoryList } from '@/components/history/HistoryList';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Historial de Pedidos',
};

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  // Parse filters
  const filters: HistoryFilter = {
    status:
      resolvedSearchParams.status && resolvedSearchParams.status !== 'all'
        ? [resolvedSearchParams.status as string]
        : undefined,
    supplierId:
      resolvedSearchParams.supplierId && resolvedSearchParams.supplierId !== 'all'
        ? (resolvedSearchParams.supplierId as string)
        : undefined,
    memberId:
      resolvedSearchParams.memberId && resolvedSearchParams.memberId !== 'all'
        ? (resolvedSearchParams.memberId as string)
        : undefined,
    dateFrom: resolvedSearchParams.date ? new Date(resolvedSearchParams.date as string) : undefined,
    // For single date filter, we usually want the whole day.
    // The action handles >= dateFrom. If we want a specific day, we might need dateTo as end of day.
    // Let's adjust this logic if needed. For now, let's assume the action handles exact match or range if provided.
    // If only dateFrom is provided, the action currently does >=.
    // To filter by a specific DAY, we should set dateTo to end of that day.
  };

  if (filters.dateFrom) {
    const start = new Date(filters.dateFrom);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.dateFrom);
    end.setHours(23, 59, 59, 999);

    filters.dateFrom = start;
    filters.dateTo = end;
  }

  // Fetch data in parallel
  const [orders, suppliers, members] = await Promise.all([
    getHistoryOrders(slug, filters),
    getSuppliersForFilter(slug),
    getMembersForFilter(slug),
  ]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Historial de Pedidos</h1>
        <p className="text-stone-500">Revisa el estado y detalle de tus pedidos anteriores.</p>
      </div>

      <HistoryFilters suppliers={suppliers} members={members} />

      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
          </div>
        }
      >
        <HistoryList items={orders} />
      </Suspense>
    </div>
  );
}
