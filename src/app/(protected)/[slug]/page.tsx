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

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

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
              <Link href={"/orders/new" as any}>
                Crear Pedido
              </Link>
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
              <Link href={`/${slug}/suppliers`}>
                Ver Proveedores
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historial</CardTitle>
            <CardDescription>Revisa pedidos anteriores</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Ver Historial
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
                <Link href={`/${slug}/settings/members`}>
                  Gestionar Equipo
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Placeholder for recent activity */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900">Actividad Reciente</h3>
        <p className="mt-4 text-center text-sm text-gray-500">
          No hay actividad reciente. ¡Crea tu primer pedido!
        </p>
      </div>
    </div>
  );
}
