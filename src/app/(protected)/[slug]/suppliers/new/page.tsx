import { SupplierForm } from '@/features/suppliers/components/supplier-form';
import { getOrganizationBySlug } from '@/lib/auth/session';
import { notFound, redirect } from 'next/navigation';

export default async function NewSupplierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  // Only admins can create suppliers
  if (!organization.isAdmin) {
    redirect(`/${slug}/suppliers`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo Proveedor</h1>
      <SupplierForm slug={slug} />
    </div>
  );
}
