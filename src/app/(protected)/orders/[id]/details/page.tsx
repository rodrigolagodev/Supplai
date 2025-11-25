import { getOrderDetails } from '../../actions';
import { ReadOnlyOrderView } from '@/features/orders/components/review/ReadOnlyOrderView';
import { redirect, notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderDetailsPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const result = await getOrderDetails(id);
    const { order, items, suppliers } = result;

    // Check if this is a supplier order
    const isSupplierOrder = 'isSupplierOrder' in result && result.isSupplierOrder;
    const supplierOrder = 'supplierOrder' in result ? result.supplierOrder : null;

    // If order is not sent or archived, redirect to appropriate page
    if (order.status === 'draft') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/orders/${id}` as any);
    } else if (order.status === 'review') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/orders/${id}/review` as any);
    }

    // Dynamic title and description based on order type
    const title =
      isSupplierOrder && supplierOrder?.supplier
        ? `Pedido a ${supplierOrder.supplier.name}`
        : 'Pedido Enviado';

    const description = isSupplierOrder
      ? 'Detalles del pedido enviado a este proveedor específico.'
      : 'Este pedido ya fue enviado. Los detalles son de solo lectura.';

    return (
      <div className="container mx-auto py-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <ReadOnlyOrderView order={order} items={items} suppliers={suppliers} />
      </div>
    );
  } catch (error) {
    console.error('Error loading order details:', error);
    notFound();
  }
}
