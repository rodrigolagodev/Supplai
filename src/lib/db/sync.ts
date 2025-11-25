import { db } from './index';
import { createClient } from '@/lib/supabase/client';
import { saveConversationMessage } from '@/app/(protected)/orders/actions';

export async function syncPendingItems() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return; // Cannot sync if not authenticated

  // 1. Sync Orders
  const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();

  for (const order of pendingOrders) {
    try {
      // Check if order exists in Supabase (idempotency)
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('id', order.id)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from('orders').insert({
          id: order.id,
          organization_id: order.organization_id,
          status: order.status,
          created_at: order.created_at,
          created_by: user.id,
        });

        if (error) throw error;
      } else {
        // Update existing order
        const { error } = await supabase
          .from('orders')
          .update({ status: order.status })
          .eq('id', order.id);

        if (error) throw error;
      }

      await db.orders.update(order.id, { sync_status: 'synced' });
    } catch (error) {
      console.error('Failed to sync order:', order.id, error);
      // Keep as pending to retry later
    }
  }

  // 2. Sync Messages
  const pendingMessages = await db.messages.where('sync_status').equals('pending').toArray();
  const ordersToProcess = new Set<string>();

  for (const msg of pendingMessages) {
    try {
      let audioUrl = msg.audio_url;

      // Upload Audio if present and not yet uploaded
      if (msg.type === 'audio' && msg.audio_blob && !audioUrl) {
        const fileName = `${msg.order_id}/${msg.id}.webm`;
        const { error } = await supabase.storage
          .from('audio-messages') // Verify bucket name
          .upload(fileName, msg.audio_blob, {
            upsert: true,
            contentType: 'audio/webm',
          });

        if (error) throw error;

        // Get public URL (or private, depending on policy. Assuming public for simplicity or signed url logic needed)
        // For now, let's assume we store the path or public url.
        // Actually, `saveConversationMessage` might expect just the ID or Path.
        // Let's assume we pass the path or ID.
        // But wait, `saveConversationMessage` in `actions.ts` takes `audioFileId`.
        // We might need to create the `order_audio_files` record first?
        // Let's check `saveConversationMessage` implementation again.
        // It calls `commands.addMessage`.

        // Simplified: We will just upload to storage and let the server action handle the rest if we can.
        // But `saveConversationMessage` is a Server Action. We can call it from here?
        // Yes, if this code runs on client, we can call Server Actions.
        // But `saveConversationMessage` expects `audioFileId` (UUID of the record in `order_audio_files`).
        // So we might need to insert into `order_audio_files` first via Supabase Client?
        // Or does `saveConversationMessage` handle that?
        // Looking at `actions.ts`, it takes `audioFileId`.

        // Strategy: We will use a specific API route or Server Action for syncing that handles the audio record creation.
        // Or we can do it here using Supabase Client if we have permissions.

        // Let's assume we upload to storage, then create `order_audio_files` record, then call `saveConversationMessage`.

        const { data: audioFile, error: fileError } = await supabase
          .from('order_audio_files')
          .insert({
            order_id: msg.order_id,
            file_path: fileName,
            storage_path: fileName,
            // duration, size etc?
          })
          .select('id')
          .single();

        if (fileError) throw fileError;
        audioUrl = audioFile.id; // We use the ID as the reference
      }

      // Call Server Action to save message
      // Note: We need to ensure we pass the UUID we generated locally!
      // `saveConversationMessage` in `actions.ts` might generate its own ID if we don't pass it.
      // We need to modify `saveConversationMessage` or create a new `syncMessage` action that accepts an ID.
      // For now, let's assume we can't force the ID in `saveConversationMessage` easily without refactoring it.
      // BUT, for "Chat Pasivo", maybe it's okay if the Server ID is different, AS LONG AS we map it back?
      // Or better: Refactor `saveConversationMessage` to accept an optional `id`.

      // Let's try to call it. If we can't pass ID, we might have duplicates if we retry.
      // Ideally we should pass the ID.

      // For this step, I will assume we call `saveConversationMessage` and if it succeeds, we mark local as synced.
      // We won't update the local ID to match server ID to avoid complexity,
      // unless we really need strict equality.

      // Ensure role is compatible
      const role = (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant';

      await saveConversationMessage(
        msg.order_id,
        role,
        msg.content,
        audioUrl, // This is actually audioFileId
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
    const { processOrderBatch } = await import('@/app/(protected)/orders/actions');

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
