/**
 * Helper script to manually run migrations from browser console
 *
 * Usage in browser console:
 *
 * import('/lib/db/migrations/runMigration').then(m => m.runAudioUrlMigration())
 *
 * Or add to a debug page/component
 */

import { cleanLegacyAudioUrls } from './cleanLegacyAudioUrls';
import { db } from '../index';

/**
 * Run the audio URL migration manually
 */
export async function runAudioUrlMigration() {
  console.log('🔧 Starting audio URL migration...');

  try {
    const result = await cleanLegacyAudioUrls();

    console.log('✅ Migration completed successfully:');
    console.log(`   - Processed: ${result.processed} messages`);
    console.log(`   - Converted: ${result.converted} messages`);
    console.log(`   - Failed: ${result.failed} messages`);

    // Mark as done
    localStorage.setItem('audio_url_migration_v1_done', 'true');

    return result;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * View all audio messages in IndexedDB
 */
export async function viewAudioMessages() {
  const audioMessages = await db.messages.where('type').equals('audio').toArray();

  console.log(`Found ${audioMessages.length} audio messages:`);

  audioMessages.forEach((msg, index) => {
    console.log(`\n${index + 1}. Message ${msg.id}:`, {
      order_id: msg.order_id,
      audio_url: msg.audio_url,
      has_blob: !!msg.audio_blob,
      content: msg.content.substring(0, 50),
      sync_status: msg.sync_status,
      created_at: msg.created_at,
    });
  });

  return audioMessages;
}

/**
 * Delete all audio messages (use with caution!)
 */
export async function deleteAllAudioMessages() {
  const confirm = window.confirm(
    'Are you sure you want to delete ALL audio messages? This cannot be undone!'
  );

  if (!confirm) {
    console.log('Cancelled');
    return;
  }

  const audioMessages = await db.messages.where('type').equals('audio').toArray();

  for (const msg of audioMessages) {
    await db.messages.delete(msg.id);
  }

  console.log(`✅ Deleted ${audioMessages.length} audio messages`);

  // Clear migration flag so it runs again
  localStorage.removeItem('audio_url_migration_v1_done');

  return audioMessages.length;
}

/**
 * Force re-run migration (ignores localStorage flag)
 */
export async function forceRunMigration() {
  console.log('🔧 Force running migration (ignoring localStorage flag)...');
  localStorage.removeItem('audio_url_migration_v1_done');
  return runAudioUrlMigration();
}

// Export all functions for console usage
export default {
  runAudioUrlMigration,
  viewAudioMessages,
  deleteAllAudioMessages,
  forceRunMigration,
};
