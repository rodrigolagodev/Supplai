import { parseOrderText } from '@/lib/ai/gemini';
import type { SupplierContext } from '@/lib/ai/gemini';
import type { ParsedItem } from '@/domain/types';
import type { Database } from '@/types/database';

/**
 * OrderParsingService - Domain service for parsing order text
 *
 * This is a pure function that encapsulates the business logic of:
 * 1. Combining messages into a single text
 * 2. Fetching available suppliers for context
 * 3. Calling the AI parser
 * 4. Normalizing the results for the domain
 *
 * Benefits:
 * - Testable without database or AI
 * - Single responsibility
 * - No side effects (pure function when given suppliers)
 */

export interface ParseOrderInput {
  /** Combined text from all user messages */
  text: string;
  /** Available suppliers for classification context */
  suppliers: SupplierContext[];
}

export interface ParseOrderResult {
  /** Successfully parsed items */
  items: ParsedItem[];
  /** Total count of items found */
  itemCount: number;
}

/**
 * Parse order text into structured items with supplier classification
 *
 * This is the main entry point for order parsing in the domain layer.
 * It delegates to the AI service but adds domain-specific normalization.
 *
 * @param input - Text and supplier context
 * @returns Parsed and normalized items
 * @throws Error if AI parsing fails
 */
export async function parseOrder(input: ParseOrderInput): Promise<ParseOrderResult> {
  const { text, suppliers } = input;

  // Call AI parser
  const parsedItems = await parseOrderText(text, suppliers);

  // Normalize items for domain use
  const normalizedItems: ParsedItem[] = parsedItems.map(item => ({
    product: item.product,
    quantity: item.quantity,
    unit: item.unit as Database['public']['Enums']['item_unit'],
    supplier_id: item.supplier_id || undefined,
    confidence: item.confidence,
    original_text: item.original_text,
  }));

  return {
    items: normalizedItems,
    itemCount: normalizedItems.length,
  };
}

/**
 * Aggregate messages into a single text for parsing
 *
 * This is a pure helper function that can be tested independently.
 *
 * @param messages - Array of message contents
 * @returns Combined text separated by double newlines
 */
export function aggregateMessages(messages: Array<{ content: string }>): string {
  return messages.map(m => m.content).join('\n\n');
}

/**
 * Validate that parsed items meet domain requirements
 *
 * @param items - Parsed items to validate
 * @returns true if valid, throws otherwise
 */
export function validateParsedItems(items: ParsedItem[]): boolean {
  if (items.length === 0) {
    throw new Error('No items were parsed from the order text');
  }

  for (const item of items) {
    if (!item.product || item.product.trim().length === 0) {
      throw new Error('Parsed item missing product name');
    }
    if (item.quantity <= 0) {
      throw new Error(`Invalid quantity for ${item.product}: ${item.quantity}`);
    }
    if (item.confidence < 0 || item.confidence > 1) {
      throw new Error(`Invalid confidence score for ${item.product}: ${item.confidence}`);
    }
  }

  return true;
}
