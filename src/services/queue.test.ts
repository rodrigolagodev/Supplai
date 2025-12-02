import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobQueue } from './queue';
import type { SupabaseClient } from '@supabase/supabase-js';

interface MockSupabaseClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
}

// Mock de Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
} as MockSupabaseClient as unknown as SupabaseClient;

// Mock de NotificationService
vi.mock('@/services/notifications', () => ({
  NotificationService: {
    sendSupplierOrder: vi.fn(),
  },
}));

describe('JobQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('enqueue', () => {
    it('should enqueue a job successfully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

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
      const mockInsert = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      });

      await expect(
        JobQueue.enqueue('SEND_SUPPLIER_ORDER', { supplierOrderId: 'order-123' }, mockSupabase)
      ).rejects.toThrow('Failed to enqueue job');
    });

    it('should allow undefined user_id for system jobs', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({
        insert: mockInsert,
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
      });

      await JobQueue.enqueue('SEND_SUPPLIER_ORDER', { supplierOrderId: 'order-123' }, mockSupabase);

      expect(mockInsert).toHaveBeenCalledWith({
        type: 'SEND_SUPPLIER_ORDER',
        payload: { supplierOrderId: 'order-123' },
        status: 'pending',
        user_id: undefined, // null user results in undefined user_id
      });
    });
  });

  describe('processBatch', () => {
    it('should process pending jobs', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'SEND_SUPPLIER_ORDER',
          payload: { supplierOrderId: 'order-1' },
          status: 'pending',
          attempts: 0,
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockLt = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({ data: mockJobs, error: null });
      const mockUpdate = vi.fn().mockResolvedValue({ error: null });

      const mockFrom = vi.fn((table: string) => {
        if (table === 'jobs') {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return {};
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        lt: mockLt,
      });
      mockLt.mockReturnValue({
        limit: mockLimit,
      });
      mockUpdate.mockReturnThis();
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const { NotificationService } = await import('@/services/notifications');
      vi.mocked(NotificationService.sendSupplierOrder).mockResolvedValue(undefined);

      await JobQueue.processBatch(mockSupabase);

      expect(mockFrom).toHaveBeenCalledWith('jobs');
      expect(NotificationService.sendSupplierOrder).toHaveBeenCalledWith('order-1', mockSupabase);
    });

    it('should handle empty job queue', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockLt = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });

      const mockFrom = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ lt: mockLt });
      mockLt.mockReturnValue({ limit: mockLimit });

      await JobQueue.processBatch(mockSupabase);

      const { NotificationService } = await import('@/services/notifications');
      expect(NotificationService.sendSupplierOrder).not.toHaveBeenCalled();
    });

    it('should mark job as failed on error', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'SEND_SUPPLIER_ORDER',
          payload: { supplierOrderId: 'order-1' },
          status: 'pending',
          attempts: 0,
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockLt = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({ data: mockJobs, error: null });
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockUpdateEq,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ lt: mockLt });
      mockLt.mockReturnValue({ limit: mockLimit });

      const { NotificationService } = await import('@/services/notifications');
      vi.mocked(NotificationService.sendSupplierOrder).mockRejectedValue(new Error('Email failed'));

      await JobQueue.processBatch(mockSupabase);

      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'failed',
        attempts: 1,
        last_error: 'Email failed',
        updated_at: expect.any(String),
      });
    });

    it('should respect max attempts limit', async () => {
      // Test verifica que jobs con attempts >= 3 no se seleccionen
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockLt = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null }); // No retorna jobs

      const mockFrom = vi.fn().mockReturnValue({
        select: mockSelect,
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ lt: mockLt });
      mockLt.mockReturnValue({ limit: mockLimit });

      await JobQueue.processBatch(mockSupabase);

      expect(mockLt).toHaveBeenCalledWith('attempts', 3);
    });

    it('should throw on unknown job type', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'UNKNOWN_JOB_TYPE',
          payload: {},
          status: 'pending',
          attempts: 0,
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockLt = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({ data: mockJobs, error: null });
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: mockUpdateEq,
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
      });

      (mockSupabase as unknown as MockSupabaseClient).from = mockFrom;
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ lt: mockLt });
      mockLt.mockReturnValue({ limit: mockLimit });

      await JobQueue.processBatch(mockSupabase);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          last_error: 'Unknown job type: UNKNOWN_JOB_TYPE',
        })
      );
    });
  });

  describe('processPending', () => {
    it('should call processBatch', async () => {
      const processBatchSpy = vi.spyOn(JobQueue, 'processBatch').mockResolvedValue(undefined);

      await JobQueue.processPending(mockSupabase);

      expect(processBatchSpy).toHaveBeenCalledWith(mockSupabase);

      processBatchSpy.mockRestore();
    });
  });
});
