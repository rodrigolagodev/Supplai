import { getSessionOrRedirect, getUserOrganizations } from '@/lib/auth/session';
import { OnboardingForm } from '@/components/auth/onboarding-form';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Crear Organización - Pedidos',
  description: 'Crea una nueva organización',
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string }>;
}) {
  const session = await getSessionOrRedirect();
  const params = await searchParams;

  // Check if user already has organizations
  const organizations = await getUserOrganizations();
  const hasOrganizations = organizations.length > 0;

  // If user has organizations but is not an admin in any of them,
  // they cannot create new organizations
  if (hasOrganizations && params.create === 'true') {
    const hasAdminRole = organizations.some(org => org.isAdmin);
    if (!hasAdminRole) {
      // Redirect to their first organization
      const firstOrg = organizations[0];
      if (firstOrg) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        redirect(`/${firstOrg.slug}` as any);
      }
    }
  }

  // If user already has organizations and didn't explicitly request to create one,
  // redirect to dashboard (this handles invited users who got auto-assigned)
  if (hasOrganizations && params.create !== 'true') {
    const firstOrg = organizations[0];
    if (firstOrg) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redirect(`/${firstOrg.slug}` as any);
    }
  }

  const isFirstOrg = organizations.length === 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {isFirstOrg
              ? `¡Bienvenido, ${session.fullName || 'Usuario'}!`
              : 'Crear nueva organización'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isFirstOrg
              ? 'Crea tu primera organización para comenzar a gestionar tus pedidos'
              : 'Agrega otra organización a tu cuenta'}
          </p>
        </div>

        <OnboardingForm />

        {!isFirstOrg && (
          <div className="text-center">
            <Link
              href="/dashboard"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir al Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
