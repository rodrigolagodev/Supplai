import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Pedidos</h1>
      <p className="text-lg text-gray-600 mb-8">Automatiza tus pedidos a proveedores con voz</p>

      <div className="flex gap-4">
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 transition-colors"
          >
            Ir al Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Registrarse
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
