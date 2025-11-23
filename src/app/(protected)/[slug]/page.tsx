import { getOrganizationBySlug } from '@/lib/auth/session';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DashboardPageProps) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    return { title: 'No encontrado' };
  }

  return {
    title: `${organization.name} - Pedidos`,
    description: `Dashboard de ${organization.name}`,
  };
}

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getHistoryOrders } from './history/actions';

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  const recentOrders = await getHistoryOrders(slug, {}, 10);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenido al panel de control de {organization.name}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nuevo Pedido</CardTitle>
            <CardDescription>Crea un nuevo pedido usando voz o texto</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/orders/new">Crear Pedido</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Proveedores</CardTitle>
            <CardDescription>Gestiona tus proveedores</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${slug}/suppliers`}>Ver Proveedores</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial</CardTitle>
            <CardDescription>Revisa pedidos anteriores</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${slug}/history`}>Ver Historial</Link>
            </Button>
          </CardContent>
        </Card>

        {organization.isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Equipo</CardTitle>
              <CardDescription>Gestiona miembros e invitaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${slug}/settings/members`}>Gestionar Equipo</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Actividad Reciente</h3>
        </div>

        {!recentOrders || recentOrders.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No hay actividad reciente. ¡Crea tu primer pedido!
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentOrders.map(item => (
              <div key={item.id} className="flex items-center justify-between p-6 hover:bg-gray-50">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {item.type === 'supplier_order' && item.supplier
                        ? item.supplier.name
                        : `Pedido #${item.displayId}`}
                    </span>
                    {item.type === 'supplier_order' && (
                      <span className="text-xs text-gray-500">#{item.displayId}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
                    ${
                      item.status === 'sent' || item.status === 'delivered'
                        ? 'bg-green-100 text-green-800'
                        : item.status === 'draft'
                          ? 'bg-gray-100 text-gray-800'
                          : item.status === 'review'
                            ? 'bg-yellow-100 text-yellow-800'
                            : item.status === 'sending'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {item.status === 'sent'
                      ? 'Enviado'
                      : item.status === 'delivered'
                        ? 'Entregado'
                        : item.status === 'draft'
                          ? 'Borrador'
                          : item.status === 'review'
                            ? 'Revisión'
                            : item.status === 'sending'
                              ? 'Enviando'
                              : item.status}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={
                        item.type === 'supplier_order'
                          ? `/orders/${item.id}/details`
                          : item.status === 'review'
                            ? `/orders/${item.id}/review`
                            : `/orders/${item.id}`
                      }
                    >
                      {item.status === 'draft' ? 'Continuar' : 'Ver'}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
