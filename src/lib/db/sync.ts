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

  // 1. Get Pending Messages first (we need them to identify orders)
  const pendingMessages = await db.messages.where('sync_status').equals('pending').toArray();
  const orderIdsFromMessages = [...new Set(pendingMessages.map(m => m.order_id))];

  // 2. Sync Orders
  // Get explicitly pending orders
  const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();

  // Get orders referenced by pending messages (even if they are marked as synced locally)
  // This handles the case where an order was marked "synced" (empty) but now has messages
  const messageOrders =
    orderIdsFromMessages.length > 0
      ? await db.orders.where('id').anyOf(orderIdsFromMessages).toArray()
      : [];

  // Merge unique orders
  const allCandidateOrders = [...pendingOrders];
  const processedOrderIds = new Set(pendingOrders.map(o => o.id));

  for (const order of messageOrders) {
    if (!processedOrderIds.has(order.id)) {
      allCandidateOrders.push(order);
      processedOrderIds.add(order.id);
    }
  }

  if (allCandidateOrders.length > 0) {
    try {
      // Filter orders: only sync if they have at least one item OR message
      const ordersToSync: typeof allCandidateOrders = [];
      const emptyOrders: typeof allCandidateOrders = [];

      for (const order of allCandidateOrders) {
        const itemCount = await db.orderItems.where('order_id').equals(order.id).count();
        const messageCount = await db.messages.where('order_id').equals(order.id).count();

        // Sync if it has items OR messages (active conversation)
        if (itemCount > 0 || messageCount > 0) {
          ordersToSync.push(order);
        } else {
          // Only mark as empty if it's strictly pending (don't touch already synced ones)
          if (order.sync_status === 'pending') {
            emptyOrders.push(order);
          }
        }
      }

      // Sync orders that have content
      if (ordersToSync.length > 0) {
        const ordersToUpsert = ordersToSync.map(order => ({
          id: order.id,
          organization_id: order.organization_id,
          status: order.status,
          created_at: order.created_at,
          created_by: user.id,
        }));

        const { error } = await supabase.from('orders').upsert(ordersToUpsert);

        if (error) throw error;

        // Update local status for synced orders
        await Promise.all(
          ordersToSync.map(order => db.orders.update(order.id, { sync_status: 'synced' }))
        );
      }

      // Mark empty orders as synced WITHOUT sending to Supabase
      if (emptyOrders.length > 0) {
        await Promise.all(
          emptyOrders.map(order => db.orders.update(order.id, { sync_status: 'synced' }))
        );
        console.warn(`Skipped syncing ${emptyOrders.length} empty draft(s) to Supabase`);
      }
    } catch (error) {
      console.error('Failed to batch sync orders:', error);
    }
  }

  // 3. Sync Messages
  const ordersToProcess = new Set<string>();

  // We process messages sequentially to maintain order and handle audio uploads correctly
  for (const msg of pendingMessages) {
    try {
      let audioFileId = msg.audio_url;

      // Validate if audioFileId is a valid UUID
      const isUuid = (str?: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

      if (audioFileId && !isUuid(audioFileId)) {
        console.warn('Invalid audioFileId (not a UUID), clearing:', audioFileId);
        audioFileId = undefined;
      }

      // Upload Audio if present and not yet uploaded (or if ID was invalid)
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
        msg.sequence_number,
        msg.id
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
          // console.log('Triggering batch processing for order:', orderId);
          await processOrderBatch(orderId);
        }
      } catch (error) {
        console.error('Failed to trigger batch processing for:', orderId, error);
      }
    }
  }
}

/**
 * Force sync a specific order to Supabase
 */
export async function syncOrder(orderId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const order = await db.orders.get(orderId);
  if (!order) throw new Error('Order not found locally');

  // Upsert order to Supabase
  const { error } = await supabase.from('orders').upsert({
    id: order.id,
    organization_id: order.organization_id,
    status: order.status,
    created_at: order.created_at,
    created_by: user.id,
  });

  if (error) throw error;

  // Update local status
  await db.orders.update(order.id, { sync_status: 'synced' });

  // ALSO Sync pending messages for this order
  const pendingMessages = await db.messages
    .where('order_id')
    .equals(orderId)
    .and(m => m.sync_status === 'pending')
    .toArray();

  if (pendingMessages.length > 0) {
    for (const msg of pendingMessages) {
      try {
        let audioFileId = msg.audio_url;

        // Upload audio if needed (reusing logic from syncPendingItems would be better, but duplicating for safety now)
        if (msg.type === 'audio' && msg.audio_blob && !audioFileId) {
          const fileName = `${msg.order_id}/${msg.id}.webm`;
          const { error: uploadError } = await supabase.storage
            .from('orders')
            .upload(fileName, msg.audio_blob, {
              upsert: true,
              contentType: 'audio/webm',
            });
          if (!uploadError) {
            const { data: audioFile } = await supabase
              .from('order_audio_files')
              .insert({
                order_id: msg.order_id,
                storage_path: fileName,
              })
              .select('id')
              .single();
            if (audioFile) {
              audioFileId = audioFile.id;
              await db.messages.update(msg.id, { audio_url: audioFileId });
            }
          }
        }

        const role = (msg.role === 'system' ? 'assistant' : msg.role) as 'user' | 'assistant';

        // We need to import saveConversationMessage or replicate it.
        // Since it's a server action, we can't call it directly from client code easily if it's not exposed?
        // Wait, saveConversationMessage IS imported in sync.ts!

        await saveConversationMessage(
          msg.order_id,
          role,
          msg.content,
          audioFileId,
          msg.sequence_number,
          msg.id
        );

        await db.messages.update(msg.id, { sync_status: 'synced' });
      } catch (msgError) {
        console.error('Failed to sync message in syncOrder:', msgError);
        // Don't throw, try next message
      }
    }
  }
}
