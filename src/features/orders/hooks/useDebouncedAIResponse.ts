import { useCallback, useRef, useState, useEffect } from 'react';
import { useSync } from '@/context/SyncContext';
import { toast } from 'sonner';

interface DebouncedAIResponseOptions {
  orderId: string;
  delay?: number;
  onResponse?: (response: string) => void;
}

export function useDebouncedAIResponse({
  orderId,
  delay = 15000, // 15 segundos por defecto
  onResponse,
}: DebouncedAIResponseOptions) {
  const { isOnline } = useSync();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const countdownIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pendingMessagesRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false); // Protección contra ejecución múltiple
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Cancelar timer automáticamente si va offline
  useEffect(() => {
    if (!isOnline && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      setIsWaiting(false);
      setCountdown(0);
      // NO limpiamos pendingMessagesRef - los mensajes siguen en cola
    }
  }, [isOnline]);

  // Note: When reconnecting online with pending messages,
  // the SyncContext will handle syncing, and the main flow will
  // schedule AI responses through normal message handling

  const processPendingMessages = useCallback(async () => {
    // Protección contra ejecución múltiple
    if (isProcessingRef.current) {
      console.log('Ya hay un procesamiento en curso, saltando...');
      return;
    }

    if (pendingMessagesRef.current.length === 0) return;

    isProcessingRef.current = true;

    try {
      // Importar sync dinámicamente
      const { syncPendingItems } = await import('@/lib/db/sync');

      // 1. Sincronizar mensajes locales al servidor primero
      await syncPendingItems();

      // 2. Esperar un poco para asegurar que la sincronización terminó
      await new Promise(resolve => setTimeout(resolve, 500));

      // 3. Importar server action
      const { processBatchMessages } = await import('@/features/orders/actions/process-message');

      // 4. Procesar todos los mensajes de usuario desde el último mensaje de IA
      const response = await processBatchMessages(orderId);

      // 5. Callback con la respuesta (solo si no está vacío)
      if (onResponse && response.summary && response.processedCount > 0) {
        onResponse(response.summary);
      }

      // Limpiar cola
      pendingMessagesRef.current = [];
    } catch (error) {
      console.error('Error processing batch:', error);
      toast.error('Error al procesar mensajes con IA');
    } finally {
      isProcessingRef.current = false;
      setIsWaiting(false);
      setCountdown(0);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
  }, [orderId, onResponse]);

  const scheduleAIResponse = useCallback(
    (messageId: string) => {
      // Solo programar si está online
      if (!isOnline) {
        return;
      }

      // Agregar mensaje a la cola
      pendingMessagesRef.current.push(messageId);
      setIsWaiting(true);
      setCountdown(Math.ceil(delay / 1000));

      // Cancelar timers anteriores
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      // Timer de countdown (para mostrar al usuario)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Timer principal
      timeoutRef.current = setTimeout(() => {
        processPendingMessages();
      }, delay);
    },
    [isOnline, delay, processPendingMessages]
  );

  const cancelWaiting = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    pendingMessagesRef.current = [];
    setIsWaiting(false);
    setCountdown(0);
  }, []);

  const forceProcess = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    await processPendingMessages();
  }, [processPendingMessages]);

  return {
    scheduleAIResponse,
    cancelWaiting,
    forceProcess,
    isWaiting,
    countdown,
    pendingCount: pendingMessagesRef.current.length,
  };
}
