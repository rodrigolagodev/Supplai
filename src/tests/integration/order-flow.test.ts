import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processOrderMessageUseCase } from '@/application/use-cases/ProcessOrderMessage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Integration Test: Order Processing Flow
 *
 * This is a "black-box" test that verifies the critical flow:
 * 1. User adds messages to an order
 * 2. System processes the order (parsing + classification)
 * 3. System creates order_items in the database
 * 4. System generates a summary message
 *
 * This test ensures we don't break the core functionality during refactoring.
 */

// Mock dependencies using vi.hoisted to avoid reference errors
const { mockParseOrderText } = vi.hoisted(() => {
  return {
    mockParseOrderText: vi.fn(),
  };
});

vi.mock('@/lib/ai/gemini', () => ({
  parseOrderText: mockParseOrderText,
}));

describe('Order Processing Flow (Integration)', () => {
  let mockSupabase: SupabaseClient<Database>;

  // Test data
  const testOrderId = 'test-order-123';
  const testOrgId = 'test-org-456';
  const testMessages = [{ content: '2 kilos de tomate' }, { content: 'y 1 kilo de cebolla' }];
  const testSuppliers = [
    {
      id: 'supplier-veg-1',
      name: 'Verdulería Central',
      category: 'fruits_vegetables' as const,
      custom_keywords: ['tomate', 'cebolla', 'verduras'],
    },
  ];

  let insertOrderItemsSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockParseOrderText.mockResolvedValue([
      {
        product: 'Tomate',
        quantity: 2,
        unit: 'kg',
        confidence: 0.95,
        supplier_id: 'supplier-veg-1',
        supplier_name: 'Verdulería Central',
      },
      {
        product: 'Cebolla',
        quantity: 1,
        unit: 'kg',
        confidence: 0.9,
        supplier_id: 'supplier-veg-1',
        supplier_name: 'Verdulería Central',
      },
    ]);

    // Create spies
    insertOrderItemsSpy = vi.fn().mockResolvedValue({ error: null });

    // Create mock Supabase client
    mockSupabase = {
      from: vi.fn(),
    } as unknown as SupabaseClient<Database>;

    const fromMock = mockSupabase.from as unknown as ReturnType<typeof vi.fn>;

    // Default mock implementation for supabase.from
    fromMock.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({ data: { id: testOrderId, status: 'draft' }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === 'order_conversations') {
        return {
          select: () => ({
            eq: vi.fn((field, _value) => {
              // First eq is usually order_id
              if (field === 'order_id') {
                return {
                  eq: vi.fn((f, v) => {
                    // Second eq is role
                    if (f === 'role' && v === 'user') {
                      return {
                        order: vi.fn(() => Promise.resolve({ data: testMessages, error: null })),
                      };
                    }
                    return {
                      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    };
                  }),
                };
              }
              // Fallback if order is different
              return {
                eq: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              };
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'suppliers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: testSuppliers, error: null }),
          }),
        };
      }
      if (table === 'order_items') {
        return {
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
          insert: insertOrderItemsSpy,
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });
  });

  it('should process an order end-to-end: messages → parsed items → summary', async () => {
    // Execute the processOrder flow
    const result = await processOrderMessageUseCase({
      orderId: testOrderId,
      organizationId: testOrgId,
      supabase: mockSupabase,
    });

    // Assertions
    expect(result.success).toBe(true);
    expect(result.itemsProcessed).toBe(2);

    // Verify AI was called with combined text
    expect(mockParseOrderText).toHaveBeenCalledWith(
      '2 kilos de tomate\n\ny 1 kilo de cebolla',
      expect.arrayContaining([expect.objectContaining({ id: 'supplier-veg-1' })])
    );

    // Verify items were saved via Supabase
    expect(insertOrderItemsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ product: 'Tomate', quantity: 2 }),
        expect.objectContaining({ product: 'Cebolla', quantity: 1 }),
      ])
    );

    // Verify Supabase was called correctly
    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    expect(mockSupabase.from).toHaveBeenCalledWith('order_conversations');
    expect(mockSupabase.from).toHaveBeenCalledWith('suppliers');
    expect(mockSupabase.from).toHaveBeenCalledWith('order_items');
  });

  it('should handle empty messages gracefully', async () => {
    // Override to return no messages
    (mockSupabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (table: string) => {
        if (table === 'order_conversations') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          };
        }
        // Use the default mock for other tables
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({ data: { id: testOrderId, status: 'draft' }, error: null })
              ),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
    );

    const result = await processOrderMessageUseCase({
      orderId: testOrderId,
      organizationId: testOrgId,
      supabase: mockSupabase,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('No hay mensajes');
    expect(mockParseOrderText).not.toHaveBeenCalled();
  });

  it('should handle no parsed items from AI', async () => {
    // Mock AI to return empty array
    mockParseOrderText.mockResolvedValue([]);

    const result = await processOrderMessageUseCase({
      orderId: testOrderId,
      organizationId: testOrgId,
      supabase: mockSupabase,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('No pude identificar productos');
  });

  it('should classify items with suppliers correctly', async () => {
    await processOrderMessageUseCase({
      orderId: testOrderId,
      organizationId: testOrgId,
      supabase: mockSupabase,
    });

    // Verify items were classified with supplier via Supabase insert
    expect(insertOrderItemsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          supplier_id: 'supplier-veg-1',
          confidence_score: 0.95,
        }),
      ])
    );
  });
});
