/* eslint-disable @typescript-eslint/no-explicit-any */
import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  console.warn('Missing GROQ_API_KEY environment variable');
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number; // Groq returns avg_logprob, we'll normalize it
  }>;
}

/**
 * Transcribe audio using Groq Whisper
 * Retries up to 3 times with exponential backoff
 */
export async function transcribeAudio(audioFile: File): Promise<TranscriptionResult> {
  return withRetry(async () => {
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
        language: 'es', // Force Spanish
        response_format: 'verbose_json',
        temperature: 0.0, // Deterministic
      });

      // Calculate average confidence from segments
      // Whisper returns avg_logprob. Convert to 0-1 probability: e^avg_logprob
      // Note: Groq might return different fields, but standard Whisper is avg_logprob
      const segments = (transcription as any).segments || [];

      let totalConfidence = 0;
      const formattedSegments = segments.map((seg: any) => {
        // Convert logprob to probability if needed, or use if provided
        // Groq Whisper v3 often returns high quality text
        // We'll use a simplified confidence metric for now
        const confidence = seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.9;
        totalConfidence += confidence;

        return {
          text: seg.text,
          start: seg.start,
          end: seg.end,
          confidence,
        };
      });

      const avgConfidence = segments.length > 0 ? totalConfidence / segments.length : 0.9; // Default if no segments

      return {
        text: transcription.text,
        confidence: Math.min(Math.max(avgConfidence, 0), 1), // Clamp 0-1
        duration: (transcription as any).duration || 0,
        segments: formattedSegments,
      };
    } catch (error) {
      console.error('Groq transcription error:', error);
      throw error;
    }
  });
}

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Don't retry on client errors (4xx)
      if (error instanceof Error && (error as any).status >= 400 && (error as any).status < 500) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Retrying Groq request (attempt ${i + 1}/${maxRetries}) in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
