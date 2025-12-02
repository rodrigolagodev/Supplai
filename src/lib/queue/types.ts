/**
 * Command Pattern - Base para todos los comandos
 */
export interface Command {
  id: string;
  type: string;
  payload: unknown;
  status: CommandStatus;
  execute: () => Promise<unknown>;
  undo?: () => Promise<void>;
  retries: number;
  maxRetries: number;
  error?: Error;
}

export type CommandStatus = 'pending' | 'executing' | 'success' | 'failed' | 'cancelled';

export interface QueueConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  exponentialBackoff: boolean;
  onCommandExecuted?: (command: Command) => void;
  onCommandFailed?: (command: Command, error: Error) => void;
}
