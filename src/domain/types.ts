import { Database } from '@/types/database';

// Re-export enums for convenience, but keep them decoupled if we want to map them later.
// For now, using DB enums is practical for a direct mapping start.
export type OrderStatus = Database['public']['Enums']['order_status'];
export type ItemUnit = Database['public']['Enums']['item_unit'];
export type SupplierCategory = Database['public']['Enums']['supplier_category'];
export type ProcessingStatus = Database['public']['Enums']['processing_status'];
export type MessageRole = 'user' | 'assistant' | 'system'; // Explicitly defined, though matches DB often

// --- Entities ---

export interface Order {
  id: string;
  organization_id: string;
  status: OrderStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product: string;
  quantity: number;
  unit: ItemUnit;
  supplier_id: string | null;
  original_text: string | null;
  confidence_score: number | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone: string | null;
  category: SupplierCategory;
  notes: string | null;
  address: string | null;
  preferred_contact_method: Database['public']['Enums']['contact_method'];
  custom_keywords: string[];
}

export interface OrderMessage {
  id: string;
  order_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  audio_file_id?: string | null;
}

export interface OrderAudioFile {
  id: string;
  order_id: string;
  storage_path: string;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  transcription: string | null;
  processing_status: ProcessingStatus;
  confidence_score: number | null;
  error_message: string | null;
  created_at: string;
  transcribed_at: string | null;
}

// --- Aggregate / Context Types ---

export interface OrderContext {
  order: Order;
  items: OrderItem[];
  messages: OrderMessage[];
  suppliers: Supplier[]; // Available suppliers for this order context
}

export interface ParsedItem {
  product: string;
  quantity: number;
  unit: ItemUnit;
  supplier_id?: string;
  confidence: number;
  original_text?: string;
}
