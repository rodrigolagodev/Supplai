'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Database } from '@/types/database';
import { saveConversationMessage } from '@/app/(protected)/orders/actions';
import { toast } from 'sonner';

type Message = Database['public']['Tables']['order_conversations']['Row'] & {
  audio_file?: Database['public']['Tables']['order_audio_files']['Row'] | null;
};

interface OrderChatContextType {
  orderId: string | null;
  messages: Message[];
  isProcessing: boolean;
  currentStatus: string; // 'listening' | 'transcribing' | 'parsing' | 'classifying' | 'idle'
  addMessage: (role: 'user' | 'assistant', content: string, audioFileId?: string) => Promise<void>;
  processAudio: (audioBlob: Blob) => Promise<void>;
  processText: (text: string) => Promise<void>;
  processOrder: () => Promise<void>;
}

const OrderChatContext = createContext<OrderChatContextType | undefined>(undefined);

export function OrderChatProvider({
  children,
  orderId: initialOrderId,
  organizationId,
  initialMessages = [],
}: {
  children: React.ReactNode;
  orderId: string | null;
  organizationId: string;
  initialMessages?: Message[];
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(initialOrderId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('idle');

  const addMessage = useCallback(
    async (role: 'user' | 'assistant', content: string, audioFileId?: string) => {
      // Lazy order creation: if no orderId yet, create it now
      let currentOrderId = orderId;
      if (!currentOrderId) {
        const { createDraftOrder } = await import('@/app/(protected)/orders/actions');
        const newOrder = await createDraftOrder(organizationId);
        currentOrderId = newOrder.id;
        setOrderId(currentOrderId);
        // Update URL to include the order ID
        // router.replace(`/orders/${currentOrderId}` as any); // This is now handled by the component that calls addMessage
      }

      const tempId = crypto.randomUUID();
      const newMessage: Message = {
        id: tempId,
        order_id: currentOrderId,
        role,
        content,
        audio_file_id: audioFileId || null,
        created_at: new Date().toISOString(),
        metadata: {},
      };

      setMessages(prev => [...prev, newMessage]);

      try {
        await saveConversationMessage(currentOrderId, role, content, audioFileId);
      } catch (error) {
        console.error('Failed to save message:', error);
        toast.error('Error al guardar el mensaje');
      }
    },
    [orderId, organizationId]
  );

  const processText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      // Just add the message, no processing
      await addMessage('user', text);
    },
    [addMessage]
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      setCurrentStatus('transcribing');

      try {
        // Lazy order creation happens in addMessage, but we need orderId for audio upload
        // So we need to create it here if not exists
        let currentOrderId = orderId;
        if (!currentOrderId) {
          const { createDraftOrder } = await import('@/app/(protected)/orders/actions');
          const newOrder = await createDraftOrder(organizationId);
          currentOrderId = newOrder.id;
          setOrderId(currentOrderId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.replace(`/orders/${currentOrderId}` as any);
        }

        // 1. Upload and transcribe
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('orderId', currentOrderId);

        const response = await fetch('/api/process-audio', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const status = response.status;
          const statusText = response.statusText;
          const rawText = await response.text();
          console.error(`Server error (${status} ${statusText}):`, rawText);

          let errorMessage = 'Error en la transcripción';
          try {
            const json = JSON.parse(rawText);
            if (json.error) errorMessage = json.error;
          } catch {
            // Not JSON, use status text or generic
            if (status === 413) errorMessage = 'El archivo de audio es demasiado grande';
          }

          throw new Error(errorMessage);
        }

        const { transcription, audioFileId } = await response.json();

        // 2. Add user message with audio (won't create order again since we just did)
        await addMessage('user', transcription, audioFileId);
      } catch (error) {
        console.error('Audio processing error:', error);
        toast.error('Error al procesar el audio');
      } finally {
        setIsProcessing(false);
        setCurrentStatus('idle');
      }
    },
    [orderId, organizationId, router, addMessage]
  );

  // Process order: ensure there are user messages, lazy create order, call batch processing
  const processOrder = useCallback(async () => {
    // Check for user messages
    const hasUserMessages = messages.some(m => m.role === 'user');
    if (!hasUserMessages) {
      toast.error('No hay mensajes para procesar.');
      return;
    }

    // Lazy order creation if needed
    let currentOrderId = orderId;
    if (!currentOrderId) {
      const { createDraftOrder } = await import('@/app/(protected)/orders/actions');
      const newOrder = await createDraftOrder(organizationId);
      currentOrderId = newOrder.id;
      setOrderId(currentOrderId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace(`/orders/${currentOrderId}` as any);
    }

    setIsProcessing(true);
    setCurrentStatus('parsing');

    try {
      const { processOrderBatch } = await import('@/app/(protected)/orders/actions');
      const result = await processOrderBatch(currentOrderId);
      if (result.redirectUrl) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(result.redirectUrl as any);
        return;
      }
      if (result.message) {
        await addMessage('assistant', result.message);
      }
      toast.success('Pedido procesado correctamente');
    } catch (error) {
      console.error('Batch processing error:', error);
      toast.error('Error al procesar el pedido');
      await addMessage(
        'assistant',
        'Hubo un error al procesar el pedido. Por favor intenta de nuevo.'
      );
    } finally {
      setIsProcessing(false);
      setCurrentStatus('idle');
    }
  }, [orderId, messages, organizationId, addMessage, router]);
  return (
    <OrderChatContext.Provider
      value={{
        orderId,
        messages,
        isProcessing,
        currentStatus,
        addMessage,
        processAudio,
        processText,
        processOrder,
      }}
    >
      {children}
    </OrderChatContext.Provider>
  );
}

export function useOrderChat() {
  const context = useContext(OrderChatContext);
  if (context === undefined) {
    throw new Error('useOrderChat must be used within an OrderChatProvider');
  }
  return context;
}
