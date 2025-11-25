'use client';

import React, { createContext, useContext, useCallback, useMemo, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useLocalMessages } from '@/features/orders/hooks/useLocalMessages';
import { useLocalOrder } from '@/features/orders/hooks/useLocalOrder';
import { useSync } from '@/context/SyncContext';
import { useDebouncedAIResponse } from '@/features/orders/hooks/useDebouncedAIResponse';
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
  processOrder: () => Promise<void>;
  isWaitingForAI: boolean;
  countdown: number;
  pendingCount: number;
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
  const { messages, addMessage, updateMessage } = useLocalMessages(orderId);
  const { updateStatus } = useLocalOrder(orderId);
  const { syncNow, isOnline } = useSync();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Protección contra procesamiento múltiple de audios (solo puede haber uno a la vez)
  const isProcessingAudioRef = useRef(false);

  // Debounced AI response
  const handleAIResponse = useCallback(
    async (response: string) => {
      // Add AI response to local messages
      await addMessage(response, 'assistant', 'text');
    },
    [addMessage]
  );

  const { scheduleAIResponse, isWaiting, countdown, pendingCount } = useDebouncedAIResponse({
    orderId,
    delay: 15000, // 15 segundos
    onResponse: handleAIResponse,
  });

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
        // 1. Guardar mensaje localmente (siempre)
        const messageId = await addMessage(userMessage, 'user', 'text');

        // 2. Si online, programar respuesta de IA (debounced)
        if (isOnline) {
          scheduleAIResponse(messageId);
        }
      } catch (err) {
        console.error('Failed to save message:', err);
        setInput(userMessage); // Restore input on error
        toast.error('Error al guardar el mensaje');
      }
    },
    [input, addMessage, isOnline, scheduleAIResponse]
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      // Verificar si ya está procesando un audio
      if (isProcessingAudioRef.current) {
        console.log('Ya hay un audio siendo procesado, saltando duplicado');
        return;
      }

      // Marcar como procesando
      isProcessingAudioRef.current = true;

      try {
        // 1. Guardar audio localmente con placeholder
        const messageId = await addMessage('[Audio]', 'user', 'audio', audioBlob);

        // 2. Si online, transcribir y actualizar mensaje
        if (isOnline) {
          try {
            // Transcribir usando la API existente
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('orderId', orderId);

            const response = await fetch('/api/process-audio', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Error al transcribir audio');
            }

            const result = await response.json();

            // 3. Actualizar mensaje con transcripción y audio_file_id
            // IMPORTANTE:
            // - Guardar audioFileId (UUID) en audio_url (campo local)
            // - En el servidor, audio_url se mapea a audio_file_id (UUID en Supabase)
            // - La URL pública se obtiene dinámicamente desde storage cuando se necesita
            await updateMessage(messageId, {
              content: result.transcription,
              audio_url: result.audioFileId, // UUID del archivo, NO la URL pública
              type: 'audio', // Preservar el tipo
            });

            // 5. Programar respuesta de IA
            scheduleAIResponse(messageId);
          } catch (error) {
            console.error('Error transcribing audio:', error);
            toast.error('Error al transcribir audio, pero se guardó localmente');
          }
        } else {
          // Offline: solo guardar localmente, transcribir después
          toast.info('Audio guardado. Se transcribirá al conectar.');
        }
      } catch (error) {
        console.error('Error saving audio:', error);
        toast.error('Error al guardar el audio');
      } finally {
        // Resetear flag después de procesar (con delay para evitar race conditions)
        setTimeout(() => {
          isProcessingAudioRef.current = false;
        }, 500);
      }
    },
    [addMessage, updateMessage, isOnline, orderId, scheduleAIResponse]
  );

  const processOrder = useCallback(async () => {
    setIsProcessing(true);
    try {
      await updateStatus('review');

      if (isOnline) {
        toast.info('Sincronizando y procesando...');
        await syncNow();

        try {
          const { processOrderBatch } = await import('@/features/orders/actions/process-message');
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
      processOrder,
      isWaitingForAI: isWaiting,
      countdown,
      pendingCount,
    }),
    [
      orderId,
      messages,
      input,
      handleInputChange,
      handleSubmit,
      isProcessing,
      processAudio,
      processOrder,
      isWaiting,
      countdown,
      pendingCount,
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
