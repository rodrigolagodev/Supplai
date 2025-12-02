'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface AudioMessageProps {
  audioUrl?: string; // Can be UUID (audio_file_id) or full URL
  audioBlob?: Blob;
  duration?: number;
  syncStatus?: 'pending' | 'synced' | 'failed';
  className?: string;
}

export function AudioMessage({
  audioUrl,
  audioBlob,
  duration,
  syncStatus,
  className,
}: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string>();
  const [publicUrl, setPublicUrl] = useState<string>();
  const [hasError, setHasError] = useState(false);
  const [, setIsLoadingUrl] = useState(false);

  // Create blob URL from blob (priority: always use blob if available)
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setBlobUrl(undefined);
      };
    } else {
      setBlobUrl(undefined);
    }
  }, [audioBlob]);

  // Convert UUID to public URL ONLY if we don't have blob
  // Blob has priority (offline-first)
  useEffect(() => {
    // Skip if we have blob - blob URL is already available
    if (audioBlob) {
      return;
    }

    async function fetchPublicUrl() {
      if (!audioUrl) {
        setPublicUrl(undefined);
        setIsLoadingUrl(false);
        return;
      }

      if (audioUrl.startsWith('http')) {
        // Already a full URL
        setPublicUrl(audioUrl);
        setIsLoadingUrl(false);
        return;
      }

      // audioUrl is a UUID (audio_file_id)

      setIsLoadingUrl(true);

      try {
        const supabase = createClient();
        const { data: audioFile, error } = await supabase
          .from('order_audio_files')
          .select('storage_path')
          .eq('id', audioUrl)
          .single();

        if (error || !audioFile?.storage_path) {
          console.error('[AudioMessage] Failed to fetch audio file:', error);
          setPublicUrl(undefined);
          setIsLoadingUrl(false);
          return;
        }

        const { data } = supabase.storage.from('orders').getPublicUrl(audioFile.storage_path);

        if (data?.publicUrl) {
          setPublicUrl(data.publicUrl);
        } else {
          setPublicUrl(undefined);
        }
      } catch (error) {
        console.error('[AudioMessage] Error fetching public URL:', error);
        setPublicUrl(undefined);
      } finally {
        setIsLoadingUrl(false);
      }
    }

    fetchPublicUrl();
  }, [audioUrl, audioBlob]);

  // PRIORITY: Use local blob first (offline-first principle)
  // Only use public URL if blob is not available (e.g., after page reload)
  const src = blobUrl || publicUrl;

  // Debug: Log src only when it actually changes
  const prevSrcRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
    }
  }, [src, audioBlob]);

  const togglePlay = async () => {
    if (!audioRef.current || !src) {
      console.warn('[AudioMessage] Cannot play: no audio source available', {
        hasAudioRef: !!audioRef.current,
        src,
      });
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error('[AudioMessage] Error playing audio:', error);
        // Reset on error
        setIsPlaying(false);
        setCurrentTime(0);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !duration) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  const handleError = () => {
    console.error('Audio element error - failed to load source');
    setHasError(true);
    setIsPlaying(false);
  };

  // Reset error when src changes
  useEffect(() => {
    if (src) {
      setHasError(false);
    }
  }, [src]);

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Show error state if audio failed to load
  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xs',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="text-xs text-red-600">Audio no disponible</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2 max-w-xs',
        className
      )}
    >
      {src && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onError={handleError}
        />
      )}

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-full shrink-0"
        onClick={togglePlay}
        disabled={!src}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </Button>

      {/* Waveform visualization */}
      <div className="flex-1 h-8 flex items-center gap-0.5 relative">
        {/* Background bars */}
        {Array.from({ length: 30 }).map((_, i) => {
          const height = Math.sin(i * 0.5) * 40 + 50; // Simulated waveform
          const isActive = (i / 30) * 100 < progress;
          return (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-full transition-all',
                isActive ? 'bg-primary' : 'bg-primary/30'
              )}
              style={{
                height: `${height}%`,
              }}
            />
          );
        })}
      </div>

      {/* Duration / Time */}
      <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">
        {formatTime(isPlaying ? currentTime : audioDuration)}
      </span>

      {/* Sync status indicator */}
      {syncStatus === 'pending' && (
        <div className="shrink-0" title="Sincronizando">
          <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
