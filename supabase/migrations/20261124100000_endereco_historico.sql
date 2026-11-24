begin;

-- O Supabase Auth assina app_metadata. O próprio cliente só pode mudar user_metadata.
create or replace function public.id_conta_cliente()
returns uuid language sql stable security invoker set search_path = ''
as $$
  select case when auth.jwt() -> 'app_metadata' -> 'customer_account' = 'true'::jsonb
    and auth.jwt() -> 'is_anonymous' = 'false'::jsonb then auth.uid() end;
$$;
revoke all on function public.id_conta_cliente() from public, anon, authenticated;
grant execute on function public.id_conta_cliente() to authenticated;

create table if not exists public.customer_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  street text not null check (trim(street) <> '' and length(street) <= 120),
  number text not null check (trim(number) <> '' and length(number) <= 120),
  district text not null check (length(district) <= 120),
  zone_id text check (trim(zone_id) <> '' and length(zone_id) <= 40),
  reference text not null default '' check (length(reference) <= 120),
  check (trim(district) <> '' or (zone_id is not null and zone_id <> 'outro'))
);
alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from public, anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
drop policy if exists "cliente gerencia o proprio endereco" on public.customer_addresses;
create policy "cliente gerencia o proprio endereco" on public.customer_addresses
  for all to authenticated
  using (user_id = (select public.id_conta_cliente()))
  with check (user_id = (select public.id_conta_cliente()));

-- orders continua reservada ao vendedor e ao servidor. A conta recebe somente
-- os campos de histórico do seu próprio UUID, inclusive os acréscimos à compra.
create or replace function public.historico_cliente(p_offset integer default 0)
returns table (
  id uuid, code text, created_at timestamptz, status text, fulfillment text,
  total_cents integer, carts jsonb, items jsonb
)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.code, o.created_at, o.status, o.fulfillment, o.total_cents,
    jsonb_build_array(o.cart) || jsonb_path_query_array(o.additions, '$[*].cart'),
    o.items || jsonb_path_query_array(o.additions, '$[*].items[*]')
  from public.orders o
  where o.customer_user_id = (select public.id_conta_cliente())
  order by o.created_at desc, o.id desc
  limit 20 offset greatest(p_offset, 0);
$$;
revoke all on function public.historico_cliente(integer) from public, anon, authenticated;
grant execute on function public.historico_cliente(integer) to authenticated;

-- Reaplica o acesso mínimo inclusive em projetos com grants automáticos antigos.
revoke all on public.orders, public.order_events, public.sellers from public, anon, authenticated;
grant select on public.orders, public.order_events, public.sellers to authenticated;
grant update(status) on public.orders to authenticated;
drop policy if exists "vendedor se ve" on public.sellers;
create policy "vendedor se ve" on public.sellers
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_seller()));

commit;
