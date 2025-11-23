-- Allow authenticated users to insert jobs (e.g. when sending an order)
create policy "Users can insert jobs"
on public.jobs
for insert
to authenticated
with check (true);

-- Allow users to view their own jobs? 
-- For now, maybe not needed if the UI doesn't show jobs directly.
-- But if we want to debug or show status, maybe.
-- Let's keep it minimal: Insert only for now.
-- The processing happens via Service Role (or we need a policy for that if we run it as user? 
-- The `processPending` in `actions.ts` runs as the USER!
-- So the user ALSO needs SELECT and UPDATE on jobs they created?
-- Or `processPending` should ideally run as Service Role?
-- In `actions.ts`, `JobQueue.processPending()` calls `createClient()` which is the user session.
-- So the user DOES need permission to SELECT and UPDATE the jobs they just created (or any pending job?).
-- If the user processes *any* pending job, that's a security risk (they could process other people's jobs).
-- Ideally, `processPending` should only process jobs *created by the user* OR we should use a Service Role client for processing.

-- Better approach for `processPending` in `actions.ts`:
-- It should probably use a Service Role client if possible, but we can't easily get one in Server Actions without the key.
-- So, we should allow the user to process *their own* jobs?
-- But `jobs` table doesn't have `user_id` or `organization_id`.
-- We should probably add `created_by` to `jobs`.

-- ALTERNATIVE:
-- For this refactor, since we want to unblock:
-- Allow authenticated users to SELECT/UPDATE *any* job? No, bad.
-- Allow authenticated users to SELECT/UPDATE jobs where `payload->>'organization_id'` matches their org?
-- That requires JSONB filtering in RLS, which is fine.
-- But `jobs` payload structure varies.

-- Let's look at `sendOrder` payload: `{ supplierOrderId: ... }`.
-- `supplier_orders` has `order_id`. `orders` has `organization_id`.
-- Complex join for RLS.

-- SIMPLEST FIX for now:
-- 1. Add `user_id` to `jobs` (nullable).
-- 2. Update `enqueue` to save `user_id`.
-- 3. RLS: Users can ALL on jobs where `user_id = auth.uid()`.

-- Let's modify the migration to add `user_id` and policies.
alter table public.jobs add column user_id uuid references auth.users(id);

create policy "Users can insert their own jobs"
on public.jobs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can select their own jobs"
on public.jobs
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can update their own jobs"
on public.jobs
for update
to authenticated
using (user_id = auth.uid());
