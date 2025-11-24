/**
 * Transcription API Interface
 *
 * Abstraction for audio-to-text transcription services.
 * Allows swapping between different providers (Groq, OpenAI, etc.)
 */

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  segments: TranscriptionSegment[];
}

/**
 * Transcription API contract
 */
export interface ITranscriptionAPI {
  /**
   * Transcribe audio file to text
   *
   * @param audioFile - Audio file to transcribe
   * @returns Transcription result with text, confidence, and segments
   */
  transcribe(audioFile: File): Promise<TranscriptionResult>;
}
