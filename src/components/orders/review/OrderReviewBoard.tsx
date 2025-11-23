'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, X, CheckCircle2 } from 'lucide-react';
import { SupplierSection } from './SupplierSection';
import { UnclassifiedSection } from './UnclassifiedSection';
import { UnclassifiedBadge } from './UnclassifiedBadge';
import {
  finalizeOrder,
  saveOrderItems,
  cancelOrder,
  deleteOrderItem,
} from '@/app/(protected)/orders/[id]/actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Database } from '@/types/database';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  supplier?: { name: string } | null;
};
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface OrderReviewBoardProps {
  orderId: string;
  initialItems: OrderItem[];
  suppliers: Supplier[];
  userRole: string;
  organizationId: string;
}

export function OrderReviewBoard({
  orderId,
  initialItems,
  suppliers: initialSuppliers,
  userRole,
  organizationId,
}: OrderReviewBoardProps) {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);

  // Sync state with props
  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  // Dialog states
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Group items
  const unclassifiedItems = items.filter(item => !item.supplier_id);
  const itemsBySupplier = suppliers.reduce(
    (acc, supplier) => {
      acc[supplier.id] = items.filter(item => item.supplier_id === supplier.id);
      return acc;
    },
    {} as Record<string, OrderItem[]>
  );

  // Filter visible suppliers
  const visibleSuppliers = suppliers.filter(supplier => {
    if (showAllSuppliers) return true;
    const itemCount = itemsBySupplier[supplier.id]?.length || 0;
    return itemCount > 0;
  });

  // Handlers
  const handleSupplierCreated = (newSupplier?: Supplier) => {
    if (newSupplier) {
      setSuppliers(prev => [...prev, newSupplier]);
      // Automatically show all suppliers so the new empty one is visible for dropping
      setShowAllSuppliers(true);
      toast.success('Proveedor agregado a la lista');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const itemId = active.id as string;
    const supplierId = over.id as string;

    // Local update only
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, supplier_id: supplierId, confidence_score: 1.0 } : item
      )
    );
  };

  const handleUpdateItem = async (itemId: string, data: Partial<OrderItem>) => {
    // Local update only
    setItems(prev => prev.map(item => (item.id === itemId ? { ...item, ...data } : item)));
  };

  const handleDeleteItem = async (itemId: string) => {
    // Optimistic update
    setItems(prev => prev.filter(item => item.id !== itemId));

    try {
      await deleteOrderItem(itemId);
      toast.success('Producto eliminado');
    } catch {
      toast.error('Error al eliminar producto');
    }
  };

  const handleAddItem = async (
    supplierId: string,
    data: { product: string; quantity: number; unit: string }
  ) => {
    // Optimistic update with temp ID
    const tempId = `temp - ${Date.now()} `;
    const tempItem: OrderItem = {
      id: tempId,
      order_id: orderId,
      supplier_id: supplierId,
      product: data.product,
      quantity: data.quantity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unit: data.unit as any, // Cast to match enum
      created_at: new Date().toISOString(),
      confidence_score: 1.0,
      original_text: null,
    };

    setItems(prev => [...prev, tempItem]);
    // We keep items local until save
    toast.success('Producto agregado (pendiente de guardar)');
  };

  const handleSave = async () => {
    setIsFinalizing(true);
    try {
      await saveOrderItems(orderId, items);
      toast.success('Cambios guardados correctamente');
    } catch {
      toast.error('Error al guardar cambios');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinalize = async () => {
    if (unclassifiedItems.length > 0) {
      toast.warning('Aún hay productos sin clasificar');
      return;
    }

    setIsFinalizing(true);
    try {
      const result = await finalizeOrder(orderId, items);
      if (result?.redirectUrl) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(result.redirectUrl as any);
        return;
      }
      toast.success('Pedido finalizado correctamente');
    } catch (error) {
      console.error('Error finalizing order:', error);
      toast.error('Error al finalizar pedido');
      setIsFinalizing(false);
    }
  };

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      await cancelOrder(orderId);
      toast.success('Pedido cancelado');
      router.push('/orders');
    } catch {
      toast.error('Error al cancelar pedido');
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const handleBack = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/orders/new' as any);
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 pb-20">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setShowBackConfirm(true)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 border-destructive/50"
              onClick={() => setShowCancelConfirm(true)}
              disabled={isFinalizing || isCancelling}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar Pedido
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={isFinalizing || isCancelling}>
              Guardar Cambios
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing || isCancelling || unclassifiedItems.length > 0}
            >
              {isFinalizing ? 'Enviando...' : 'Enviar Pedido'}
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Confirmation Dialogs */}
        <Dialog open={showBackConfirm} onOpenChange={setShowBackConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Estás seguro de volver?</DialogTitle>
              <DialogDescription>
                Si vuelves al chat, perderás el progreso de edición actual si no has finalizado.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBackConfirm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBack}>Volver al chat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cancelar pedido?</DialogTitle>
              <DialogDescription>
                Esta acción cancelará el pedido permanentemente. No podrás recuperarlo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
                Volver
              </Button>
              <Button variant="destructive" onClick={handleCancelOrder} disabled={isCancelling}>
                {isCancelling ? 'Cancelando...' : 'Sí, cancelar pedido'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unclassified Section */}
        <UnclassifiedSection
          items={unclassifiedItems}
          onDelete={handleDeleteItem}
          organizationId={organizationId}
          userRole={userRole}
          onSuccess={handleSupplierCreated}
        />

        {/* Suppliers Grid */}
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllSuppliers(!showAllSuppliers)}
              className="text-muted-foreground"
            >
              {showAllSuppliers ? 'Ocultar proveedores vacíos' : 'Mostrar todos los proveedores'}
            </Button>
          </div>

          <div className="grid gap-6">
            {visibleSuppliers.map(supplier => (
              <SupplierSection
                key={supplier.id}
                supplier={supplier}
                items={itemsBySupplier[supplier.id] || []}
                onItemUpdate={handleUpdateItem}
                onAddItem={handleAddItem}
                onDelete={handleDeleteItem}
                isDroppable={true}
              />
            ))}

            {visibleSuppliers.length === 0 && !showAllSuppliers && (
              <div className="text-center py-10 text-muted-foreground">
                <p>No hay proveedores con productos asignados.</p>
                <Button variant="link" onClick={() => setShowAllSuppliers(true)}>
                  Mostrar todos
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="opacity-80 rotate-3 cursor-grabbing">
            <UnclassifiedBadge item={activeItem} onDelete={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
