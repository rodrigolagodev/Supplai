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
    const newMessage: LocalMessage = {
      id: uuidv4(),
      order_id: orderId,
      role,
      content,
      type,
      audio_blob: audioBlob,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await db.messages.add(newMessage);
    return newMessage.id;
  };

  return {
    messages: messages || [],
    addMessage,
    isLoading: messages === undefined,
  };
}
