import { getOrganizationBySlug } from '@/lib/auth/session';
import { notFound } from 'next/navigation';

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

import { getHistoryOrders } from './history/actions';
import { RecentActivityList } from '@/components/dashboard/RecentActivityList';

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  const recentOrders = await getHistoryOrders(slug, {}, 10);

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenido al panel de control de {organization.name}
        </p>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Actividad Reciente</h3>
        </div>
        <RecentActivityList orders={recentOrders} organizationSlug={slug} />
      </div>
    </div>
  );
}
