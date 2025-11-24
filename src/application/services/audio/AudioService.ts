import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ITranscriptionAPI } from './ITranscriptionAPI';

export interface AudioUploadResult {
  transcription: string;
  audioFileId: string;
  fromCache: boolean;
}

/**
 * Audio Service
 *
 * Handles audio upload, storage, and transcription with idempotency.
 * Benefits:
 * - Testable (can mock ITranscriptionAPI)
 * - Reusable (can be used in API routes, hooks, batch processing)
 * - Single responsibility (audio processing logic)
 * - Idempotent (deduplicates via SHA-256 hash)
 */
export class AudioService {
  private static readonly MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Groq limit)
  private static readonly STORAGE_BUCKET = 'orders';

  constructor(
    private supabase: SupabaseClient<Database>,
    private transcriptionAPI: ITranscriptionAPI
  ) {}

  /**
   * Upload audio and transcribe it
   *
   * @param audioBlob - Audio blob to process
   * @param orderId - Order ID to associate with audio
   * @returns Transcription result with audio file ID
   */
  async uploadAndTranscribe(audioBlob: Blob, orderId: string): Promise<AudioUploadResult> {
    // 1. Validate size
    this.validateAudioSize(audioBlob);

    // 2. Generate hash for idempotency
    const audioHash = await this.generateBlobHash(audioBlob);

    // 3. Check if already processed
    const existingFile = await this.findExistingByHash(audioHash, orderId);
    if (existingFile) {
      return {
        transcription: existingFile.transcription || '',
        audioFileId: existingFile.id,
        fromCache: true,
      };
    }

    // 4. Upload to storage
    const storagePath = await this.uploadToStorage(audioBlob, orderId, audioHash);

    // 5. Create DB record
    const audioFileId = await this.createAudioRecord(
      orderId,
      storagePath,
      audioHash,
      audioBlob.size
    );

    // 6. Transcribe
    const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type });
    const result = await this.transcriptionAPI.transcribe(audioFile);

    // 7. Update DB with transcription
    await this.updateTranscription(audioFileId, result.text, result.confidence, result.duration);

    return {
      transcription: result.text,
      audioFileId,
      fromCache: false,
    };
  }

  /**
   * Validate audio blob size
   */
  private validateAudioSize(blob: Blob): void {
    if (blob.size > AudioService.MAX_AUDIO_SIZE) {
      throw new Error(
        `Audio size (${(blob.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of ${AudioService.MAX_AUDIO_SIZE / 1024 / 1024}MB`
      );
    }
  }

  /**
   * Generate SHA-256 hash of audio blob for idempotency
   */
  private async generateBlobHash(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if audio with this hash already exists for this order
   */
  private async findExistingByHash(
    hash: string,
    orderId: string
  ): Promise<Database['public']['Tables']['order_audio_files']['Row'] | null> {
    const { data } = await this.supabase
      .from('order_audio_files')
      .select('*')
      .eq('order_id', orderId)
      .eq('audio_hash', hash)
      .maybeSingle();

    return data;
  }

  /**
   * Upload audio blob to Supabase storage
   */
  private async uploadToStorage(blob: Blob, orderId: string, hash: string): Promise<string> {
    const filename = `order-audio/${orderId}/${hash}.webm`;

    const { error } = await this.supabase.storage
      .from(AudioService.STORAGE_BUCKET)
      .upload(filename, blob, {
        contentType: blob.type,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload audio: ${error.message}`);
    }

    return filename;
  }

  /**
   * Create audio file record in database
   */
  private async createAudioRecord(
    orderId: string,
    storagePath: string,
    hash: string,
    fileSize: number
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('order_audio_files')
      .insert({
        order_id: orderId,
        storage_path: storagePath,
        audio_hash: hash,
        file_size_bytes: fileSize,
        processing_status: 'transcribing',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create audio record: ${error?.message || 'Unknown error'}`);
    }

    return data.id;
  }

  /**
   * Update audio record with transcription result
   */
  private async updateTranscription(
    audioFileId: string,
    transcription: string,
    confidence: number,
    duration: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('order_audio_files')
      .update({
        transcription,
        confidence_score: confidence,
        duration_seconds: duration,
        processing_status: 'completed',
        transcribed_at: new Date().toISOString(),
      })
      .eq('id', audioFileId);

    if (error) {
      throw new Error(`Failed to update transcription: ${error.message}`);
    }
  }
}
