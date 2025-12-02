'use client';

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from 'react';
import { toast } from 'sonner';
import { useLocalMessages } from '@/features/orders/hooks/useLocalMessages';
import { useLocalOrder } from '@/features/orders/hooks/useLocalOrder';
import { useSync } from '@/context/SyncContext';
import { LocalMessage } from '@/lib/db/schema';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useConversationState } from '@/hooks/useConversationState';
import { MessageQueue } from '@/lib/queue/MessageQueue';
import { SendMessageCommand } from '@/lib/queue/commands/SendMessageCommand';
import { CallAICommand } from '@/lib/queue/commands/CallAICommand';

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
  sendMessage: (content: string) => Promise<void>;
  isAssistantTyping: boolean;
  pendingCount: number;
  updateTypingActivity: () => void;
  cancelDebounce: () => void;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
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
  const { syncNow } = useSync();
  const isOnline = useNetworkStatus();

  const { state, dispatch } = useConversationState();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Derived states from State Machine
  // const isTyping = state === 'typing'; // Unused
  const isRecording = state === 'recording';
  const isAssistantTyping = state === 'ai_processing' || state === 'ai_streaming';

  // Protección contra procesamiento múltiple de audios (solo puede haber uno a la vez)
  const isProcessingAudioRef = useRef(false);

  // Debounce timers
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const typingTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const queueRef = useRef<MessageQueue | undefined>(undefined);

  useEffect(() => {
    queueRef.current = new MessageQueue({
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      onCommandFailed: (command, error) => {
        toast.error(`Error: ${error.message}`);
      },
    });

    return () => {
      queueRef.current?.clear();
    };
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  // Track user typing activity
  const updateTypingActivity = useCallback(() => {
    dispatch({ type: 'USER_STARTED_TYPING' });

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      dispatch({ type: 'USER_STOPPED_TYPING' });
    }, 1000);
  }, [dispatch]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  // Cancel debounce when user starts typing or recording
  useEffect(() => {
    if ((state === 'typing' || state === 'recording') && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
  }, [state]);

  // Set recording state wrapper
  const setIsRecording = useCallback(
    (value: boolean) => {
      if (value) dispatch({ type: 'USER_STARTED_RECORDING' });
      else dispatch({ type: 'USER_STOPPED_RECORDING' });
    },
    [dispatch]
  );

  // Function to manually cancel debounce
  const cancelDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
  }, []);

  // Sync pending messages when coming back online
  useEffect(() => {
    if (isOnline) {
      const syncPendingMessages = async () => {
        // Find pending user messages
        const pendingMessages = messages?.filter(
          m => m.role === 'user' && m.sync_status === 'pending'
        );

        if (pendingMessages && pendingMessages.length > 0) {
          console.log('Syncing pending messages:', pendingMessages.length);
          // For now, we just trigger a sync. In a real app, we might want to
          // re-send them to the chat API if they haven't been processed.
          // However, since we are moving to immediate send, we should probably
          // retry the chat API call for the last pending message if it wasn't answered.
          // For simplicity in this phase, we'll just rely on the general sync.
          await syncNow();
        }
      };
      syncPendingMessages();
    }
  }, [isOnline, messages, syncNow]);

  // Debounced sendMessage - waits 2.5s after last message before calling AI
  const sendMessage = useCallback(
    async (content: string) => {
      if (!queueRef.current) return;

      // 1. Enqueue SendMessageCommand (User message)
      const sendCmd = new SendMessageCommand({
        orderId,
        content,
        role: 'user',
        type: 'text',
      });

      queueRef.current.enqueue(sendCmd);
      dispatch({ type: 'MESSAGE_QUEUED' });

      if (!isOnline) {
        toast.info('Sin conexión. Mensaje guardado.');
        return;
      }

      // 2. Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 3. Set debounce - enqueue CallAICommand after 2.5s
      debounceTimerRef.current = setTimeout(() => {
        if (!queueRef.current) return;

        dispatch({ type: 'AI_CALL_STARTED' });
        let assistantMessageId: string | null = null;
        let accumulatedContent = '';

        const aiCmd = new CallAICommand({
          orderId,
          onChunk: async chunk => {
            accumulatedContent += chunk;
            dispatch({ type: 'AI_RESPONSE_STREAMING' });

            if (!assistantMessageId) {
              // Create placeholder message on first chunk
              assistantMessageId = await addMessage('', 'assistant', 'text', undefined, {
                status: 'synced',
              });
            }

            // Update the assistant message with new content
            await updateMessage(assistantMessageId, { content: accumulatedContent });
          },
          onComplete: async () => {
            dispatch({ type: 'AI_RESPONSE_COMPLETE' });
          },
        });

        queueRef.current.enqueue(aiCmd);
      }, 2500); // 2.5 second debounce
    },
    [orderId, isOnline, addMessage, updateMessage, dispatch]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim()) return;

      const userMessage = input;
      setInput(''); // Clear input immediately
      await sendMessage(userMessage);
    },
    [input, sendMessage]
  );

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      if (isProcessingAudioRef.current) return;
      isProcessingAudioRef.current = true;

      try {
        const messageId = await addMessage('[Audio]', 'user', 'audio', audioBlob);

        if (isOnline) {
          try {
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('orderId', orderId);

            const response = await fetch('/api/process-audio', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) throw new Error('Error al transcribir audio');

            const result = await response.json();

            await updateMessage(messageId, {
              content: result.transcription,
              audio_url: result.audioFileId,
              type: 'audio',
            });

            // Trigger AI response for the transcription
            await sendMessage(result.transcription);
          } catch (error) {
            console.error('Error transcribing audio:', error);
            toast.error('Error al transcribir, guardado localmente');
          }
        } else {
          toast.info('Audio guardado. Se transcribirá al conectar.');
        }
      } catch (error) {
        console.error('Error saving audio:', error);
        toast.error('Error al guardar el audio');
      } finally {
        setTimeout(() => {
          isProcessingAudioRef.current = false;
        }, 500);
      }
    },
    [addMessage, updateMessage, isOnline, orderId, sendMessage]
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

  const pendingCount = useMemo(() => {
    return messages?.filter(m => m.sync_status === 'pending').length || 0;
  }, [messages]);

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
      sendMessage,
      isAssistantTyping,
      pendingCount,
      updateTypingActivity,
      cancelDebounce,
      isRecording,
      setIsRecording,
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
      isAssistantTyping,
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
