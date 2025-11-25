import { db } from './index';
import { createClient } from '@/lib/supabase/client';
import {
  saveConversationMessage,
  processOrderBatch,
} from '@/features/orders/actions/process-message';

export async function syncPendingItems() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // Cannot sync if not authenticated

  // 1. Sync Orders
  const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();

  if (pendingOrders.length > 0) {
    try {
      const ordersToUpsert = pendingOrders.map(order => ({
        id: order.id,
        organization_id: order.organization_id,
        status: order.status,
        created_at: order.created_at,
        created_by: user.id,
      }));

      const { error } = await supabase.from('orders').upsert(ordersToUpsert);

      if (error) throw error;

      // Update local status in batch (parallel promises)
      await Promise.all(
        pendingOrders.map(order => db.orders.update(order.id, { sync_status: 'synced' }))
      );
    } catch (error) {
      console.error('Failed to batch sync orders:', error);
    }
  }

  // 2. Sync Messages
  const pendingMessages = await db.messages.where('sync_status').equals('pending').toArray();
  const ordersToProcess = new Set<string>();

  // We process messages sequentially to maintain order and handle audio uploads correctly
  for (const msg of pendingMessages) {
    try {
      let audioFileId = msg.audio_url;

      // Upload Audio if present and not yet uploaded (and not a UUID)
      // Check if it's a blob and not a string UUID (simple check: length > 50 or starts with blob:)
      // Actually msg.audio_url stores the ID if synced, or blob url if local?
      // The type definition says string | undefined.
      // If we have audio_blob, we need to upload.

      if (msg.type === 'audio' && msg.audio_blob && !audioFileId) {
        const fileName = `${msg.order_id}/${msg.id}.webm`;
        const { error } = await supabase.storage.from('orders').upload(fileName, msg.audio_blob, {
          upsert: true,
          contentType: 'audio/webm',
        });

        if (error) throw error;

        // Create audio file record
        const { data: audioFile, error: fileError } = await supabase
          .from('order_audio_files')
          .insert({
            order_id: msg.order_id,
            storage_path: fileName,
          })
          .select('id')
          .single();

        if (fileError) throw fileError;
        audioFileId = audioFile.id;

        // Update local message with audio ID so we don't re-upload if sync fails later
        await db.messages.update(msg.id, { audio_url: audioFileId });
      }

      // Ensure role is compatible
      const role = (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant';

      await saveConversationMessage(
        msg.order_id,
        role,
        msg.content,
        audioFileId,
        msg.sequence_number
      );

      await db.messages.update(msg.id, { sync_status: 'synced' });

      // Track order IDs that might need processing
      ordersToProcess.add(msg.order_id);
    } catch (error) {
      console.error('Failed to sync message:', msg.id, error);
    }
  }

  // 3. Trigger Batch Processing for updated orders
  if (ordersToProcess.size > 0) {
    for (const orderId of ordersToProcess) {
      try {
        // Check local status
        const order = await db.orders.get(orderId);
        if (order && order.status === 'review') {
          console.log('Triggering batch processing for order:', orderId);
          await processOrderBatch(orderId);
        }
      } catch (error) {
        console.error('Failed to trigger batch processing for:', orderId, error);
      }
    }
  }
}
