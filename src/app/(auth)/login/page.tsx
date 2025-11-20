import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import Link from 'next/link';

export const metadata = {
  title: 'Iniciar Sesión - Pedidos',
  description: 'Inicia sesión en tu cuenta de Pedidos',
};

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded-md bg-gray-200" />
      <div className="h-10 animate-pulse rounded-md bg-gray-200" />
      <div className="h-10 animate-pulse rounded-md bg-gray-200" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="mt-8 space-y-6">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>

      <div className="text-center text-sm">
        <span className="text-gray-600">¿No tienes cuenta? </span>
        <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
          Regístrate
        </Link>
      </div>

      <div className="text-center">
        <Link href="/forgot-password" className="text-sm text-gray-600 hover:text-gray-500">
          ¿Olvidaste tu contraseña?
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
