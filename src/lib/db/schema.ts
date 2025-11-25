export type SyncStatus = 'pending' | 'synced' | 'failed';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'audio';

export interface LocalOrder {
  id: string; // UUID
  organization_id: string;
  status: 'draft' | 'review' | 'sent' | 'archived';
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface LocalMessage {
  id: string; // UUID
  order_id: string;
  role: MessageRole;
  content: string;
  type: MessageType;
  audio_blob?: Blob; // Stored locally
  audio_url?: string; // Remote URL after sync
  created_at: string;
  sequence_number?: number;
  sync_status: SyncStatus;
}

export interface LocalOrderItem {
  id: string; // UUID
  order_id: string;
  product: string;
  quantity: number;
  unit: string;
  confidence_score?: number;
  supplier_id?: string;
  original_text?: string;
  sync_status: SyncStatus;
}
