'use client';

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { EditableItem } from './EditableItem';
import type { Database } from '@/types/database';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type OrderItem = Database['public']['Tables']['order_items']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface SupplierSectionProps {
  supplier: Supplier;
  items: OrderItem[];
  onItemUpdate: (itemId: string, data: Partial<OrderItem>) => Promise<void>;
  onAddItem?: (
    supplierId: string,
    data: { product: string; quantity: number; unit: string }
  ) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  isDroppable?: boolean;
}

export function SupplierSection({
  supplier,
  items,
  onItemUpdate,
  onAddItem,
  onDelete,
  isDroppable = false,
}: SupplierSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ product: '', quantity: 1, unit: 'units' });

  const { setNodeRef, isOver } = useDroppable({
    id: supplier.id,
    data: { type: 'supplier', supplierId: supplier.id },
    disabled: !isDroppable,
  });

  const handleAddItem = async () => {
    if (!newItem.product.trim() || !onAddItem) return;

    try {
      await onAddItem(supplier.id, newItem);
      setNewItem({ product: '', quantity: 1, unit: 'units' });
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'transition-colors duration-200',
        isOver ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : ''
      )}
    >
      <CardHeader
        className="py-3 px-4 flex flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" role="img" aria-label="category">
            {getCategoryEmoji(supplier.category as unknown as string | null)}
          </span>
          <div>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {supplier.name}
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {items.length} items
              </span>
            </CardTitle>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-2">
          {items.length === 0 && !isAdding ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
              Arrastra productos aquí para asignarlos a este proveedor
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {items.map(item => (
                <EditableItem
                  key={item.id}
                  item={item}
                  onUpdate={onItemUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}

          {/* Add Item Row */}
          {isAdding ? (
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 animate-in fade-in slide-in-from-top-2">
              <Input
                value={newItem.quantity}
                onChange={e =>
                  setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })
                }
                className="w-20 h-8 text-right"
                type="number"
                min="0"
                autoFocus
              />
              <select
                value={newItem.unit}
                onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                className="h-8 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="units">Unidades</option>
                <option value="kg">Kg</option>
                <option value="g">Gr</option>
                <option value="liters">Lt</option>
                <option value="packages">Paquete</option>
                <option value="boxes">Caja</option>
                <option value="units">Botella</option>
                <option value="units">Lata</option>
              </select>
              <Input
                value={newItem.product}
                onChange={e => setNewItem({ ...newItem, product: e.target.value })}
                className="flex-1 h-8"
                placeholder="Nombre del producto..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddItem();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={handleAddItem} className="h-8 px-3">
                  Agregar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAdding(false)}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-muted-foreground hover:text-primary border border-dashed border-transparent hover:border-primary/20"
              onClick={e => {
                e.stopPropagation();
                setIsAdding(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar producto
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function getCategoryEmoji(category: string | null): string {
  switch (category?.toLowerCase()) {
    case 'fruits_vegetables':
      return '🥬';
    case 'meats':
      return '🥩';
    case 'fish_seafood':
      return '🐟';
    case 'dairy':
      return '🥛';
    case 'dry_goods':
      return '🍞';
    case 'beverages':
      return '🥤';
    case 'cleaning':
      return '🧹';
    case 'packaging':
      return '📦';
    case 'other':
      return '📦';
    default:
      return '📦';
  }
}
