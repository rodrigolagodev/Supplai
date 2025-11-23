-- Backfill missing supplier_orders for sent orders
-- This creates supplier_orders for any sent order that doesn't have them yet

insert into public.supplier_orders (order_id, supplier_id, status)
select distinct 
  oi.order_id,
  oi.supplier_id,
  'pending' as status
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.status = 'sent'
  and oi.supplier_id is not null
  and not exists (
    select 1 
    from public.supplier_orders so 
    where so.order_id = oi.order_id 
      and so.supplier_id = oi.supplier_id
  )
on conflict (order_id, supplier_id) do nothing;
