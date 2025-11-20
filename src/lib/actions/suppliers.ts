'use server';

import { createClient } from '@/lib/supabase/server';
import { getOrganizationBySlug } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  preferred_contact_method: z.enum(['whatsapp', 'email', 'phone']),
  category: z.enum([
    'fruits_vegetables',
    'meats',
    'fish_seafood',
    'dry_goods',
    'dairy',
    'beverages',
    'cleaning',
    'packaging',
    'other',
  ]),
  custom_keywords: z.array(z.string()).default([]),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

export async function getSuppliers(slug: string) {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) throw new Error('Organization not found');

  const supabase = await createClient();
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', organization.id)
    .is('deleted_at', null)
    .order('name');

  if (error) throw error;
  return suppliers;
}

export async function getSupplier(slug: string, id: string) {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) throw new Error('Organization not found');

  const supabase = await createClient();
  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organization_id', organization.id)
    .eq('id', id)
    .single();

  if (error) throw error;
  return supplier;
}

export async function createSupplier(slug: string, data: SupplierInput) {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) throw new Error('Organization not found');

  const result = supplierSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.flatten() };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('suppliers').insert({
    ...result.data,
    organization_id: organization.id,
  });

  if (error) throw error;

  revalidatePath(`/${slug}/suppliers`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(`/${slug}/suppliers` as any);
}

export async function updateSupplier(slug: string, id: string, data: SupplierInput) {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) throw new Error('Organization not found');

  const result = supplierSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.flatten() };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('suppliers')
    .update(result.data)
    .eq('id', id)
    .eq('organization_id', organization.id);

  if (error) throw error;

  revalidatePath(`/${slug}/suppliers`);
  revalidatePath(`/${slug}/suppliers/${id}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(`/${slug}/suppliers` as any);
}

export async function deleteSupplier(slug: string, id: string) {
  const organization = await getOrganizationBySlug(slug);
  if (!organization) throw new Error('Organization not found');

  const supabase = await createClient();

  // Soft delete
  const { error } = await supabase
    .from('suppliers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', organization.id);

  if (error) throw error;

  revalidatePath(`/${slug}/suppliers`);
}
