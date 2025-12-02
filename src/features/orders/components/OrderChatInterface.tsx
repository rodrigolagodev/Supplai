'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OrderChatProvider } from '@/context/OrderChatContext';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ProcessButton } from './ProcessButton';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { Database } from '@/types/database';
import { ConnectionStatus } from './ConnectionStatus';

type Message = Database['public']['Tables']['order_conversations']['Row'];

interface OrderChatInterfaceProps {
  orderId: string;
  initialMessages: Message[];
  organizationSlug: string;
  organizationId: string;
}

export function OrderChatInterface({
  orderId,
  initialMessages,
  organizationSlug,
  organizationId,
}: OrderChatInterfaceProps) {
  const router = useRouter();

  const handleOrderProcessed = useCallback(
    (redirectUrl: string) => {
      // Navigate to the review page
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(redirectUrl as any);
    },
    [router]
  );

  return (
    <OrderChatProvider
      orderId={orderId}
      initialMessages={initialMessages}
      organizationId={organizationId}
      onOrderProcessed={handleOrderProcessed}
    >
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
        <header className="px-6 py-4 border-b bg-background flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Nuevo Pedido</h1>
            <p className="text-sm text-muted-foreground">
              Graba o escribe los productos que necesitas
            </p>
            <ConnectionStatus />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${organizationSlug}`}>
                <Save className="h-4 w-4 mr-1" />
                Guardar y Salir
              </Link>
            </Button>
            <ProcessButton />
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
              Borrador
            </span>
          </div>
        </header>

        <MessageList />

        <ChatInput />
      </div>
    </OrderChatProvider>
  );
}
