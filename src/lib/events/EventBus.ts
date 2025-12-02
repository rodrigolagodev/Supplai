export type ChatEvent =
  | { type: 'message:sent'; payload: { messageId: string; content: string } }
  | { type: 'message:received'; payload: { content: string } }
  | { type: 'ai:typing'; payload: { isTyping: boolean } }
  | { type: 'connection:changed'; payload: { isOnline: boolean } }
  | { type: 'error:occurred'; payload: { error: Error; context: string } }
  | { type: 'queue:status_changed'; payload: { pending: number; executing: number } };

type EventHandler<T extends ChatEvent = ChatEvent> = (event: T) => void;

export class EventBus {
  private subscribers = new Map<ChatEvent['type'], EventHandler[]>();

  subscribe<T extends ChatEvent['type']>(
    eventType: T,
    handler: EventHandler<Extract<ChatEvent, { type: T }>>
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }

    this.subscribers.get(eventType)!.push(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler as EventHandler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  publish(event: ChatEvent): void {
    const handlers = this.subscribers.get(event.type) ?? [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });
  }
}

// Singleton instance
export const eventBus = new EventBus();
