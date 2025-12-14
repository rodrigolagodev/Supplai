import { notFound } from 'next/navigation';
import {
  getOrganizationBySlug,
  getSessionOrRedirect,
  getUserOrganizations,
} from '@/lib/auth/session';
import { TopBar, BottomNavBar, FloatingActionButton } from '@/components/navigation';
import { InstallPWABanner } from '@/components/pwa/InstallPWABanner';

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function OrganizationLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;
  const session = await getSessionOrRedirect();

  // Get organization and verify membership
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  // Get all user organizations for the switcher
  const allOrganizations = await getUserOrganizations();

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Top Navigation */}
      <TopBar
        organization={organization}
        organizations={allOrganizations}
        user={{
          email: session.email,
          fullName: session.fullName,
        }}
      />

      {/* Main Content with Safe Area Padding */}
      <main
        className="mx-auto max-w-app px-4 py-6"
        style={{
          paddingTop: 'calc(var(--top-bar-height) + 1.5rem)',
          paddingBottom: 'calc(var(--bottom-nav-height) + 1.5rem)',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNavBar
        currentPath={`/${slug}`}
        organizationSlug={slug}
        isAdmin={organization.isAdmin}
      />

      {/* Floating Action Button (conditional) */}
      <FloatingActionButton currentPath={`/${slug}`} organizationSlug={slug} />

      {/* PWA Install Banner (mobile only) */}
      <InstallPWABanner />
    </div>
  );
}
