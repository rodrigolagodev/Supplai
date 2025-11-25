'use client';

import { createSupplier, updateSupplier } from '@/lib/actions/suppliers';
import { useForm, type SubmitHandler, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Duplicate schema here for client-side validation or import it if possible.
// Importing from server action file might cause issues if it has 'use server'.
// Better to define a shared schema file, but for now I'll redefine it to match.
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

type FormData = z.infer<typeof supplierSchema>;

// Extended form data to include the textarea input
const formSchema = supplierSchema
  .extend({
    custom_keywords_input: z.string().optional(),
  })
  .omit({ custom_keywords: true });

type FormInputData = z.infer<typeof formSchema>;

interface SupplierFormProps {
  slug: string;
  initialData?: FormData & { id: string };
}

export function SupplierForm({ slug, initialData }: SupplierFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInputData>({
    resolver: zodResolver(formSchema) as Resolver<FormInputData>,
    defaultValues: {
      ...initialData,
      custom_keywords_input: initialData?.custom_keywords?.join(', ') || '',
      preferred_contact_method: initialData?.preferred_contact_method || 'email',
      category: initialData?.category || 'other',
    },
  });

  const onSubmit: SubmitHandler<FormInputData> = async formData => {
    setIsSubmitting(true);
    setError(null);

    // Convert comma-separated keywords to array
    const keywords = formData.custom_keywords_input
      ? formData.custom_keywords_input
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0)
      : [];

    const data: FormData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      notes: formData.notes,
      preferred_contact_method: formData.preferred_contact_method,
      category: formData.category,
      custom_keywords: keywords,
    };

    if (initialData) {
      await updateSupplier(slug, initialData.id, data);
    } else {
      await createSupplier(slug, data);
    }
    // Note: redirect() in the server action will handle navigation
    // No need to set isSubmitting to false as the page will redirect
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 bg-card p-6 rounded-lg shadow border border-border"
    >
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
        {/* Name */}
        <div className="sm:col-span-3">
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Nombre
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="name"
              {...register('name')}
              className="shadow-sm focus:ring-ring focus:border-ring block w-full sm:text-sm border-input rounded-md"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>
        </div>

        {/* Email */}
        <div className="sm:col-span-3">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <div className="mt-1">
            <input
              type="email"
              id="email"
              {...register('email')}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>

        {/* Phone */}
        <div className="sm:col-span-3">
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="phone"
              {...register('phone')}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Category */}
        <div className="sm:col-span-3">
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Categoría
          </label>
          <div className="mt-1">
            <select
              id="category"
              {...register('category')}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="fruits_vegetables">Frutas y Verduras</option>
              <option value="meats">Carnes</option>
              <option value="fish_seafood">Pescados y Mariscos</option>
              <option value="dry_goods">Secos y Almacén</option>
              <option value="dairy">Lácteos</option>
              <option value="beverages">Bebidas</option>
              <option value="cleaning">Limpieza</option>
              <option value="packaging">Descartables</option>
              <option value="other">Otro</option>
            </select>
          </div>
        </div>

        {/* Preferred Contact Method */}
        <div className="sm:col-span-3">
          <label
            htmlFor="preferred_contact_method"
            className="block text-sm font-medium text-gray-700"
          >
            Método de contacto preferido
          </label>
          <div className="mt-1">
            <select
              id="preferred_contact_method"
              {...register('preferred_contact_method')}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            >
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Teléfono</option>
            </select>
          </div>
        </div>

        {/* Address */}
        <div className="sm:col-span-6">
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Dirección
          </label>
          <div className="mt-1">
            <input
              type="text"
              id="address"
              {...register('address')}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="sm:col-span-6">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notas
          </label>
          <div className="mt-1">
            <textarea
              id="notes"
              rows={3}
              {...register('notes')}
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>

        {/* Custom Keywords */}
        <div className="sm:col-span-6">
          <label htmlFor="custom_keywords" className="block text-sm font-medium text-gray-700">
            Palabras Clave Personalizadas
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa palabras o términos separados por comas que el agente usará para identificar y
            asignar automáticamente items a este proveedor. Ejemplo: tomate, cebolla, papa
          </p>
          <div className="mt-2">
            <textarea
              id="custom_keywords"
              rows={4}
              {...register('custom_keywords_input')}
              placeholder="tomate, cebolla, papa, zanahoria..."
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button asChild variant="outline">
          <Link href={`/${slug}/suppliers`}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
