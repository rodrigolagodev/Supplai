import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pedidos',
  description: 'Automatiza tus pedidos a proveedores con voz',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
