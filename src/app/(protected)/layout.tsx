import { redirect } from 'next/navigation';
import { getSessionOrRedirect, getUserOrganizations } from '@/lib/auth/session';
import { SyncProvider } from '@/context/SyncContext';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await getSessionOrRedirect();

  // Check if user has any organizations
  const organizations = await getUserOrganizations();

  if (organizations.length === 0) {
    // User needs to create their first organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    redirect('/onboarding' as any);
  }

  return <SyncProvider>{children}</SyncProvider>;
}
