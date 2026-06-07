-- Drop the pg_net trigger that called the Supabase Edge Function on job insert.
--
-- Rationale:
--   * The trigger function `notify_new_job` (added in 20251126000000) hardcoded the
--     Supabase service_role_key in plaintext, leaking it into the repo/git history.
--   * Email sending is now consolidated inside the Cloudflare Worker: orders are sent
--     inline from the submit server action, with a Cloudflare Cron Trigger as the
--     retry/fallback processor. The Edge Function + DB trigger are no longer used.
--
-- The leaked key must still be ROTATED in the Supabase dashboard (it remains in git
-- history); dropping the function only removes it from the active schema.

drop trigger if exists on_job_inserted on public.jobs;
drop function if exists public.notify_new_job();

-- The job-processing indexes from 20251126000000 are still useful for the cron
-- processor, so they are intentionally kept.
