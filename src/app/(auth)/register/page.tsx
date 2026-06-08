import { Suspense } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import Link from 'next/link';

export const metadata = {
  title: 'Registrarse - Supplai',
  description: 'Crea tu cuenta en Supplai',
};

interface RegisterPageProps {
  searchParams: Promise<{ invitation?: string; email?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { invitation } = await searchParams;

  // Open registration is disabled. Only users with a valid invitation token can register.
  if (!invitation) {
    return (
      <div className="mt-8 space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Registro deshabilitado</h1>
        <p className="text-gray-600">
          Supplai está en acceso restringido. Para crear una cuenta necesitas una invitación enviada
          por un administrador.
        </p>
        <div className="space-y-2">
          <Link
            href="/login"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Iniciar sesión
          </Link>
        </div>
        <div>
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
