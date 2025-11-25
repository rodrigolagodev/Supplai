import { db } from '../index';
import { createClient } from '@/lib/supabase/client';

/**
 * Migration to clean legacy audio URLs from IndexedDB
 *
 * Before our fix, audio_url stored full URLs like:
 * "https://...supabase.co/storage/v1/object/public/audio-messages/order-audio/.../file.webm"
 *
 * After our fix, audio_url should store UUIDs (audio_file_id):
 * "047bad66-31a5-495a-b4a8-2de342095692"
 *
 * This migration converts all legacy URLs to UUIDs by looking up the audio_file_id
 * in the order_audio_files table.
 */
export async function cleanLegacyAudioUrls(): Promise<{
  processed: number;
  converted: number;
  failed: number;
}> {
  const supabase = createClient();
  let processed = 0;
  let converted = 0;
  let failed = 0;

  try {
    // Get all audio messages
    const audioMessages = await db.messages.where('type').equals('audio').toArray();

    console.log(`Found ${audioMessages.length} audio messages to check`);

    for (const msg of audioMessages) {
      processed++;

      // Skip if no audio_url or already a UUID
      if (!msg.audio_url) continue;
      if (!msg.audio_url.startsWith('http')) continue; // Already UUID

      console.log(`Converting legacy URL for message ${msg.id}...`);

      try {
        // Extract storage path from URL
        const url = new URL(msg.audio_url);
        const pathParts = url.pathname.split('/');
        const storagePathIndex = pathParts.indexOf('audio-messages');

        if (storagePathIndex === -1) {
          console.warn('Could not parse audio URL:', msg.audio_url);
          failed++;
          continue;
        }

        const storagePath = pathParts.slice(storagePathIndex + 1).join('/');

        // Find the audio_file_id by storage_path
        const { data: audioFile, error } = await supabase
          .from('order_audio_files')
          .select('id')
          .eq('storage_path', storagePath)
          .maybeSingle();

        if (error) {
          console.error('Error querying audio file:', error);
          failed++;
          continue;
        }

        if (!audioFile) {
          console.warn('No audio_file record found for storage path:', storagePath);
          failed++;
          continue;
        }

        // Update message with UUID
        await db.messages.update(msg.id, {
          audio_url: audioFile.id,
        });

        console.log(`✓ Converted message ${msg.id} to use UUID ${audioFile.id}`);
        converted++;
      } catch (error) {
        console.error(`Error processing message ${msg.id}:`, error);
        failed++;
      }
    }

    console.log('\nMigration complete:');
    console.log(`- Processed: ${processed}`);
    console.log(`- Converted: ${converted}`);
    console.log(`- Failed: ${failed}`);

    return { processed, converted, failed };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}
