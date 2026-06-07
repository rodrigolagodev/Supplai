import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueue } from './queue';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockSupabaseClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

// Mock de Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
} as MockSupabaseClient as unknown as SupabaseClient;

// Mock de NotificationService
vi.mock('@/services/notifications', () => ({
  NotificationService: {
    sendSupplierOrder: vi.fn(),
  },
}));

/**
 * Build a `from('jobs')` mock that captures the payload passed to `update(...).eq(...)`.
 * Returns the update spy so assertions can inspect the status written.
 */
function mockJobsUpdate() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const from = vi.fn().mockReturnValue({ update });
  (mockSupabase as unknown as MockSupabaseClient).from = from;
  return { update, updateEq };
}

describe('JobQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should enqueue a job successfully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      await JobQueue.enqueue('SEND_SUPPLIER_ORDER', { supplierOrderId: 'order-123' }, mockSupabase);

      expect(mockFrom).toHaveBeenCalledWith('jobs');
      expect(mockInsert).toHaveBeenCalledWith({
        type: 'SEND_SUPPLIER_ORDER',
        payload: { supplierOrderId: 'order-123' },
        status: 'pending',
        user_id: 'user-123',
      });
    });

    it('should throw error if insert fails', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'Database error' } });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      await expect(
        JobQueue.enqueue('SEND_SUPPLIER_ORDER', { supplierOrderId: 'order-123' }, mockSupabase)
      ).rejects.toThrow('Failed to enqueue job');
    });

    it('should throw if user is not authenticated', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } });

      await expect(
        JobQueue.enqueue('SEND_SUPPLIER_ORDER', { supplierOrderId: 'order-123' }, mockSupabase)
      ).rejects.toThrow('User must be authenticated to enqueue jobs');
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('processBatch', () => {
    function setupClaim(jobs: unknown[]) {
      (mockSupabase as unknown as MockSupabaseClient).rpc = vi
        .fn()
        .mockResolvedValue({ data: jobs, error: null });
    }

    it('claims jobs via the atomic RPC and processes them', async () => {
      setupClaim([
        {
          id: 'job-1',
          type: 'SEND_SUPPLIER_ORDER',
          payload: { supplierOrderId: 'order-1' },
          status: 'processing',
          attempts: 0,
          max_attempts: 3,
        },
      ]);
      const { update } = mockJobsUpdate();

      const { NotificationService } = await import('@/services/notifications');
      vi.mocked(NotificationService.sendSupplierOrder).mockResolvedValue(undefined);

      await JobQueue.processBatch(mockSupabase, 0, 'user-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('claim_pending_jobs', {
        p_limit: 20,
        p_older_than_minutes: 0,
        p_user_id: 'user-1',
      });
      expect(NotificationService.sendSupplierOrder).toHaveBeenCalledWith('order-1', mockSupabase);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    it('handles an empty queue without sending', async () => {
      setupClaim([]);
      mockJobsUpdate();

      await JobQueue.processBatch(mockSupabase);

      const { NotificationService } = await import('@/services/notifications');
      expect(NotificationService.sendSupplierOrder).not.toHaveBeenCalled();
    });

    it('retries a retriable error while attempts remain (status -> pending)', async () => {
      setupClaim([
        {
          id: 'job-1',
          type: 'SEND_SUPPLIER_ORDER',
          payload: { supplierOrderId: 'order-1' },
          status: 'processing',
          attempts: 0,
          max_attempts: 3,
        },
      ]);
      const { update } = mockJobsUpdate();

      const { NotificationService } = await import('@/services/notifications');
      vi.mocked(NotificationService.sendSupplierOrder).mockRejectedValue(new Error('rate limit'));

      await JobQueue.processBatch(mockSupabase);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', attempts: 1, last_error: 'rate limit' })
      );
    });

    it('marks a retriable error as failed once attempts are exhausted', async () => {
      setupClaim([
        {
          id: 'job-1',
          type: 'SEND_SUPPLIER_ORDER',
          payload: { supplierOrderId: 'order-1' },
          status: 'processing',
          attempts: 2,
          max_attempts: 3,
        },
      ]);
      const { update } = mockJobsUpdate();

      const { NotificationService } = await import('@/services/notifications');
      vi.mocked(NotificationService.sendSupplierOrder).mockRejectedValue(new Error('rate limit'));

      await JobQueue.processBatch(mockSupabase);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', attempts: 3 })
      );
    });

    it('marks a permanent error as failed immediately', async () => {
      setupClaim([
        {
          id: 'job-1',
          type: 'UNKNOWN_JOB_TYPE',
          payload: {},
          status: 'processing',
          attempts: 0,
          max_attempts: 3,
        },
      ]);
      const { update } = mockJobsUpdate();

      await JobQueue.processBatch(mockSupabase);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          attempts: 1,
          last_error: 'Unknown job type: UNKNOWN_JOB_TYPE',
        })
      );
    });
  });
});
