import { getOrganizationBySlug } from '@/lib/auth/session';
import { notFound } from 'next/navigation';
import Link from 'next/link';

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
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          Bienvenido al panel de control de {organization.name}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">Nuevo Pedido</h3>
          <p className="mt-1 text-sm text-gray-500">Crea un nuevo pedido usando voz o texto</p>
          <button className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Crear Pedido
          </button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">Proveedores</h3>
          <p className="mt-1 text-sm text-gray-500">Gestiona tus proveedores</p>
          <Link
            href={`/${slug}/suppliers`}
            className="mt-4 inline-block rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver Proveedores
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-medium text-gray-900">Historial</h3>
          <p className="mt-1 text-sm text-gray-500">Revisa pedidos anteriores</p>
          <button className="mt-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Ver Historial
          </button>
        </div>

        {organization.isAdmin && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900">Equipo</h3>
            <p className="mt-1 text-sm text-gray-500">Gestiona miembros e invitaciones</p>
            <a
              href={`/${slug}/settings/members`}
              className="mt-4 inline-block rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Gestionar Equipo
            </a>
          </div>
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
