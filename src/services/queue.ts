import { createClient } from '@/lib/supabase/server';
import { NotificationService } from '@/services/notifications';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type JobType = 'SEND_SUPPLIER_ORDER';

export interface JobPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

type JobRow = Database['public']['Tables']['jobs']['Row'];

/**
 * Error thrown by job execution that should NOT be retried (e.g. invalid email,
 * unknown job type). Permanent failures are marked `failed` immediately instead
 * of cycling through retries.
 */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}

/**
 * Decide whether a thrown error should be retried. Defaults to retriable so that
 * transient issues (rate limits, 5xx, network/timeouts) get another attempt, while
 * clearly permanent errors are surfaced via PermanentJobError.
 */
function isRetriableError(error: unknown): boolean {
  if (error instanceof PermanentJobError) return false;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // Permanent: bad recipient / validation problems are not worth retrying.
  if (
    message.includes('no email') ||
    message.includes('invalid email') ||
    message.includes('email address') ||
    message.includes('unknown job type') ||
    message.includes('not found')
  ) {
    return false;
  }

  // Everything else (rate limit, 5xx, timeout, network) is treated as retriable.
  return true;
}

export class JobQueue {
  /**
   * Enqueue a new job
   */
  static async enqueue(type: JobType, payload: JobPayload, client?: SupabaseClient) {
    const supabase = client ?? (await createClient());

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to enqueue jobs');
    }

    const { error } = await supabase.from('jobs').insert({
      type,
      payload,
      status: 'pending',
      user_id: user.id,
    });

    if (error) {
      console.error('Error enqueuing job:', error);
      throw new Error('Failed to enqueue job');
    }
  }

  /**
   * Process a batch of pending jobs.
   *
   * Jobs are claimed atomically via the `claim_pending_jobs` RPC (FOR UPDATE SKIP
   * LOCKED), so concurrent processors (the inline submit path and the cron) never
   * pick up the same job — preventing duplicate supplier emails.
   *
   * @param client       Supabase client. Cron passes a service-role client; the
   *                     inline path passes the user's session client.
   * @param olderThanMinutes Only claim jobs older than N minutes (cron fallback).
   * @param userId       When set, only the user's own jobs are claimed (inline path).
   */
  static async processBatch(
    client?: SupabaseClient,
    olderThanMinutes: number = 0,
    userId?: string
  ) {
    const supabase = client ?? (await createClient());

    const { data: jobs, error } = await supabase.rpc('claim_pending_jobs', {
      p_limit: 20,
      p_older_than_minutes: olderThanMinutes,
      p_user_id: userId ?? null,
    });

    if (error) {
      console.error('Error claiming jobs:', error);
      return;
    }
    if (!jobs || jobs.length === 0) return;

    for (const job of jobs as JobRow[]) {
      try {
        await this.executeJob(job, client);

        await supabase
          .from('jobs')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', job.id);
      } catch (err) {
        console.error(`Job ${job.id} failed:`, err);

        const newAttempts = job.attempts + 1;
        const exhausted = newAttempts >= job.max_attempts;
        const retriable = isRetriableError(err);

        await supabase
          .from('jobs')
          .update({
            // Permanent errors or exhausted retries -> failed; otherwise back to pending.
            status: !retriable || exhausted ? 'failed' : 'pending',
            attempts: newAttempts,
            last_error: err instanceof Error ? err.message : 'Unknown error',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
      }
    }
  }

  private static async executeJob(job: JobRow, client?: SupabaseClient) {
    const payload = job.payload as JobPayload;
    switch (job.type) {
      case 'SEND_SUPPLIER_ORDER':
        if (!payload.supplierOrderId) throw new PermanentJobError('Missing supplierOrderId');
        await NotificationService.sendSupplierOrder(payload.supplierOrderId, client);
        break;
      default:
        throw new PermanentJobError(`Unknown job type: ${job.type}`);
    }
  }
}
