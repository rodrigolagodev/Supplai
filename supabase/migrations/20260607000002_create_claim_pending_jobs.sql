-- Atomic job claiming to prevent double-processing (and therefore duplicate emails).
--
-- The old processBatch did `select status='pending'` then `update status='processing'`
-- in two steps, leaving a race window where two concurrent processors (or the inline
-- path + the cron) could both pick up the same job. This RPC claims rows atomically
-- using FOR UPDATE SKIP LOCKED so each pending job is handed to exactly one caller.
--
-- p_user_id: when provided, only the caller's own jobs are claimed (used by the inline
--   send path in the submit server action). The cron passes NULL to claim across all
--   users (it runs with the service role).

create or replace function public.claim_pending_jobs(
  p_limit int default 20,
  p_older_than_minutes int default 0,
  p_user_id uuid default null
)
returns setof public.jobs
language sql
security definer
set search_path = public
as $$
  update public.jobs j
  set status = 'processing', updated_at = now()
  where j.id in (
    select id from public.jobs
    where status = 'pending'
      and attempts < max_attempts
      and created_at <= now() - make_interval(mins => p_older_than_minutes)
      and (p_user_id is null or user_id = p_user_id)
    order by created_at
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;

revoke all on function public.claim_pending_jobs(int, int, uuid) from public;
grant execute on function public.claim_pending_jobs(int, int, uuid) to authenticated, service_role;
