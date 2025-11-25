import { SupplierForm } from '@/features/suppliers/components/supplier-form';
import { getSupplier } from '@/lib/actions/suppliers';
import { getOrganizationBySlug } from '@/lib/auth/session';
import { notFound, redirect } from 'next/navigation';

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  // Only admins can edit suppliers
  if (!organization.isAdmin) {
    redirect(`/${slug}/suppliers`);
  }

  const supplier = await getSupplier(slug, id);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Proveedor</h1>
      <SupplierForm
        slug={slug}
        initialData={{
          ...supplier,
          email: supplier.email ?? '',
          preferred_contact_method: supplier.preferred_contact_method ?? 'email',
          phone: supplier.phone ?? undefined,
          address: supplier.address ?? undefined,
          notes: supplier.notes ?? undefined,
          custom_keywords: supplier.custom_keywords ?? [],
        }}
      />
    </div>
  );
}
