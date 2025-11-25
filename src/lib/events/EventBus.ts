/**
 * Simple in-memory Event Bus for event-driven patterns
 *
 * Purpose: Enable loose coupling between components without heavy infrastructure
 *
 * Use cases:
 * - Analytics tracking
 * - Audit logging
 * - Cross-component communication
 * - Future: Could be extended to persist events for Event Sourcing
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler<T = any> = (data: T) => void | Promise<void>;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to an event
   * @param event - Event name to listen to
   * @param handler - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler as EventHandler);
    };
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name to emit
   * @param data - Data to pass to handlers
   */
  emit<T = unknown>(event: string, data: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    handlers.forEach(handler => {
      try {
        // Fire-and-forget: Don't await async handlers to avoid blocking
        const result = handler(data);

        // If it's a promise and it rejects, log the error but don't throw
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(`Event handler error for ${event}:`, error);
          });
        }
      } catch (error) {
        console.error(`Event handler error for ${event}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for an event
   * @param event - Event name to clear
   */
  clear(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners for all events
   */
  clearAll(): void {
    this.listeners.clear();
  }

  /**
   * Get count of listeners for an event (useful for testing)
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Singleton instance
export const eventBus = new EventBus();
