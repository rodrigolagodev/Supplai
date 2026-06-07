/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number; // Groq returns avg_logprob, we normalize it
  }>;
}

const GROQ_TRANSCRIPTION_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Transcribe audio using Groq Whisper.
 *
 * Calls the Groq REST API directly with native fetch + FormData instead of the groq-sdk.
 * The SDK relies on Node stream/multipart internals that hang on the Cloudflare Workers
 * (`workerd`) runtime, causing the upload to time out. Native FormData uploads work
 * correctly on Workers.
 */
export async function transcribeAudio(audioFile: File): Promise<TranscriptionResult> {
  return withRetry(async () => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GROQ_API_KEY environment variable');
    }

    const form = new FormData();
    form.append('file', audioFile, audioFile.name || 'audio.webm');
    form.append('model', 'whisper-large-v3');
    form.append('language', 'es');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(GROQ_TRANSCRIPTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      // Normalize abort (timeout) so withRetry treats it as retriable.
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Groq request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const err = new Error(`Groq API error ${response.status}: ${body.slice(0, 200)}`);
      (err as any).status = response.status;
      throw err;
    }

    const transcription: any = await response.json();

    const segments = transcription.segments || [];
    let totalConfidence = 0;
    const formattedSegments = segments.map((seg: any) => {
      // Whisper returns avg_logprob; convert to a 0-1 probability.
      const confidence = seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.9;
      totalConfidence += confidence;
      return {
        text: seg.text,
        start: seg.start,
        end: seg.end,
        confidence,
      };
    });

    const avgConfidence = segments.length > 0 ? totalConfidence / segments.length : 0.9;

    return {
      text: transcription.text,
      confidence: Math.min(Math.max(avgConfidence, 0), 1),
      duration: transcription.duration || 0,
      segments: formattedSegments,
    };
  });
}

/**
 * Retry helper with exponential backoff. Does not retry client errors (4xx).
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Don't retry on client errors (4xx).
      const status = (error as any).status;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Retrying Groq request (attempt ${i + 1}/${maxRetries}) in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
