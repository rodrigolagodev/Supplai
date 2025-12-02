'use client';

import { useOrderReview } from '@/features/orders/hooks/useOrderReview';
import { OrderReviewView } from './OrderReviewView';
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
  organizationSlug: string;
}

export function OrderReviewBoard({
  orderId,
  initialItems,
  suppliers: initialSuppliers,
  userRole,
  organizationId,
  organizationSlug,
}: OrderReviewBoardProps) {
  const orderReviewState = useOrderReview({
    orderId,
    organizationSlug,
    initialItems,
    initialSuppliers,
  });

  return (
    <OrderReviewView
      {...orderReviewState}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      userRole={userRole}
    />
  );
}
