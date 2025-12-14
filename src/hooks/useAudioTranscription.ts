import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AudioState,
  AudioError,
  ProcessedRecording,
  TranscriptionResult,
  MAX_RECORDING_DURATION,
  MAX_AUDIO_SIZE,
  MAX_RECORDINGS_PER_HOUR,
} from '@/types/audio';

/**
 * Genera un hash simple de un Blob para idempotencia
 */
async function hashBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validar que el blob no exceda límites
 */
function validateBlob(blob: Blob, duration: number): AudioError | null {
  // Validar tamaño
  if (blob.size > MAX_AUDIO_SIZE) {
    return {
      type: 'size_exceeded',
      maxSize: MAX_AUDIO_SIZE,
      actualSize: blob.size,
    };
  }

  // Validar duración
  if (duration > MAX_RECORDING_DURATION) {
    return {
      type: 'duration_exceeded',
      maxDuration: MAX_RECORDING_DURATION,
      actualDuration: duration,
    };
  }

  return null;
}

/**
 * Rate limiting: verificar cuántas grabaciones en la última hora
 */
function checkRateLimit(processedRecordings: ProcessedRecording[]): AudioError | null {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recentRecordings = processedRecordings.filter(r => r.timestamp > oneHourAgo);

  if (recentRecordings.length >= MAX_RECORDINGS_PER_HOUR) {
    const oldestRecording = recentRecordings[0];
    if (!oldestRecording) {
      return null; // Should never happen, but TypeScript needs this
    }
    const resetAt = new Date(oldestRecording.timestamp + 60 * 60 * 1000);

    return {
      type: 'rate_limit',
      resetAt,
      message: `Has alcanzado el límite de ${MAX_RECORDINGS_PER_HOUR} grabaciones por hora. Intenta después de ${resetAt.toLocaleTimeString()}.`,
    };
  }

  return null;
}

interface UseAudioTranscriptionOptions {
  orderId: string;
  /**
   * Si es false, solo graba y retorna el blob sin transcribir (local-first mode)
   * Si es true o undefined, graba y transcribe automáticamente (legacy mode)
   */
  autoTranscribe?: boolean;
  onSuccess?: (result: TranscriptionResult) => void;
  /**
   * Callback cuando la grabación termina (solo en modo autoTranscribe=false)
   * Recibe el blob grabado y la duración
   */
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  onError?: (error: AudioError) => void;
}

export function useAudioTranscription(options: UseAudioTranscriptionOptions) {
  const { orderId, autoTranscribe = true, onSuccess, onRecordingComplete, onError } = options;

  const [state, setState] = useState<AudioState>({ status: 'idle' });

  // Refs para grabación
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Tracking de grabaciones procesadas (idempotencia + rate limiting)
  const processedRecordingsRef = useRef<ProcessedRecording[]>([]);
  const currentHashRef = useRef<string | null>(null);

  // Flag para evitar ejecución múltiple del callback onRecordingComplete
  const hasProcessedRecordingRef = useRef(false);

  /**
   * Iniciar grabación
   */
  const startRecording = useCallback(async () => {
    try {
      // Verificar rate limit
      const rateLimitError = checkRateLimit(processedRecordingsRef.current);
      if (rateLimitError) {
        setState({ status: 'error', error: rateLimitError, retryable: false });
        onError?.(rateLimitError);
        return;
      }

      // Reset
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      durationRef.current = 0;
      hasProcessedRecordingRef.current = false; // Reset flag para nueva grabación

      // Pedir permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Configurar MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        setState({
          status: 'recorded',
          blob,
          duration,
          size: blob.size,
        });

        // Limpiar stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setState({ status: 'recording', startTime: Date.now(), duration: 0 });

      // Timer para actualizar duración y auto-stop
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        durationRef.current = elapsed;

        setState(prev => (prev.status === 'recording' ? { ...prev, duration: elapsed } : prev));

        // Auto-stop al límite
        if (elapsed >= MAX_RECORDING_DURATION) {
          stopRecording();
        }
      }, 1000);
    } catch {
      const error: AudioError = {
        type: 'microphone_permission',
        message: 'No se pudo acceder al micrófono. Verifica los permisos.',
      };
      setState({ status: 'error', error, retryable: true });
      onError?.(error);
    }
  }, [onError]);

  /**
   * Detener grabación
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  /**
   * Subir y transcribir audio
   */
  const uploadAndTranscribe = useCallback(
    async (blob: Blob, duration: number) => {
      try {
        // 1. Validar
        setState({ status: 'validating', blob });

        const validationError = validateBlob(blob, duration);
        if (validationError) {
          setState({ status: 'error', error: validationError, blob, retryable: false });
          onError?.(validationError);
          return;
        }

        // 2. Hash para idempotencia
        const blobHash = await hashBlob(blob);

        // Verificar si ya procesamos este blob
        const alreadyProcessed = processedRecordingsRef.current.find(r => r.blobHash === blobHash);

        if (alreadyProcessed && alreadyProcessed.transcription) {
          // Ya procesado, retornar resultado cached
          setState({
            status: 'success',
            transcription: alreadyProcessed.transcription,
            audioFileId: '', // No tenemos el ID pero no importa
            duration,
          });
          return;
        }

        currentHashRef.current = blobHash;

        // 3. Upload (orderId is always available with eager creation)
        setState({ status: 'uploading', blob, progress: 0 });

        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('orderId', orderId);

        // Setup timeout for fetch (60 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let response: Response;

        try {
          response = await fetch('/api/process-audio', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // Detectar rate limit de Groq
            if (response.status === 413 || errorData.error?.code === 'rate_limit_exceeded') {
              const error: AudioError = {
                type: 'rate_limit',
                resetAt: new Date(Date.now() + 60 * 60 * 1000), // Estimar 1 hora
                message: 'Límite de transcripción alcanzado. Intenta en 1 hora o usa texto.',
              };
              setState({ status: 'error', error, blob, retryable: false });
              onError?.(error);
              return;
            }

            const error: AudioError = {
              type: 'upload_failed',
              message: errorData.error || 'Error al subir el audio',
              retryCount: 0,
            };
            setState({ status: 'error', error, blob, retryable: true });
            onError?.(error);
            return;
          }

          // Process successful response
          const { transcription, audioFileId } = await response.json();

          // 4. Transcripción exitosa
          setState({
            status: 'success',
            transcription,
            audioFileId,
            duration,
          });

          // Guardar en histórico
          processedRecordingsRef.current.push({
            blobHash,
            timestamp: Date.now(),
            duration,
            size: blob.size,
            transcription,
          });

          // Limpiar grabaciones antiguas (más de 1 hora)
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          processedRecordingsRef.current = processedRecordingsRef.current.filter(
            r => r.timestamp > oneHourAgo
          );

          onSuccess?.({
            transcription,
            audioFileId,
            confidence: 0.9,
            duration,
            orderId,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);

          // Handle abort/timeout
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            const error: AudioError = {
              type: 'upload_failed',
              message: 'La transcripción tardó demasiado. Intenta con un audio más corto.',
              retryCount: 0,
            };
            setState({ status: 'error', error, blob, retryable: true });
            onError?.(error);
            return;
          }

          // Handle network errors
          if (fetchError instanceof TypeError) {
            const error: AudioError = {
              type: 'upload_failed',
              message: 'Error de conexión. Verifica tu internet e intenta de nuevo.',
              retryCount: 0,
            };
            setState({ status: 'error', error, blob, retryable: true });
            onError?.(error);
            return;
          }

          // Re-throw other errors to be caught by outer try-catch
          throw fetchError;
        }
      } catch (err) {
        const error: AudioError = {
          type: 'unknown',
          message: err instanceof Error ? err.message : 'Error desconocido',
        };
        setState({ status: 'error', error, blob, retryable: true });
        onError?.(error);
      }
    },
    [orderId, onSuccess, onError]
  );

  /**
   * Retry después de error
   */
  const retry = useCallback(() => {
    if (state.status === 'error' && state.retryable && state.blob) {
      const duration = durationRef.current;
      uploadAndTranscribe(state.blob, duration);
    }
  }, [state, uploadAndTranscribe]);

  /**
   * Reset a idle
   */
  const reset = useCallback(() => {
    setState({ status: 'idle' });
    currentHashRef.current = null;
    hasProcessedRecordingRef.current = false; // Reset flag
  }, []);

  /**
   * Procesar cuando se graba un blob
   * Si autoTranscribe=true: sube y transcribe automáticamente (legacy mode)
   * Si autoTranscribe=false: solo retorna el blob (local-first mode)
   */
  useEffect(() => {
    if (state.status === 'recorded' && !hasProcessedRecordingRef.current) {
      hasProcessedRecordingRef.current = true; // Marcar como procesado INMEDIATAMENTE

      if (autoTranscribe) {
        uploadAndTranscribe(state.blob, state.duration);
      } else {
        // Modo local-first: solo retornar el blob sin transcribir
        onRecordingComplete?.(state.blob, state.duration);
        // Reset automático para próxima grabación
        setTimeout(() => {
          setState({ status: 'idle' });
          currentHashRef.current = null;
        }, 500);
      }
    }
  }, [state.status, autoTranscribe, uploadAndTranscribe, onRecordingComplete]);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    retry,
    reset,
    isRecording: state.status === 'recording',
    isProcessing:
      state.status === 'validating' ||
      state.status === 'uploading' ||
      state.status === 'transcribing',
    canRetry: state.status === 'error' && state.retryable,
  };
}
