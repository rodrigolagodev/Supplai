-- Create jobs table for async processing
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS (only service role should access, but good practice)
alter table public.jobs enable row level security;

-- Remove legacy trigger and function
drop trigger if exists on_order_sent on public.orders;
drop function if exists public.handle_order_submission();
