import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { LocalMessage, MessageType, MessageRole } from '@/lib/db/schema';

export function useLocalMessages(orderId: string) {
  const messages = useLiveQuery(
    () => db.messages.where('order_id').equals(orderId).sortBy('created_at'),
    [orderId]
  );

  const addMessage = async (
    content: string,
    role: MessageRole = 'user',
    type: MessageType = 'text',
    audioBlob?: Blob
  ) => {
    // Get current max sequence number
    const allMessages = await db.messages.where('order_id').equals(orderId).toArray();
    const maxSeq = allMessages.reduce((max, msg) => Math.max(max, msg.sequence_number || 0), 0);

    const newMessage: LocalMessage = {
      id: uuidv4(),
      order_id: orderId,
      role,
      content,
      type,
      audio_blob: audioBlob,
      created_at: new Date().toISOString(),
      sequence_number: maxSeq + 1,
      sync_status: 'pending',
    };

    await db.messages.add(newMessage);
    return newMessage.id;
  };

  const updateMessage = async (
    messageId: string,
    updates: Partial<Omit<LocalMessage, 'id' | 'order_id' | 'created_at'>>
  ) => {
    await db.messages.update(messageId, {
      ...updates,
      sync_status: 'pending', // Mark as pending to sync updated content
    });
  };

  return {
    messages: messages || [],
    addMessage,
    updateMessage,
    isLoading: messages === undefined,
  };
}
