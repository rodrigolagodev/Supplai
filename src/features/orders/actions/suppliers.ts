'use server';

import { getAuthedContext } from '@/lib/auth/context';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database } from '@/types/database';

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
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
});

export async function createQuickSupplier(organizationId: string, formData: FormData) {
  const rawData = {
    name: formData.get('name'),
    email: formData.get('email') || undefined,
    phone: formData.get('phone') || undefined,
    category: formData.get('category'),
  };

  const result = supplierSchema.safeParse(rawData);

  if (!result.success) {
    return { error: result.error.flatten() };
  }

  const { supabase } = await getAuthedContext(organizationId);

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      ...result.data,
      organization_id: organizationId,
    } as unknown as Database['public']['Tables']['suppliers']['Insert'])
    .select()
    .single();

  if (error || !data) {
    console.error('Error creating supplier:', error);
    return { error: { formErrors: ['Error al crear proveedor'], fieldErrors: {} } };
  }

  revalidatePath('/orders');
  return { success: true, supplier: data };
}
