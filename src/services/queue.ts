import { createClient } from '@/lib/supabase/server';
import { NotificationService } from '@/services/notifications';
import { SupabaseClient } from '@supabase/supabase-js';

export type JobType = 'SEND_SUPPLIER_ORDER';

export interface JobPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export class JobQueue {
  /**
   * Enqueue a new job
   */
  static async enqueue(type: JobType, payload: JobPayload, client?: SupabaseClient) {
    const supabase = client ?? (await createClient());

    const { error } = await supabase.from('jobs').insert({
      type,
      payload,
      status: 'pending',
    });

    if (error) {
      console.error('Error enqueuing job:', error);
      throw new Error('Failed to enqueue job');
    }
  }

  /**
   * Process pending jobs (Fire-and-forget style for now)
   * In a real production setup, this would be a separate worker
   */
  static async processPending(client?: SupabaseClient) {
    // We'll implement the processor logic here or in a separate route
    // For now, we can call the processor directly for immediate execution
    // but wrapped in a way that doesn't block the response if possible,
    // or just process one batch.

    // Ideally, we call an API endpoint that handles the processing
    // fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cron/process-jobs`, { method: 'POST' });

    // For this MVP/Refactor, we will just execute the logic directly
    // but we need to be careful about timeouts.
    await this.processBatch(client);
  }

  /**
   * Process a batch of pending jobs
   */
  static async processBatch(client?: SupabaseClient) {
    const supabase = client ?? (await createClient());

    // 1. Lock and fetch pending jobs
    // Note: Supabase/Postgres doesn't have easy "SKIP LOCKED" in JS client without RPC
    // We'll do a simple fetch for now. Concurrency might be an issue if scaled,
    // but for now it's fine.
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3) // Max attempts check
      .limit(20); // Increased from 5 to 20 for faster processing

    if (error || !jobs || jobs.length === 0) return;

    // 2. Process each job
    for (const job of jobs) {
      try {
        // Mark as processing
        await supabase
          .from('jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        // Execute job logic based on type
        await this.executeJob(job, client);

        // Mark as completed
        await supabase
          .from('jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', job.id);
      } catch (err) {
        console.error(`Job ${job.id} failed:`, err);

        const newAttempts = job.attempts + 1;
        const hasRetriesLeft = newAttempts < 3;

        // If has retries left, mark as 'pending' to retry
        // If no retries left, mark as 'failed' permanently
        await supabase
          .from('jobs')
          .update({
            status: hasRetriesLeft ? 'pending' : 'failed',
            attempts: newAttempts,
            last_error: err instanceof Error ? err.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async executeJob(job: any, client?: SupabaseClient) {
    switch (job.type) {
      case 'SEND_SUPPLIER_ORDER':
        if (!job.payload.supplierOrderId) throw new Error('Missing supplierOrderId');
        await NotificationService.sendSupplierOrder(job.payload.supplierOrderId, client);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }
}
