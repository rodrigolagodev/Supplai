'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { UnclassifiedBadge } from './UnclassifiedBadge';
import { CreateSupplierDialog } from './CreateSupplierDialog';
import type { Database } from '@/types/database';

type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface UnclassifiedSectionProps {
  items: OrderItem[];
  onDelete: (itemId: string) => Promise<void>;
  organizationId: string;
  userRole: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess?: (supplier?: any) => void;
}

export function UnclassifiedSection({
  items,
  onDelete,
  organizationId,
  userRole,
  onSuccess,
}: UnclassifiedSectionProps) {
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  if (items.length === 0 && !isAdmin) return null;
  if (items.length === 0) return null; // Don't show empty section even for admins if no items

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <AlertCircle className="h-5 w-5" />
            <CardTitle className="text-base font-medium">
              Productos sin clasificar ({items.length})
            </CardTitle>
          </div>
          {isAdmin && (
            <CreateSupplierDialog organizationId={organizationId} onSuccess={onSuccess} />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Arrastra estos productos al proveedor correspondiente o elimínalos si no son necesarios.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {items.map(item => (
            <UnclassifiedBadge key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
