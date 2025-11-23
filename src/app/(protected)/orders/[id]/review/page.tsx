import { getOrderReview } from '../actions';
import { OrderReviewBoard } from '@/components/orders/review/OrderReviewBoard';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderReviewPage({ params }: PageProps) {
  const { id } = await params;
  const { order, items, suppliers, userRole } = await getOrderReview(id);

  // Protect against editing sent/archived orders
  if (order.status === 'sent' || order.status === 'archived') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect(`/orders/${id}/details` as any);
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Revisar Pedido</h1>
        <p className="text-muted-foreground">
          Revisa los productos, edita cantidades y asigna proveedores antes de finalizar.
        </p>
      </div>

      <OrderReviewBoard
        orderId={order.id}
        initialItems={items}
        suppliers={suppliers}
        userRole={userRole}
        organizationId={order.organization_id}
      />
    </div>
  );
}
