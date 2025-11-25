import { SupabaseClient } from '@supabase/supabase-js';
import { transcribeAudio } from '@/lib/ai/groq';

export class AudioService {
  constructor(private supabase: SupabaseClient) {}

  async uploadAndTranscribe(audioBlob: Blob, orderId: string) {
    // 1. Generate unique filename
    const fileId = crypto.randomUUID();
    const fileName = `${orderId}/${fileId}.webm`;

    // 2. Upload to Storage
    const { error: uploadError } = await this.supabase.storage
      .from('orders')
      .upload(fileName, audioBlob, {
        contentType: 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload audio file');
    }

    // 3. Create DB record
    const { data: audioFile, error: dbError } = await this.supabase
      .from('order_audio_files')
      .insert({
        order_id: orderId,
        storage_path: fileName,
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      throw new Error('Failed to save audio file record');
    }

    // 4. Transcribe
    try {
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      const transcriptionResult = await transcribeAudio(file);

      return {
        transcription: transcriptionResult.text,
        audioFileId: audioFile.id,
        fromCache: false,
      };
    } catch (error) {
      console.error('Transcription error:', error);
      // Even if transcription fails, we have the audio saved.
      // But the UI expects transcription.
      throw new Error('Failed to transcribe audio');
    }
  }
}
