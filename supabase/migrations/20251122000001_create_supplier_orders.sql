-- Create supplier_orders table
create table public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null check (status in ('pending', 'sending', 'sent', 'failed', 'delivered')) default 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Prevent duplicate orders for the same supplier in the same session
  unique(order_id, supplier_id)
);

-- Enable RLS
alter table public.supplier_orders enable row level security;

-- Policies
create policy "Users can view supplier orders for their organization"
  on public.supplier_orders for select
  using (
    exists (
      select 1 from public.orders o
      join public.memberships m on o.organization_id = m.organization_id
      where o.id = supplier_orders.order_id
      and m.user_id = auth.uid()
    )
  );

-- Function to automatically create supplier orders when main order is sent
create or replace function public.handle_order_submission()
returns trigger as $$
begin
  -- Only proceed if status changed to 'sent'
  if new.status = 'sent' and (old.status is null or old.status <> 'sent') then
    insert into public.supplier_orders (order_id, supplier_id, status)
    select distinct 
      new.id,
      supplier_id,
      'pending'
    from public.order_items
    where order_id = new.id
    and supplier_id is not null
    on conflict (order_id, supplier_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_order_sent
  after update on public.orders
  for each row
  execute function public.handle_order_submission();
