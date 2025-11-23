-- Allow users to insert supplier_orders if they are members of the organization owning the order
create policy "Users can insert supplier orders for their organization"
on public.supplier_orders for insert
to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = supplier_orders.order_id
    and public.is_member_of(o.organization_id)
  )
);

-- Allow users to update supplier_orders if they are members of the organization owning the order
create policy "Users can update supplier orders for their organization"
on public.supplier_orders for update
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = supplier_orders.order_id
    and public.is_member_of(o.organization_id)
  )
);
