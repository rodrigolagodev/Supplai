import { Command, QueueConfig } from './types';

/**
 * Message Queue Pattern Implementation
 * FIFO queue with retry logic and exponential backoff
 */
export class MessageQueue {
  private queue: Command[] = [];
  private processing = false;
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      ...config,
    };
  }

  /**
   * Enqueue a command for execution
   */
  enqueue(command: Command): void {
    this.queue.push(command);
    this.process();
  }

  /**
   * Process queue - FIFO with retry logic
   */
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const command = this.queue[0];

      if (!command) {
        this.queue.shift();
        continue;
      }

      try {
        command.status = 'executing';
        await command.execute();
        command.status = 'success';

        this.queue.shift(); // Remove on success
        this.config.onCommandExecuted?.(command);
      } catch (error) {
        command.error = error as Error;
        command.retries++;

        if (command.retries >= this.config.maxRetries) {
          command.status = 'failed';
          this.queue.shift(); // Remove after max retries
          this.config.onCommandFailed?.(command, error as Error);
        } else {
          // Retry with exponential backoff
          const delay = this.config.exponentialBackoff
            ? this.config.retryDelay * Math.pow(2, command.retries - 1)
            : this.config.retryDelay;

          await new Promise(resolve => setTimeout(resolve, delay));
          command.status = 'pending';
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      pending: this.queue.filter(c => c.status === 'pending').length,
      executing: this.queue.filter(c => c.status === 'executing').length,
      total: this.queue.length,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
  }
}
