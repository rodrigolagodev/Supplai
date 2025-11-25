'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

type HistoryFiltersProps = {
  suppliers: { id: string; name: string }[];
  members: { id: string; full_name: string | null }[];
};

export function HistoryFilters({ suppliers, members }: HistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local state for filters
  const [status, setStatus] = useState<string>(searchParams.get('status') || 'all');
  const [supplierId, setSupplierId] = useState<string>(searchParams.get('supplierId') || 'all');
  const [memberId, setMemberId] = useState<string>(searchParams.get('memberId') || 'all');
  const [date, setDate] = useState<string>(searchParams.get('date') || '');

  // Update URL when filters change
  const createQueryString = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all' && value !== '') {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const updateFilter = (name: string, value: string | null) => {
    router.push((pathname + '?' + createQueryString(name, value)) as any);
  };

  // Handlers
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStatus(val);
    updateFilter('status', val);
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSupplierId(val);
    updateFilter('supplierId', val);
  };

  const handleMemberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setMemberId(val);
    updateFilter('memberId', val);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDate(val);
    updateFilter('date', val);
  };

  const clearFilters = () => {
    setStatus('all');
    setSupplierId('all');
    setMemberId('all');
    setDate('');
    router.push(pathname as any);
  };

  const hasActiveFilters =
    status !== 'all' || supplierId !== 'all' || memberId !== 'all' || date !== '';

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-stone-200 shadow-sm mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-stone-900">Filtros</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2 text-stone-500 hover:text-stone-900"
          >
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-stone-500">Estado</label>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={status}
            onChange={handleStatusChange}
          >
            <option value="all">Todos</option>
            <option value="sent">Enviado</option>
            <option value="delivered">Entregado</option>
            <option value="pending">Pendiente</option>
            <option value="draft">Borrador</option>
            <option value="review">En Revisión</option>
          </select>
        </div>

        {/* Supplier Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-stone-500">Proveedor</label>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={supplierId}
            onChange={handleSupplierChange}
          >
            <option value="all">Todos</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Member Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-stone-500">Creado por</label>
          <select
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={memberId}
            onChange={handleMemberChange}
          >
            <option value="all">Todos</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.full_name || 'Usuario sin nombre'}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-stone-500">Fecha</label>
          <Input
            type="date"
            value={date}
            onChange={handleDateChange}
            className="w-full justify-start text-left font-normal"
          />
        </div>
      </div>
    </div>
  );
}
