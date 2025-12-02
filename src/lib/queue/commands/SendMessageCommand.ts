import { Command, CommandStatus } from '../types';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { MessageRole, MessageType } from '@/lib/db/schema';
import { eventBus } from '@/lib/events/EventBus';

export interface SendMessagePayload {
  orderId: string;
  content: string;
  role: MessageRole;
  type: MessageType;
  audioBlob?: Blob;
}

/**
 * Command to send a message
 * Implements retry logic and state persistence
 */
export class SendMessageCommand implements Command {
  id: string;
  type: string;
  status: CommandStatus;
  retries: number;
  maxRetries: number;
  error?: Error;

  private messageId: string;

  constructor(public payload: SendMessagePayload) {
    this.id = uuidv4();
    this.messageId = uuidv4();
    this.type = 'SEND_MESSAGE';
    this.status = 'pending';
    this.retries = 0;
    this.maxRetries = 3;
  }

  async execute(): Promise<string> {
    // Get current max sequence number to avoid integer overflow (Date.now() is too large for 4-byte int)
    const allMessages = await db.messages.where('order_id').equals(this.payload.orderId).toArray();
    const maxSeq = allMessages.reduce((max, msg) => Math.max(max, msg.sequence_number || 0), 0);

    // Save to IndexedDB
    await db.messages.add({
      id: this.messageId,
      order_id: this.payload.orderId,
      content: this.payload.content,
      role: this.payload.role,
      type: this.payload.type,
      audio_blob: this.payload.audioBlob,
      audio_url: undefined,
      sequence_number: maxSeq + 1,
      sync_status: 'pending',
      created_at: new Date().toISOString(),
    });

    eventBus.publish({
      type: 'message:sent',
      payload: { messageId: this.messageId, content: this.payload.content },
    });

    return this.messageId;
  }

  async retry(): Promise<string> {
    // Retry logic is handled by MessageQueue
    return this.execute();
  }

  async undo(): Promise<void> {
    // Delete from IndexedDB
    await db.messages.delete(this.messageId);
  }
}
