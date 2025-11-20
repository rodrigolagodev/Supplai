import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import Link from 'next/link';

export const metadata = {
  title: 'Registrarse - Pedidos',
  description: 'Crea tu cuenta en Pedidos',
};

export default function RegisterPage() {
  return (
    <div className="mt-8 space-y-6">
      <Suspense fallback={<div className="text-center text-gray-500">Cargando...</div>}>
        <RegisterForm />
      </Suspense>

      <div className="text-center text-sm">
        <span className="text-gray-600">¿Ya tienes cuenta? </span>
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Inicia sesión
        </Link>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center justify-center gap-2"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
