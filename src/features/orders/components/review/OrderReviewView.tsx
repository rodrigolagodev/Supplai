'use client';

import {
  DndContext,
  DragOverlay,
  SensorDescriptor,
  SensorOptions,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { SupplierSection } from './SupplierSection';
import { UnclassifiedSection } from './UnclassifiedSection';
import { UnclassifiedBadge } from './UnclassifiedBadge';
import { ReviewHeader } from './ReviewHeader';
import { ReviewDialogs } from './ReviewDialogs';
import { MobileActions } from './MobileActions';
import { Database } from '@/types/database';
import { StaggerContainer, MotionItem } from '@/components/ui/motion';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
  supplier?: { name: string } | null;
};
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface OrderReviewViewProps {
  // State
  items: OrderItem[];
  suppliers: Supplier[];
  activeId: string | null;
  activeItem: OrderItem | null;
  isFinalizing: boolean;
  isCancelling: boolean;
  showAllSuppliers: boolean;
  setShowAllSuppliers: (show: boolean) => void;
  showCancelConfirm: boolean;
  setShowCancelConfirm: (show: boolean) => void;

  // Computed
  unclassifiedItems: OrderItem[];
  itemsBySupplier: Record<string, OrderItem[]>;
  visibleSuppliers: Supplier[];
  sensors: SensorDescriptor<SensorOptions>[];

  // Handlers
  handleSupplierCreated: (newSupplier?: Supplier) => void;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleUpdateItem: (itemId: string, data: Partial<OrderItem>) => Promise<void>;
  handleDeleteItem: (itemId: string) => Promise<void>;
  handleAddItem: (
    supplierId: string,
    data: { product: string; quantity: number; unit: string }
  ) => Promise<void>;
  handleSave: () => void;
  handleFinalize: () => void;
  handleCancelOrder: () => void;

  // Context
  organizationId: string;
  organizationSlug: string;
  userRole: string;
}

export function OrderReviewView({
  items: _items,
  suppliers: _suppliers,
  activeId: _activeId,
  activeItem,
  isFinalizing,
  isCancelling,
  showAllSuppliers,
  setShowAllSuppliers,
  showCancelConfirm,
  setShowCancelConfirm,
  unclassifiedItems,
  itemsBySupplier,
  visibleSuppliers,
  sensors,
  handleSupplierCreated,
  handleDragStart,
  handleDragEnd,
  handleUpdateItem,
  handleDeleteItem,
  handleAddItem,
  handleSave,
  handleFinalize,
  handleCancelOrder,
  organizationId,
  organizationSlug,
  userRole,
}: OrderReviewViewProps) {
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 pb-20">
        <ReviewHeader
          isFinalizing={isFinalizing}
          isCancelling={isCancelling}
          unclassifiedItemsCount={unclassifiedItems.length}
          organizationSlug={organizationSlug}
          onCancel={() => setShowCancelConfirm(true)}
          onFinalize={handleFinalize}
        />

        <ReviewDialogs
          showCancelConfirm={showCancelConfirm}
          setShowCancelConfirm={setShowCancelConfirm}
          isCancelling={isCancelling}
          onCancelOrder={handleCancelOrder}
        />

        <MobileActions
          isFinalizing={isFinalizing}
          isCancelling={isCancelling}
          unclassifiedItemsCount={unclassifiedItems.length}
          onSave={handleSave}
          onFinalize={handleFinalize}
        />

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
              onClick={() => {
                console.log('[ShowAllSuppliers] Button clicked, current state:', showAllSuppliers);
                console.log('[ShowAllSuppliers] visibleSuppliers before:', visibleSuppliers.length);
                setShowAllSuppliers(!showAllSuppliers);
                console.log(
                  '[ShowAllSuppliers] setShowAllSuppliers called with:',
                  !showAllSuppliers
                );
              }}
              className="text-muted-foreground"
            >
              {showAllSuppliers ? 'Ocultar proveedores vacíos' : 'Mostrar todos los proveedores'}
            </Button>
          </div>

          {/* Suppliers List */}
          <StaggerContainer
            key={showAllSuppliers ? 'all-suppliers' : 'filtered-suppliers'}
            className="space-y-6"
          >
            {(() => {
              console.log(
                '[OrderReviewView] Rendering suppliers list, count:',
                visibleSuppliers.length
              );
              console.log('[OrderReviewView] showAllSuppliers:', showAllSuppliers);
              console.log('[OrderReviewView] Full supplier objects:', visibleSuppliers);
              console.log('[OrderReviewView] First supplier:', visibleSuppliers[0]);
              return visibleSuppliers.map(supplier => (
                <MotionItem key={supplier.id}>
                  <SupplierSection
                    supplier={supplier}
                    items={itemsBySupplier[supplier.id] || []}
                    onItemUpdate={handleUpdateItem}
                    onAddItem={handleAddItem}
                    onDelete={handleDeleteItem}
                    isDroppable={true}
                  />
                </MotionItem>
              ));
            })()}

            {visibleSuppliers.length === 0 && !showAllSuppliers && (
              <div className="text-center py-12 text-muted-foreground">
                <p>No hay proveedores visibles.</p>
                <Button variant="link" onClick={() => setShowAllSuppliers(true)} className="mt-2">
                  Mostrar todos los proveedores
                </Button>
              </div>
            )}
          </StaggerContainer>
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
