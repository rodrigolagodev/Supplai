'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Package, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  supplier?: { name: string; category: string } | null;
};
type Supplier = Database['public']['Tables']['suppliers']['Row'];
type Order = Database['public']['Tables']['orders']['Row'] & {
  organization?: { slug: string; name: string };
};

interface ReadOnlyOrderViewProps {
  order: Order;
  items: OrderItem[];
  suppliers: Supplier[];
}

export function ReadOnlyOrderView({ order, items, suppliers }: ReadOnlyOrderViewProps) {
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);

  // Group items by supplier
  const itemsBySupplier = suppliers.reduce(
    (acc, supplier) => {
      acc[supplier.id] = items.filter(item => item.supplier_id === supplier.id);
      return acc;
    },
    {} as Record<string, OrderItem[]>
  );

  // Filter visible suppliers (only those with items or show all)
  const visibleSuppliers = suppliers.filter(supplier => {
    if (showAllSuppliers) return true;
    const itemCount = itemsBySupplier[supplier.id]?.length || 0;
    return itemCount > 0;
  });

  // Calculate totals
  const totalProducts = items.length;
  const totalUnits = items.reduce((acc, item) => acc + Number(item.quantity), 0);
  const suppliersWithItems = new Set(items.map(i => i.supplier_id)).size;

  // Get status badge
  const getStatusBadge = () => {
    if (order.status === 'sent') {
      return <Badge className="bg-green-100 text-green-800">Enviado</Badge>;
    }
    if (order.status === 'archived') {
      return <Badge className="bg-gray-100 text-gray-800">Archivado</Badge>;
    }
    return <Badge>{order.status}</Badge>;
  };

  // Map category to Spanish
  const getCategoryName = (category: string) => {
    const categories: Record<string, string> = {
      fruits_vegetables: 'Frutas y Verduras',
      meats: 'Carnes',
      fish_seafood: 'Pescados y Mariscos',
      dry_goods: 'Secos',
      dairy: 'Lácteos',
      beverages: 'Bebidas',
      cleaning: 'Limpieza',
      packaging: 'Empaque',
      other: 'Otros',
    };
    return categories[category] || category;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-end">{getStatusBadge()}</div>

      {/* Order Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Detalle del Pedido</CardTitle>
            <div className="text-sm text-muted-foreground">#{order.id.slice(0, 8)}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Creado</p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(order.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Última actualización</p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(order.updated_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Productos</p>
                <p className="text-sm text-muted-foreground">{totalProducts}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Total Unidades</p>
                <p className="text-sm text-muted-foreground">{totalUnits}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Productos por Proveedor ({suppliersWithItems})</h2>
          {suppliers.length > suppliersWithItems && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllSuppliers(!showAllSuppliers)}
              className="text-muted-foreground"
            >
              {showAllSuppliers ? 'Ocultar proveedores vacíos' : 'Mostrar todos los proveedores'}
            </Button>
          )}
        </div>

        <div className="grid gap-6">
          {visibleSuppliers.map(supplier => {
            const supplierItems = itemsBySupplier[supplier.id] || [];
            const isEmpty = supplierItems.length === 0;

            return (
              <Card key={supplier.id} className={isEmpty ? 'opacity-50' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{supplier.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getCategoryName(supplier.category)}
                      </p>
                    </div>
                    <Badge variant="outline">{supplierItems.length} productos</Badge>
                  </div>
                </CardHeader>
                {supplierItems.length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      {supplierItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.product}</p>
                            {item.original_text && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Original: {item.original_text}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold">
                                {item.quantity} {item.unit}
                              </p>
                              {item.confidence_score && item.confidence_score < 0.8 && (
                                <p className="text-xs text-yellow-600">
                                  Confianza: {Math.round(item.confidence_score * 100)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {visibleSuppliers.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p>No hay productos asignados a proveedores.</p>
              {suppliers.length > 0 && (
                <Button variant="link" onClick={() => setShowAllSuppliers(true)}>
                  Mostrar todos los proveedores
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
