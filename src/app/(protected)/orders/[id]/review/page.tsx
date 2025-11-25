import { getOrderReview } from '../../actions';
import { OrderReviewClient } from '@/features/orders/components/review/OrderReviewClient';
import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderReviewPage({ params }: PageProps) {
  const { id } = await params;

  let initialData = null;

  try {
    initialData = await getOrderReview(id);

    // Protect against editing sent/archived orders
    if (initialData.order.status === 'sent' || initialData.order.status === 'archived') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/orders/${id}/details` as any);
    }
  } catch (error) {
    console.error('Failed to fetch order review data (possibly offline):', error);
    // We continue with null initialData to let the Client Component handle the offline state
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Revisar Pedido</h1>
        <p className="text-muted-foreground">
          Revisa los productos, edita cantidades y asigna proveedores antes de finalizar.
        </p>
      </div>

      <OrderReviewClient orderId={id} initialData={initialData} />
    </div>
  );
}
