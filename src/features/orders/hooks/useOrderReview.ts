import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { finalizeOrder } from '@/features/orders/actions/send-order';
import { saveOrderItems, deleteOrderItem } from '@/features/orders/actions/items';
import { cancelOrder } from '@/features/orders/actions/cancel-order';
import { Database } from '@/types/database';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  supplier?: { name: string } | null;
};
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface UseOrderReviewProps {
  orderId: string;
  organizationSlug: string;
  initialItems: OrderItem[];
  initialSuppliers: Supplier[];
}

export function useOrderReview({
  orderId,
  organizationSlug,
  initialItems,
  initialSuppliers,
}: UseOrderReviewProps) {
  const router = useRouter();
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);

  // Dialog state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Sync state with props
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

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

  // Group items - memoized
  const unclassifiedItems = useMemo(() => items.filter(item => !item.supplier_id), [items]);

  const itemsBySupplier = useMemo(
    () =>
      suppliers.reduce(
        (acc, supplier) => {
          acc[supplier.id] = items.filter(item => item.supplier_id === supplier.id);
          return acc;
        },
        {} as Record<string, OrderItem[]>
      ),
    [suppliers, items]
  );

  // Filter visible suppliers - memoized to react to showAllSuppliers changes
  const visibleSuppliers = useMemo(() => {
    console.log('[visibleSuppliers] Recalculating with showAllSuppliers:', showAllSuppliers);
    const result = suppliers.filter(supplier => {
      if (showAllSuppliers) return true;
      const itemCount = itemsBySupplier[supplier.id]?.length || 0;
      return itemCount > 0;
    });
    console.log(
      '[visibleSuppliers] Result count:',
      result.length,
      'Total suppliers:',
      suppliers.length
    );
    return result;
  }, [suppliers, showAllSuppliers, itemsBySupplier]);

  // Handlers
  const handleSupplierCreated = (newSupplier?: Supplier) => {
    if (newSupplier) {
      setSuppliers(prev => [...prev, newSupplier]);
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

    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, supplier_id: supplierId, confidence_score: 1.0 } : item
      )
    );
  };

  const handleUpdateItem = async (itemId: string, data: Partial<OrderItem>) => {
    setItems(prev => prev.map(item => (item.id === itemId ? { ...item, ...data } : item)));
  };

  const handleDeleteItem = async (itemId: string) => {
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
    const tempId = `temp-${Date.now()}`;
    const tempItem: OrderItem = {
      id: tempId,
      order_id: orderId,
      supplier_id: supplierId,
      product: data.product,
      quantity: data.quantity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unit: data.unit as any,
      created_at: new Date().toISOString(),
      confidence_score: 1.0,
      original_text: null,
    };

    setItems(prev => [...prev, tempItem]);
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
      const result = await cancelOrder(orderId);

      if (!result.success) {
        toast.error(result.error || 'Error al eliminar pedido');
        return;
      }

      toast.success('Pedido eliminado');
      router.push(`/${organizationSlug}`);
    } catch (error) {
      console.error('Error canceling order:', error);
      toast.error('Error al eliminar el pedido');
    } finally {
      setIsCancelling(false);
    }
  };

  const activeItem = activeId ? items.find(i => i.id === activeId) || null : null;

  return {
    // State
    items,
    suppliers,
    activeId,
    activeItem,
    isFinalizing,
    isCancelling,
    showAllSuppliers,
    setShowAllSuppliers,
    showCancelConfirm,
    setShowCancelConfirm,

    // Computed
    unclassifiedItems,
    itemsBySupplier,
    visibleSuppliers,
    sensors,

    // Handlers
    handleSupplierCreated,
    handleDragStart,
    handleDragEnd,
    handleUpdateItem,
    handleDeleteItem,
    handleAddItem,
    handleSave,
    handleFinalize,
    handleCancelOrder,
  };
}
