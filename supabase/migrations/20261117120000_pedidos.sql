-- Pedidos do Açaí Doce Sabor (pedido de 2026-11-17, opção A).
--
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode DEPOIS do 20261116000000_modo_vendedor.sql (este usa a função is_seller de lá).
-- Passo a passo completo em docs/supabase.md.
--
-- O que este script faz:
-- * orders: os pedidos registrados pela função "pedido", com o código ADS-0001, ADS-0002...
--   O site não lê nem grava esta tabela. Só a função grava (com a chave de servidor), e o
--   vendedor logado lê e muda a situação (novo, confirmado, preparando...).
-- * a sequência dos números e a função que entrega o próximo, só para o servidor.

create sequence if not exists public.order_number_seq;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique,
  code text not null unique,
  -- Resumo (SHA-256) do pedido inteiro: o mesmo pedido enviado de novo não vira outro.
  attempt_key text not null unique check (char_length(attempt_key) = 64),
  created_at timestamptz not null default now(),
  status text not null default 'novo'
    check (status in ('novo', 'confirmado', 'preparando', 'pronto', 'saiu_para_entrega', 'concluido', 'cancelado')),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 20),
  fulfillment text not null check (fulfillment in ('entrega', 'retirada')),
  address jsonb,
  delivery_fee text not null check (delivery_fee in ('retirada', 'gratis', 'taxa', 'combinar')),
  delivery_fee_cents integer not null default 0 check (delivery_fee_cents >= 0),
  delivery_zone text,
  payment_method text not null check (payment_method in ('pix', 'credito', 'debito', 'dinheiro')),
  change_for_cents integer check (change_for_cents is null or change_for_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  antecipado boolean not null default false,
  -- O WhatsApp da loja para onde o pedido foi mandado.
  whatsapp text not null,
  -- Cópia dos nomes e preços do momento da compra, e o carrinho conferido.
  items jsonb not null default '[]'::jsonb,
  cart jsonb not null default '{}'::jsonb,
  -- A comanda do WhatsApp, com o código.
  message text not null check (char_length(message) <= 60000)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);

alter table public.orders enable row level security;

-- Visitantes: nenhum acesso (sem política para anon). O vendedor (tabela sellers) lê os pedidos...
drop policy if exists "vendedor le os pedidos" on public.orders;
create policy "vendedor le os pedidos" on public.orders
  for select to authenticated using (public.is_seller());

-- ...e muda só a situação do pedido (o resto fica como a função gravou).
drop policy if exists "vendedor muda a situacao" on public.orders;
create policy "vendedor muda a situacao" on public.orders
  for update to authenticated using (public.is_seller()) with check (public.is_seller());

revoke insert, update, delete on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;

-- O próximo número de pedido. Só o servidor (a chave de servidor da função) pode pedir.
create or replace function public.proximo_numero_pedido()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.order_number_seq');
$$;

revoke all on function public.proximo_numero_pedido() from public, anon, authenticated;
grant execute on function public.proximo_numero_pedido() to service_role;
