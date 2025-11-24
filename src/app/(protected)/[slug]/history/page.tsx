import { Suspense } from 'react';
import {
  getHistoryOrders,
  getSuppliersForFilter,
  getMembersForFilter,
  HistoryFilter,
} from './actions';
import { HistoryListContainer } from '@/components/history/HistoryListContainer';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

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

  if (resolvedSearchParams.date) {
    const dateStr = resolvedSearchParams.date as string;
    const parts = dateStr.split('-').map(Number);

    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];

      // Validate that all parts are valid numbers
      if (
        year !== undefined &&
        month !== undefined &&
        day !== undefined &&
        !isNaN(year) &&
        !isNaN(month) &&
        !isNaN(day)
      ) {
        // Construct date in local time (browser/server local)
        // Month is 0-indexed
        const start = new Date(year, month - 1, day);
        start.setHours(0, 0, 0, 0);

        const end = new Date(year, month - 1, day);
        end.setHours(23, 59, 59, 999);

        filters.dateFrom = start;
        filters.dateTo = end;
      }
    }
  }

  // Get organization ID for realtime subscriptions
  const supabase = await createClient();
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single();

  if (!org) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-500">Organización no encontrada</h2>
        </div>
      </div>
    );
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
        <HistoryListContainer initialOrders={orders} organizationId={org.id} filters={filters} />
      </Suspense>
    </div>
  );
}
