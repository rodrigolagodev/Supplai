import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useLocalMessages } from '@/features/orders/hooks/useLocalMessages';
import { useLocalOrder } from '@/features/orders/hooks/useLocalOrder';
import { syncOrder } from '@/lib/db/sync';
import { useSync } from '@/context/SyncContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useConversationState } from '@/hooks/useConversationState';
import { MessageQueue } from '@/lib/queue/MessageQueue';
import { SendMessageCommand } from '@/lib/queue/commands/SendMessageCommand';
import { CallAICommand } from '@/lib/queue/commands/CallAICommand';

export interface OrderChatLogicProps {
  orderId: string;
  organizationId: string;
  organizationSlug: string;
  onOrderProcessed?: (redirectUrl: string) => void;
}

export function useOrderChatLogic({
  orderId,
  organizationSlug,
  onOrderProcessed,
}: OrderChatLogicProps) {
  const { messages, addMessage, updateMessage } = useLocalMessages(orderId);
  const { updateStatus } = useLocalOrder(orderId);
  const { syncNow } = useSync();
  const isOnline = useNetworkStatus();

  const { state, dispatch } = useConversationState();

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Derived states from State Machine
  const isRecording = state === 'recording';
  const isAssistantTyping = state === 'ai_processing' || state === 'ai_streaming';

  // Protection against multiple audio processing
  const isProcessingAudioRef = useRef(false);

  // Debounce timers
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const typingTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const queueRef = useRef<MessageQueue | undefined>(undefined);

  // Initialize Queue
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
        const pendingMessages = messages?.filter(
          m => m.role === 'user' && m.sync_status === 'pending'
        );

        if (pendingMessages && pendingMessages.length > 0) {
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
      // REMOVED: await updateStatus('review');
      // We don't want to set review status until we are sure processing succeeded.

      if (isOnline) {
        toast.info('Sincronizando y procesando...');

        try {
          // Force sync the order first to ensure it exists on Supabase
          await syncOrder(orderId);
          // Also trigger general sync for messages
          await syncNow();

          // Double check that we don't have pending messages locally
          // This is critical: if we have pending messages, the server won't see them
          const currentPending = messages?.filter(m => m.sync_status === 'pending');
          if (currentPending && currentPending.length > 0) {
            // Try one more time with a small delay
            console.warn(
              `[ProcessOrder] Found ${currentPending.length} pending messages, retrying sync...`
            );
            await new Promise(resolve => setTimeout(resolve, 1500));
            await syncNow();

            // Check again after retry
            const retryPending = messages?.filter(m => m.sync_status === 'pending');
            if (retryPending && retryPending.length > 0) {
              // Instead of failing, just log a warning and continue
              // The server will process whatever messages it has
              console.warn(
                `[ProcessOrder] Still ${retryPending.length} pending messages after retry, proceeding anyway`
              );
            }
          }
        } catch (syncError) {
          console.error('Sync failed before processing:', syncError);
          toast.error('Error de sincronización. Verifica tu conexión.');
          setIsProcessing(false);
          return;
        }

        try {
          // Use the new Use Case via Server Action
          console.log('[ProcessOrder] Calling processOrderBatch for order:', orderId);
          const { processOrderBatch } = await import('@/features/orders/actions/process-message');
          const result = await processOrderBatch(orderId);

          console.log('[ProcessOrder] Result from processOrderBatch:', result);

          if (result.success && result.redirectUrl && onOrderProcessed) {
            console.log(
              '[ProcessOrder] Success! Updating status and redirecting to:',
              result.redirectUrl
            );
            // SUCCESS! Now we update the local status to match server
            await updateStatus('review');
            onOrderProcessed(result.redirectUrl);
            return; // Exit early if redirecting
          }

          if (!result.success) {
            console.error('[ProcessOrder] Processing failed:', result.message);
            toast.error(result.message || 'Error al procesar el pedido');
            // Do NOT update status to review if failed
          } else {
            console.warn('[ProcessOrder] Success but missing redirect info:', {
              hasRedirectUrl: !!result.redirectUrl,
              hasCallback: !!onOrderProcessed,
            });
          }
        } catch (e) {
          console.error('Error triggering batch process:', e);
          toast.error('Error al procesar el pedido');
        }
      } else {
        // Offline mode
        toast.info('Guardado localmente. Se procesará al conectar.');
        // In offline mode, we DO update status because we want to show the "Waiting for connection" screen
        await updateStatus('review');

        if (onOrderProcessed) {
          onOrderProcessed(`/${organizationSlug}/orders/${orderId}/review`);
        }
      }
    } catch (error) {
      console.error('Error processing order:', error);
      toast.error('Error al procesar');
    } finally {
      setIsProcessing(false);
    }
  }, [orderId, onOrderProcessed, isOnline, syncNow, updateStatus, messages, organizationSlug]);

  const pendingCount = useMemo(() => {
    return messages?.filter(m => m.sync_status === 'pending').length || 0;
  }, [messages]);

  return {
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
  };
}
