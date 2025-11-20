import { getSuppliers, deleteSupplier } from '@/lib/actions/suppliers';
import { getOrganizationBySlug } from '@/lib/auth/session';
import Link from 'next/link';
import { SupplierListItem } from '@/components/suppliers/supplier-list-item';
import { notFound } from 'next/navigation';

export default async function SuppliersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getOrganizationBySlug(slug);

  if (!organization) {
    notFound();
  }

  const suppliers = await getSuppliers(slug);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
        {organization.isAdmin && (
          <Link
            href={`/${slug}/suppliers/new`}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Nuevo Proveedor
          </Link>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        {suppliers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hay proveedores registrados.</div>
        ) : (
          <ul role="list" className="divide-y divide-gray-200">
            {suppliers.map(supplier => (
              <SupplierListItem
                key={supplier.id}
                supplier={supplier}
                slug={slug}
                isAdmin={organization.isAdmin}
                onDelete={async () => {
                  'use server';
                  await deleteSupplier(slug, supplier.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
