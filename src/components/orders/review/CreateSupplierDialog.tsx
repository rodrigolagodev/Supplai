'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createQuickSupplier } from '@/app/(protected)/orders/[id]/actions';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

const supplierSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  category: z.string().min(1, 'La categoría es requerida'),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface CreateSupplierDialogProps {
  organizationId: string;
  onSuccess?: (supplier?: unknown) => void;
}

export function CreateSupplierDialog({ organizationId, onSuccess }: CreateSupplierDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      category: 'other',
    },
  });

  const onSubmit = async (data: SupplierFormValues) => {
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      if (data.email) formData.append('email', data.email);
      if (data.phone) formData.append('phone', data.phone);
      formData.append('category', data.category);

      const result = await createQuickSupplier(organizationId, formData);

      if (result.error) {
        toast.error('Error al crear proveedor');
        return;
      }

      toast.success('Proveedor creado exitosamente');
      setOpen(false);
      reset();
      // No need to refresh if we rely on optimistic updates or parent re-fetch,
      // but for now refresh is safer to see the new supplier in the list
      router.refresh();
      if (result.supplier) {
        onSuccess?.(result.supplier);
      } else {
        onSuccess?.();
      }
    } catch {
      toast.error('Error inesperado');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Proveedor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Proveedor</DialogTitle>
          <DialogDescription>Agrega un nuevo proveedor para asignarle productos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Categoría</Label>
            <select
              id="category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register('category')}
            >
              <option value="fruits_vegetables">Frutas y Verduras</option>
              <option value="meats">Carnes</option>
              <option value="fish_seafood">Pescados y Mariscos</option>
              <option value="dairy">Lácteos</option>
              <option value="dry_goods">Secos y Abarrotes</option>
              <option value="beverages">Bebidas</option>
              <option value="cleaning">Limpieza</option>
              <option value="packaging">Empaques</option>
              <option value="other">Otros</option>
            </select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Proveedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
