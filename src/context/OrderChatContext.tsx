'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Database } from '@/types/database';
import { saveConversationMessage } from '@/app/(protected)/orders/actions';
import { toast } from 'sonner';
import { useOrderLifecycle } from '@/hooks/useOrderLifecycle';

type Message = Database['public']['Tables']['order_conversations']['Row'] & {
  audio_file?: Database['public']['Tables']['order_audio_files']['Row'] | null;
};

interface OrderChatContextType {
  orderId: string | null;
  messages: Message[];
  isProcessing: boolean;
  currentStatus: string; // 'listening' | 'transcribing' | 'parsing' | 'classifying' | 'idle'
  ensureOrderExists: () => Promise<string>;
  addMessage: (
    role: 'user' | 'assistant',
    content: string,
    audioFileId?: string,
    existingOrderId?: string
  ) => Promise<void>;
  processAudio: (audioBlob: Blob) => Promise<void>;
  processTranscription: (result: { transcription: string; audioFileId: string }) => Promise<void>;
  processText: (text: string) => Promise<void>;
  processOrder: () => Promise<void>;
}

const OrderChatContext = createContext<OrderChatContextType | undefined>(undefined);

export function OrderChatProvider({
  children,
  orderId: initialOrderId,
  organizationId,
  initialMessages = [],
  onOrderCreated,
  onOrderProcessed,
}: {
  children: React.ReactNode;
  orderId: string | null;
  organizationId: string;
  initialMessages?: Message[];
  onOrderCreated?: (orderId: string) => void;
  onOrderProcessed?: (redirectUrl: string) => void;
}) {
  // Use centralized order lifecycle hook to prevent race conditions
  const {
    orderId,
    ensureOrderExists: ensureOrderExistsFromHook,
    setOrderId,
  } = useOrderLifecycle(organizationId);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('idle');

  // Initialize orderId from props if provided
  useEffect(() => {
    if (initialOrderId && !orderId) {
      setOrderId(initialOrderId);
    }
  }, [initialOrderId, orderId, setOrderId]);

  /**
   * Internal helper that returns both orderId and creation status
   */
  const ensureOrderExistsInternal = useCallback(async (): Promise<{
    orderId: string;
    wasCreated: boolean;
  }> => {
    const wasCreated = !orderId;
    const currentOrderId = await ensureOrderExistsFromHook();

    return { orderId: currentOrderId, wasCreated };
  }, [orderId, ensureOrderExistsFromHook]);

  /**
   * Public API - returns only orderId for compatibility
   */
  const ensureOrderExists = useCallback(async (): Promise<string> => {
    const { orderId: currentOrderId } = await ensureOrderExistsInternal();
    return currentOrderId;
  }, [ensureOrderExistsInternal]);

  const addMessage = useCallback(
    async (
      role: 'user' | 'assistant',
      content: string,
      audioFileId?: string,
      existingOrderId?: string
    ) => {
      let currentOrderId: string;
      let wasCreated = false;

      // Use provided orderId or ensure one exists
      if (existingOrderId) {
        currentOrderId = existingOrderId;
      } else {
        const result = await ensureOrderExistsInternal();
        currentOrderId = result.orderId;
        wasCreated = result.wasCreated;
      }

      // Generate sequence number based on current message count
      // This ensures chronological ordering even if created_at has clock skew
      const sequenceNumber = messages.length + 1;

      const tempId = crypto.randomUUID();
      const newMessage: Message = {
        id: tempId,
        order_id: currentOrderId,
        role,
        content,
        audio_file_id: audioFileId || null,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, newMessage]);

      try {
        await saveConversationMessage(currentOrderId, role, content, audioFileId, sequenceNumber);

        // Notify parent component about order creation AFTER message is saved
        // This prevents router.replace from interrupting the message flow
        if (wasCreated && onOrderCreated) {
          // Defer to next tick to ensure message is in state
          setTimeout(() => {
            onOrderCreated(currentOrderId);
          }, 0);
        }
      } catch (error) {
        console.error('Failed to save message:', error);
        toast.error('Error al guardar el mensaje');
      }
    },
    [ensureOrderExistsInternal, messages.length, onOrderCreated]
  );

  const processText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      // Just add the message, no processing
      await addMessage('user', text);
    },
    [addMessage]
  );

  const processTranscription = useCallback(
    async (result: { transcription: string; audioFileId: string }) => {
      // The transcription is already done, just add the message
      await addMessage('user', result.transcription, result.audioFileId);
    },
    [addMessage]
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      setCurrentStatus('transcribing');

      try {
        // Ensure order exists before uploading audio
        const currentOrderId = await ensureOrderExists();

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

        // 2. Add user message with audio
        // Pass currentOrderId to prevent race condition (creating duplicate orders)
        await addMessage('user', transcription, audioFileId, currentOrderId);
      } catch (error) {
        console.error('Audio processing error:', error);
        toast.error('Error al procesar el audio');
      } finally {
        setIsProcessing(false);
        setCurrentStatus('idle');
      }
    },
    [ensureOrderExists, addMessage]
  );

  // Process order: ensure there are user messages, lazy create order, call batch processing
  const processOrder = useCallback(async () => {
    // Check for user messages
    const hasUserMessages = messages.some(m => m.role === 'user');
    if (!hasUserMessages) {
      toast.error('No hay mensajes para procesar.');
      return;
    }

    // Ensure order exists
    const currentOrderId = await ensureOrderExists();

    setIsProcessing(true);
    setCurrentStatus('parsing');

    try {
      const { processOrderBatch } = await import('@/app/(protected)/orders/actions');
      const result = await processOrderBatch(currentOrderId);

      if (result.redirectUrl) {
        // Notify parent component to handle navigation
        onOrderProcessed?.(result.redirectUrl);
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
  }, [messages, ensureOrderExists, addMessage, onOrderProcessed]);
  return (
    <OrderChatContext.Provider
      value={{
        orderId,
        messages,
        isProcessing,
        currentStatus,
        ensureOrderExists,
        addMessage,
        processAudio,
        processTranscription,
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
