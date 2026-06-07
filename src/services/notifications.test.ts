import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from './notifications';
import type { SupabaseClient } from '@supabase/supabase-js';

const { mockSendOrderEmail } = vi.hoisted(() => ({ mockSendOrderEmail: vi.fn() }));

vi.mock('@/lib/email/orders', () => ({ sendOrderEmail: mockSendOrderEmail }));
vi.mock('./orders', () => ({
  OrderService: { updateMainOrderStatus: vi.fn().mockResolvedValue(undefined) },
}));

/**
 * Build a Supabase mock whose `supplier_orders` single() returns the given record.
 * Captures update(...) payloads so we can assert status transitions.
 */
function buildSupabase(supplierOrder: Record<string, unknown>) {
  const supplierOrderUpdates: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === 'supplier_orders') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: supplierOrder, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          supplierOrderUpdates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    }
    if (table === 'order_items') {
      return {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ product: 'Tomate', quantity: 2, unit: 'kg' }],
                error: null,
              }),
          }),
        }),
      };
    }
    return {};
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    supplierOrderUpdates,
  };
}

describe('NotificationService.sendSupplierOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT re-send an order that is already "sent" (idempotency)', async () => {
    const { supabase, supplierOrderUpdates } = buildSupabase({
      id: 'so-1',
      order_id: 'o-1',
      supplier_id: 's-1',
      status: 'sent',
      supplier: { email: 'supplier@example.com', name: 'Proveedor' },
      order: { organization: { name: 'Org' } },
    });

    await NotificationService.sendSupplierOrder('so-1', supabase);

    expect(mockSendOrderEmail).not.toHaveBeenCalled();
    // No status writes either — it should short-circuit before touching anything.
    expect(supplierOrderUpdates).toHaveLength(0);
  });

  it('sends the email when the order is pending', async () => {
    mockSendOrderEmail.mockResolvedValue({ error: null });

    const { supabase } = buildSupabase({
      id: 'so-1',
      order_id: 'o-1',
      supplier_id: 's-1',
      status: 'pending',
      supplier: { email: 'supplier@example.com', name: 'Proveedor' },
      order: { organization: { name: 'Org' } },
    });

    await NotificationService.sendSupplierOrder('so-1', supabase);

    expect(mockSendOrderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'supplier@example.com' })
    );
  });
});
