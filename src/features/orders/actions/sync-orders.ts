'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Clean up empty draft orders older than a specified number of days
 * This function is designed to be called by a cron job with admin privileges
 *
 * @param supabaseAdmin - Supabase client with admin/service role privileges
 * @param daysOld - Number of days to consider a draft as "old" (default: 7)
 * @returns Object with count of deleted orders and any errors
 */
export async function cleanupEmptyDrafts(
  supabaseAdmin: SupabaseClient<Database>,
  daysOld: number = 7
): Promise<{ deletedCount: number; errors: string[] }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Find draft orders older than cutoff date
    const { data: oldDrafts, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at')
      .eq('status', 'draft')
      .lt('created_at', cutoffDate.toISOString());

    if (fetchError) {
      console.error('[Cleanup] Error fetching old drafts:', fetchError);
      return { deletedCount: 0, errors: [fetchError.message] };
    }

    if (!oldDrafts || oldDrafts.length === 0) {
      console.error('[Cleanup] No old draft orders found');
      return { deletedCount: 0, errors: [] };
    }

    console.error(`[Cleanup] Found ${oldDrafts.length} old draft orders`);

    const deletedIds: string[] = [];
    const errors: string[] = [];

    // Check each draft for items and delete if empty
    for (const draft of oldDrafts) {
      try {
        // Check if order has any items
        const { data: items, error: itemsError } = await supabaseAdmin
          .from('order_items')
          .select('id')
          .eq('order_id', draft.id)
          .limit(1);

        if (itemsError) {
          errors.push(`Error checking items for order ${draft.id}: ${itemsError.message}`);
          continue;
        }

        // If no items, delete the order (conversation history is not valuable without items)
        if (!items || items.length === 0) {
          const { error: deleteError } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', draft.id);

          if (deleteError) {
            errors.push(`Error deleting order ${draft.id}: ${deleteError.message}`);
          } else {
            deletedIds.push(draft.id);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Error processing order ${draft.id}: ${errorMsg}`);
      }
    }

    console.error(`[Cleanup] Deleted ${deletedIds.length} empty draft orders`);
    if (errors.length > 0) {
      console.error('[Cleanup] Errors during cleanup:', errors);
    }

    return { deletedCount: deletedIds.length, errors };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cleanup] Fatal error during cleanup:', errorMsg);
    return { deletedCount: 0, errors: [errorMsg] };
  }
}
