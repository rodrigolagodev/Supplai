/**
 * Domain Events for Order Aggregate
 *
 * NOTE: This is planned infrastructure for future features:
 * - Analytics tracking
 * - Audit trails
 * - Event-driven notifications
 *
 * Currently these events are NOT emitted anywhere in the codebase.
 * The types are defined here to establish the event schema for when
 * we implement event sourcing or analytics tracking.
 *
 * These events represent things that have happened in the domain.
 * They can be used for:
 * - Analytics tracking
 * - Audit trails
 * - Triggering side effects (emails, notifications)
 * - Event Sourcing (future)
 */

/**
 * Emitted when a new order is created
 */
export interface OrderCreatedEvent {
  orderId: string;
  organizationId: string;
  userId?: string;
  timestamp: string;
}

/**
 * Emitted when a message is added to an order conversation
 */
export interface MessageAddedEvent {
  orderId: string;
  messageId: string;
  role: 'user' | 'assistant';
  sequenceNumber: number;
  timestamp: string;
}

/**
 * Emitted when audio is uploaded for an order
 */
export interface AudioUploadedEvent {
  orderId: string;
  audioFileId: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  timestamp: string;
}

/**
 * Emitted when audio transcription completes
 */
export interface AudioTranscribedEvent {
  audioFileId: string;
  orderId: string;
  transcription: string;
  confidence?: number;
  timestamp: string;
}

/**
 * Emitted when an order is processed (parsed into items)
 */
export interface OrderProcessedEvent {
  orderId: string;
  itemCount: number;
  unclassifiedCount: number;
  timestamp: string;
}

/**
 * Emitted when an order is sent to suppliers
 */
export interface OrderSentEvent {
  orderId: string;
  supplierOrderIds: string[];
  supplierCount: number;
  timestamp: string;
}

/**
 * Emitted when order processing fails
 */
export interface ProcessingFailedEvent {
  orderId: string;
  error: string;
  stage: 'transcription' | 'parsing' | 'classification' | 'sending';
  timestamp: string;
}

/**
 * Emitted when rate limit is hit
 */
export interface RateLimitHitEvent {
  userId?: string;
  organizationId: string;
  resource: 'audio' | 'api' | 'messages';
  timestamp: string;
}

/**
 * Union type of all order-related events
 */
export type OrderEvent =
  | OrderCreatedEvent
  | MessageAddedEvent
  | AudioUploadedEvent
  | AudioTranscribedEvent
  | OrderProcessedEvent
  | OrderSentEvent
  | ProcessingFailedEvent
  | RateLimitHitEvent;

/**
 * Event names as constants to avoid typos
 */
export const OrderEventNames = {
  ORDER_CREATED: 'ORDER_CREATED',
  MESSAGE_ADDED: 'MESSAGE_ADDED',
  AUDIO_UPLOADED: 'AUDIO_UPLOADED',
  AUDIO_TRANSCRIBED: 'AUDIO_TRANSCRIBED',
  ORDER_PROCESSED: 'ORDER_PROCESSED',
  ORDER_SENT: 'ORDER_SENT',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  RATE_LIMIT_HIT: 'RATE_LIMIT_HIT',
} as const;

export type OrderEventName = (typeof OrderEventNames)[keyof typeof OrderEventNames];
