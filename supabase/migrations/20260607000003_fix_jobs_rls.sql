-- Fix contradictory RLS on public.jobs.
--
-- Migration 20251123000002 created TWO insert policies:
--   1. "Users can insert jobs"            WITH CHECK (true)
--   2. "Users can insert their own jobs"  WITH CHECK (user_id = auth.uid())
-- Permissive policies are OR'd, so policy (1) nullified policy (2): any authenticated
-- user could insert jobs with an arbitrary (or null) user_id. Drop the permissive one.

drop policy if exists "Users can insert jobs" on public.jobs;

-- The remaining policies (insert/select/update WHERE user_id = auth.uid()) are correct.
-- The cron processor uses the service role, which bypasses RLS.
