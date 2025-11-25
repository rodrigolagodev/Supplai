import { getSuppliers, deleteSupplier } from '@/lib/actions/suppliers';
import { getOrganizationBySlug } from '@/lib/auth/session';
import Link from 'next/link';
import { SupplierListItem } from '@/features/suppliers/components/supplier-list-item';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

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
        <h1 className="text-2xl font-bold text-foreground">Proveedores</h1>
        {organization.isAdmin && (
          <Button asChild>
            <Link href={`/${slug}/suppliers/new`}>Nuevo Proveedor</Link>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            No hay proveedores registrados.
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border">
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
      </Card>
    </div>
  );
}
