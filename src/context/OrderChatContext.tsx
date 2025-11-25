'use client';

import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLocalMessages } from '@/features/orders/hooks/useLocalMessages';
import { useLocalOrder } from '@/features/orders/hooks/useLocalOrder';
import { useSync } from '@/context/SyncContext';
import { LocalMessage } from '@/lib/db/schema';

interface OrderChatContextType {
  orderId: string;
  messages: LocalMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  isProcessing: boolean;
  currentStatus: string;
  processAudio: (audioBlob: Blob) => Promise<void>;
  processTranscription: (result: { transcription: string; audioFileId: string }) => Promise<void>;
  processOrder: () => Promise<void>;
}

const OrderChatContext = createContext<OrderChatContextType | undefined>(undefined);

export function OrderChatProvider({
  children,
  orderId,
  onOrderProcessed,
}: {
  children: React.ReactNode;
  orderId: string;
  organizationId: string;
  initialMessages?: Array<{ id: string; role: string; content: string; [key: string]: unknown }>;
  onOrderProcessed?: (redirectUrl: string) => void;
}) {
  const { messages, addMessage } = useLocalMessages(orderId);
  const { updateStatus } = useLocalOrder(orderId);
  const { syncNow, isOnline } = useSync();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim()) return;

      const userMessage = input;
      setInput(''); // Clear input immediately

      try {
        await addMessage(userMessage, 'user', 'text');
      } catch (err) {
        console.error('Failed to save message:', err);
        setInput(userMessage); // Restore input on error
        toast.error('Error al guardar el mensaje');
      }
    },
    [input, addMessage]
  );

  const processTranscription = useCallback(
    async (result: { transcription: string; audioFileId: string }) => {
      if (result.transcription) {
        await addMessage(result.transcription, 'user', 'text');
      }
    },
    [addMessage]
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      try {
        await addMessage('[Audio]', 'user', 'audio', audioBlob);
      } catch (error) {
        console.error('Error saving audio:', error);
        toast.error('Error al guardar el audio');
      }
    },
    [addMessage]
  );

  const processOrder = useCallback(async () => {
    setIsProcessing(true);
    try {
      await updateStatus('review');

      if (isOnline) {
        toast.info('Sincronizando y procesando...');
        await syncNow();

        try {
          const { processOrderBatch } = await import('@/app/(protected)/orders/actions');
          await processOrderBatch(orderId);
        } catch (e) {
          console.error('Error triggering batch process:', e);
        }
      } else {
        toast.info('Guardado localmente. Se procesará al conectar.');
      }

      if (onOrderProcessed) {
        onOrderProcessed(`/orders/${orderId}/review`);
      }
    } catch (error) {
      console.error('Error processing order:', error);
      toast.error('Error al procesar');
    } finally {
      setIsProcessing(false);
    }
  }, [orderId, onOrderProcessed, isOnline, syncNow, updateStatus]);

  const contextValue = useMemo(
    () => ({
      orderId,
      messages: messages || [],
      input,
      handleInputChange,
      handleSubmit,
      isLoading: isProcessing,
      isProcessing,
      currentStatus: isProcessing ? 'processing' : 'idle',
      processAudio,
      processTranscription,
      processOrder,
    }),
    [
      orderId,
      messages,
      input,
      handleInputChange,
      handleSubmit,
      isProcessing,
      processAudio,
      processTranscription,
      processOrder,
    ]
  );

  return <OrderChatContext.Provider value={contextValue}>{children}</OrderChatContext.Provider>;
}

export function useOrderChat() {
  const context = useContext(OrderChatContext);
  if (context === undefined) {
    throw new Error('useOrderChat must be used within an OrderChatProvider');
  }
  return context;
}
