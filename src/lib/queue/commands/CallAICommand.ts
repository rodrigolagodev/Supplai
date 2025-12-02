import { Command, CommandStatus } from '../types';
import { db } from '@/lib/db';
import { aiCircuitBreaker } from '@/lib/resilience/ai-circuit-breaker';
import { eventBus } from '@/lib/events/EventBus';
import { v4 as uuidv4 } from 'uuid';

export interface CallAIPayload {
  orderId: string;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
}

/**
 * Command to call AI API
 * Fetches fresh messages and streams response
 */
export class CallAICommand implements Command {
  id: string;
  type = 'CallAI';
  status: CommandStatus;
  retries: number;
  maxRetries = 2; // Less retries for AI calls (expensive)
  error?: Error;

  constructor(public payload: CallAIPayload) {
    this.id = uuidv4();
    this.type = 'CALL_AI';
    this.status = 'pending';
    this.retries = 0;
    this.maxRetries = 3;
  }

  async execute(): Promise<string> {
    // Fetch fresh messages from IndexedDB
    const freshMessages = await db.messages
      .where('order_id')
      .equals(this.payload.orderId)
      .sortBy('sequence_number');

    const payloadMessages = freshMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    // Call AI API with Circuit Breaker
    const response = await aiCircuitBreaker.execute(async () => {
      eventBus.publish({ type: 'ai:typing', payload: { isTyping: true } });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: this.payload.orderId,
          messages: payloadMessages,
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      return res;
    });

    // Stream response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        if (this.payload.onChunk) {
          await this.payload.onChunk(chunk);
        }
      }
    }

    this.payload.onComplete?.(fullContent);
    eventBus.publish({ type: 'ai:typing', payload: { isTyping: false } });
    eventBus.publish({ type: 'message:received', payload: { content: fullContent } });
    return fullContent;
  }

  async retry(): Promise<string> {
    return this.execute();
  }
}
