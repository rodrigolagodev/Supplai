'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Database } from '@/types/database';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface SupplierListItemProps {
  supplier: Supplier;
  slug: string;
  isAdmin: boolean;
  onDelete: () => void;
}

const categoryLabels: Record<string, string> = {
  fruits_vegetables: 'Frutas y Verduras',
  meats: 'Carnes',
  fish_seafood: 'Pescados y Mariscos',
  dry_goods: 'Secos y Almacén',
  dairy: 'Lácteos',
  beverages: 'Bebidas',
  cleaning: 'Limpieza',
  packaging: 'Descartables',
  other: 'Otro',
};

const contactMethodLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Teléfono',
};

export function SupplierListItem({ supplier, slug, isAdmin, onDelete }: SupplierListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li className="hover:bg-gray-50">
      <div className="px-4 py-4 sm:px-6">
        {/* Header - always visible */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 flex-1 text-left cursor-pointer"
          >
            <div
              className="text-gray-400 transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-label={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-blue-600 truncate">{supplier.name}</p>
              <p className="text-sm text-gray-500">{supplier.email}</p>
            </div>
          </button>
          {isAdmin && (
            <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
              <Link
                href={`/${slug}/suppliers/${supplier.id}`}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Editar
              </Link>
              <form action={onDelete}>
                <button type="submit" className="text-sm text-red-600 hover:text-red-900">
                  Eliminar
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 ml-8 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md border border-gray-200">
            {supplier.phone && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Teléfono</dt>
                <dd className="mt-1 text-sm text-gray-900">{supplier.phone}</dd>
              </div>
            )}

            <div>
              <dt className="text-xs font-medium text-gray-500">Categoría</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {categoryLabels[supplier.category] || supplier.category}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500">Método de Contacto Preferido</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {supplier.preferred_contact_method
                  ? (contactMethodLabels[supplier.preferred_contact_method] || supplier.preferred_contact_method)
                  : 'No especificado'}
              </dd>
            </div>

            {supplier.address && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Dirección</dt>
                <dd className="mt-1 text-sm text-gray-900">{supplier.address}</dd>
              </div>
            )}

            {supplier.custom_keywords && supplier.custom_keywords.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Palabras Clave</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {supplier.custom_keywords.map((keyword, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {keyword}
                    </span>
                  ))}
                </dd>
              </div>
            )}

            {supplier.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500">Notas</dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{supplier.notes}</dd>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
