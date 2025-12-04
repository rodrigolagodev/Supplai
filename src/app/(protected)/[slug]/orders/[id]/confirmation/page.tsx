import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderEmailStatus } from '@/components/orders/OrderEmailStatus';

import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>;
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('*, organization:organizations(slug)')
    .eq('id', id)
    .single();

  // If not found as order, check if it's a supplier_order
  if (!order) {
    const { data: supplierOrder } = await supabase
      .from('supplier_orders')
      .select('id')
      .eq('id', id)
      .single();

    if (supplierOrder) {
      // Supplier orders should view details, not confirmation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/${slug}/orders/${id}/details` as any);
    }

    // Neither found, show 404
    notFound();
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*, supplier:suppliers(name)')
    .eq('order_id', id);

  const totalItems = items?.reduce((acc, item) => acc + Number(item.quantity), 0) || 0;
  const supplierCount = new Set(items?.map(i => i.supplier_id)).size;

  return (
    <div className="container mx-auto flex h-[80vh] max-w-lg flex-col items-center justify-center p-4">
      <OrderEmailStatus orderId={id} />
      <Card className="w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">¡Pedido Enviado!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Tu pedido ha sido procesado y enviado correctamente por correo electrónico.
          </p>

          <div className="rounded-lg bg-muted p-4 text-sm">
            <div className="flex justify-between py-2 border-b border-muted-foreground/20">
              <span className="text-muted-foreground">Total Productos:</span>
              <span className="font-medium">{items?.length}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-muted-foreground/20">
              <span className="text-muted-foreground">Total Unidades:</span>
              <span className="font-medium">{totalItems}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Proveedores:</span>
              <span className="font-medium">{supplierCount}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link href={`/${slug}`}>Volver al Dashboard</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href={`/${slug}/orders/${id}/details`}>Ver detalle del pedido</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
