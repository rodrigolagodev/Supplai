import { createClient } from '@supabase/supabase-js';
import { JobQueue } from '@/services/queue';
import type { Database } from '@/types/database';

export interface CronResult {
  processed: true;
  deletedDrafts: number;
  cleanupErrors: string[];
}

/**
 * Run the periodic job processing + housekeeping. Shared by:
 *   - the Cloudflare Cron Trigger (`scheduled()` in the worker entry), and
 *   - the manual HTTP endpoint (`/api/cron/process-jobs`, guarded by CRON_SECRET).
 *
 * Uses a service-role client so it can process pending jobs across all users
 * (bypassing RLS). Only retries jobs older than `olderThanMinutes` so the inline
 * send path (in the submit action) gets first crack at fresh jobs.
 */
export async function processJobsCron(
  supabaseUrl: string,
  serviceRoleKey: string,
  olderThanMinutes = 1
): Promise<CronResult> {
  const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await JobQueue.processBatch(supabaseAdmin, olderThanMinutes);

  // Cleanup empty draft orders older than 7 days.
  const { cleanupEmptyDrafts } = await import('@/features/orders/actions/sync-orders');
  const cleanup = await cleanupEmptyDrafts(supabaseAdmin, 7);

  return {
    processed: true,
    deletedDrafts: cleanup.deletedCount,
    cleanupErrors: cleanup.errors,
  };
}
