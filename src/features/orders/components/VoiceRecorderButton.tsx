'use client';

import { useEffect } from 'react';

import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { Mic, Square, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecorderButtonProps {
  orderId: string;
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function VoiceRecorderButton({
  orderId,
  onRecordingComplete,
  disabled = false,
  onRecordingStateChange,
}: VoiceRecorderButtonProps) {
  const {
    state,
    startRecording,
    stopRecording,
    retry,
    reset,
    isRecording,
    isProcessing,
    canRetry,
  } = useAudioTranscription({
    orderId,
    autoTranscribe: false, // Modo local-first: solo grabar, no transcribir
    onRecordingComplete: blob => {
      // Pasar el blob al componente padre para procesamiento local-first
      onRecordingComplete(blob);
    },
    onError: error => {
      console.error('Audio recording error:', error);
    },
  });

  // Notify parent when recording state changes
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (state.status === 'error' || state.status === 'success') {
      reset();
      startRecording();
    } else {
      startRecording();
    }
  };

  // Error message display
  const getErrorMessage = () => {
    if (state.status !== 'error') return null;

    const { error } = state;

    switch (error.type) {
      case 'microphone_permission':
        return 'No se pudo acceder al micrófono. Verifica los permisos.';
      case 'size_exceeded':
        return `Audio demasiado grande (${Math.round(error.actualSize / 1024 / 1024)}MB). Máximo ${Math.round(error.maxSize / 1024 / 1024)}MB.`;
      case 'duration_exceeded':
        return `Grabación demasiado larga (${error.actualDuration}s). Máximo ${error.maxDuration}s.`;
      case 'rate_limit':
        return error.message;
      case 'upload_failed':
      case 'transcription_failed':
        return error.message;
      default:
        return 'Error desconocido. Intenta de nuevo.';
    }
  };

  // Status text for processing states
  const getStatusText = () => {
    switch (state.status) {
      case 'validating':
        return 'Validando...';
      case 'uploading':
        return 'Subiendo...';
      case 'transcribing':
        return 'Transcribiendo...';
      default:
        return null;
    }
  };

  const statusText = getStatusText();
  const errorMessage = getErrorMessage();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* Recording time or status text */}
        {isRecording && state.status === 'recording' && (
          <span className="text-red-500 font-mono animate-pulse">{formatTime(state.duration)}</span>
        )}

        {statusText && (
          <span className="text-sm text-muted-foreground animate-pulse">{statusText}</span>
        )}

        {/* Main button */}
        <Button
          size="icon"
          variant={isRecording ? 'destructive' : state.status === 'error' ? 'outline' : 'default'}
          className={cn(
            'h-12 w-12 rounded-full transition-all duration-300 shadow-lg hover:scale-105',
            isRecording && 'ring-4 ring-red-200 scale-110',
            state.status === 'error' && 'ring-4 ring-red-200/50'
          )}
          onClick={handleClick}
          disabled={disabled || isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : state.status === 'error' ? (
            <AlertCircle className="h-6 w-6 text-red-500" />
          ) : isRecording ? (
            <Square className="h-5 w-5 fill-current" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        {/* Retry button */}
        {canRetry && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={e => {
              e.stopPropagation();
              retry();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="text-red-500 text-xs max-w-[200px] text-right">{errorMessage}</div>
      )}
    </div>
  );
}
