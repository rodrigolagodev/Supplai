import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getOrganizationBySlug,
  getSessionOrRedirect,
  getUserOrganizations,
} from '@/lib/auth/session';
import { UserMenu } from '@/components/auth/user-menu';
import { OrgSwitcher } from '@/components/auth/org-switcher';

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Home button */}
              <Link
                href={`/${slug}`}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                title="Ir al inicio"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </Link>
              <OrgSwitcher currentOrg={organization} organizations={allOrganizations} />
            </div>
            <UserMenu email={session.email} fullName={session.fullName} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
