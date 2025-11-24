import { transcribeAudio as groqTranscribe } from '@/lib/ai/groq';
import type { ITranscriptionAPI, TranscriptionResult } from './ITranscriptionAPI';

/**
 * Groq Whisper implementation of transcription API
 *
 * Uses Groq's Whisper v3 model for high-quality Spanish transcription
 */
export class GroqTranscriptionAPI implements ITranscriptionAPI {
  async transcribe(audioFile: File): Promise<TranscriptionResult> {
    // Delegate to existing Groq implementation
    return groqTranscribe(audioFile);
  }
}
