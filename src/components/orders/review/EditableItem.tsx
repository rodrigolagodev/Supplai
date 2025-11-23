'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Check, X } from 'lucide-react';
import type { Database } from '@/types/database';

type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface EditableItemProps {
  item: OrderItem;
  onUpdate: (itemId: string, data: Partial<OrderItem>) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
}

export function EditableItem({ item, onUpdate, onDelete }: EditableItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState({
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
  });
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = () => {
    setValues({
      product: item.product,
      quantity: item.quantity,
      unit: item.unit,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (
      values.product === item.product &&
      values.quantity === item.quantity &&
      values.unit === item.unit
    ) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(item.id, {
        product: values.product,
        quantity: values.quantity,
        unit: values.unit as Database['public']['Enums']['item_unit'],
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving item:', error);
      // Optionally show error toast here
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 bg-accent/50 rounded-md animate-in fade-in">
        <div className="w-20">
          <Input
            type="number"
            value={values.quantity}
            onChange={e => setValues({ ...values, quantity: Number(e.target.value) })}
            className="h-8"
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="w-24">
          <select
            value={values.unit}
            onChange={e =>
              setValues({
                ...values,
                unit: e.target.value as Database['public']['Enums']['item_unit'],
              })
            }
            className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            onKeyDown={handleKeyDown}
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
        </div>
        <div className="flex-1">
          <Input
            value={values.product}
            onChange={e => setValues({ ...values, product: e.target.value })}
            className="h-8"
            onKeyDown={handleKeyDown}
            placeholder="Nombre del producto"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-4 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={startEditing}
    >
      <div className="w-16 text-right font-medium text-foreground">{item.quantity}</div>
      <div className="w-20 text-muted-foreground text-sm">{item.unit}</div>
      <div className="flex-1 font-medium text-foreground">{item.product}</div>

      {onDelete && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={e => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
