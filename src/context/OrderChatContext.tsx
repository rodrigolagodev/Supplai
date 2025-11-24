'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Database } from '@/types/database';
import { saveConversationMessage } from '@/app/(protected)/orders/actions';
import { toast } from 'sonner';

type Message = Database['public']['Tables']['order_conversations']['Row'] & {
  audio_file?: Database['public']['Tables']['order_audio_files']['Row'] | null;
};

interface OrderChatContextType {
  orderId: string;
  messages: Message[];
  isProcessing: boolean;
  currentStatus: string; // 'listening' | 'transcribing' | 'parsing' | 'classifying' | 'idle'
  addMessage: (role: 'user' | 'assistant', content: string, audioFileId?: string) => Promise<void>;
  processAudio: (audioBlob: Blob) => Promise<void>;
  processTranscription: (result: { transcription: string; audioFileId: string }) => Promise<void>;
  processText: (text: string) => Promise<void>;
  processOrder: () => Promise<void>;
}

const OrderChatContext = createContext<OrderChatContextType | undefined>(undefined);

export function OrderChatProvider({
  children,
  orderId,
  initialMessages = [],
  onOrderProcessed,
}: {
  children: React.ReactNode;
  orderId: string;
  organizationId: string;
  initialMessages?: Message[];
  onOrderProcessed?: (redirectUrl: string) => void;
}) {
  // orderId is now always provided (eager creation in page.tsx)
  // No lazy creation needed - orderId never changes during conversation
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('idle');

  const addMessage = useCallback(
    async (role: 'user' | 'assistant', content: string, audioFileId?: string) => {
      // orderId is always available (eager creation)
      // No lazy creation or state changes needed

      const tempId = crypto.randomUUID();
      let sequenceNumber: number;

      // Use functional update to avoid race conditions
      // Calculate sequence number based on ACTUAL current state, not closure
      setMessages(prev => {
        // Generate sequence number based on current message count
        // This ensures chronological ordering even if created_at has clock skew
        sequenceNumber = prev.length + 1;

        const newMessage: Message = {
          id: tempId,
          order_id: orderId,
          role,
          content,
          audio_file_id: audioFileId || null,
          created_at: new Date().toISOString(),
        };

        return [...prev, newMessage];
      });

      try {
        // sequenceNumber is guaranteed to be set from setMessages above
        await saveConversationMessage(orderId, role, content, audioFileId, sequenceNumber!);
      } catch (error) {
        console.error('Failed to save message:', error);
        toast.error('Error al guardar el mensaje');
      }
    },
    [orderId]
  );

  const processText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setIsProcessing(true);
      try {
        // Just add the message, no processing
        await addMessage('user', text);
      } finally {
        setIsProcessing(false);
      }
    },
    [addMessage]
  );

  const processTranscription = useCallback(
    async (result: { transcription: string; audioFileId: string }) => {
      setIsProcessing(true);
      try {
        // The transcription is already done, just add the message
        await addMessage('user', result.transcription, result.audioFileId);
      } finally {
        setIsProcessing(false);
      }
    },
    [addMessage]
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      setCurrentStatus('transcribing');

      try {
        // orderId is always available (eager creation)
        // 1. Upload and transcribe
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('orderId', orderId);

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
        await addMessage('user', transcription, audioFileId);
      } catch (error) {
        console.error('Audio processing error:', error);
        toast.error('Error al procesar el audio');
      } finally {
        setIsProcessing(false);
        setCurrentStatus('idle');
      }
    },
    [orderId, addMessage]
  );

  // Process order: validate user messages and call batch processing
  const processOrder = useCallback(async () => {
    // Check for user messages
    const hasUserMessages = messages.some(m => m.role === 'user');
    if (!hasUserMessages) {
      toast.error('No hay mensajes para procesar.');
      return;
    }

    // orderId is always available (eager creation)
    setIsProcessing(true);
    setCurrentStatus('parsing');

    try {
      const { processOrderBatch } = await import('@/app/(protected)/orders/actions');
      const result = await processOrderBatch(orderId);

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
  }, [messages, orderId, addMessage, onOrderProcessed]);

  // Memoize context value to prevent unnecessary re-renders in child components
  // Only re-create when actual dependencies change
  const contextValue = useMemo(
    () => ({
      orderId,
      messages,
      isProcessing,
      currentStatus,
      addMessage,
      processAudio,
      processTranscription,
      processText,
      processOrder,
    }),
    [
      orderId,
      messages,
      isProcessing,
      currentStatus,
      addMessage,
      processAudio,
      processTranscription,
      processText,
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
