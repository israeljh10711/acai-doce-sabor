-- Pedido 100% no site: acompanhamento do cliente e itens a mais no mesmo pedido (2026-11-20).
--
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode DEPOIS do 20261120180000_painel_ao_vivo.sql. Passo a passo em docs/supabase.md (passo 2.7).
--
-- O que este script faz, sem apagar nem mudar nenhum pedido:
-- * orders ganha:
--   - customer_user_id: a sessão anônima do cliente que fez o pedido (Supabase Auth). É ela que
--     autoriza o cliente a acompanhar e acrescentar itens; o código ADS-0001 nunca autoriza nada;
--   - updated_at: quando o pedido mudou pela última vez;
--   - additions: os lotes de itens que o cliente acrescentou depois (os itens originais ficam
--     intactos em items);
-- * order_events: o histórico do pedido (cada situação e cada acréscimo, com o horário real),
--   preenchido pelo próprio banco. O cliente lê só os eventos dele; o vendedor lê todos. Entra no
--   Realtime: é por ele que a tela de acompanhamento sabe que algo mudou;
-- * adicionar_itens_pedido: acrescenta itens numa transação só, com o pedido travado, conferindo
--   o dono, a situação (só novo ou preparando), a repetição e o troco. Só a função "pedido" chama;
-- * antes_de_criar_usuario: o gancho "Before User Created" do Supabase Auth, que aceita só a
--   sessão anônima (precisa ser ligado no painel: Authentication > Hooks).
--
-- Permissões: visitantes continuam sem nada; o cliente (sessão anônima) não lê a tabela orders,
-- só os próprios eventos; o vendedor lê tudo e muda só a situação; só a função grava.

begin;

-- 1. orders: dono, atualização e acréscimos.
alter table public.orders add column if not exists customer_user_id uuid references auth.users (id) on delete set null;
alter table public.orders add column if not exists updated_at timestamptz;
update public.orders set updated_at = created_at where updated_at is null;
alter table public.orders alter column updated_at set default now();
alter table public.orders alter column updated_at set not null;
alter table public.orders add column if not exists additions jsonb not null default '[]'::jsonb;
alter table public.orders drop constraint if exists orders_additions_check;
alter table public.orders add constraint orders_additions_check check (jsonb_typeof(additions) = 'array');
create index if not exists orders_customer_user_idx on public.orders (customer_user_id, created_at desc);

-- 2. O histórico do pedido.
create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Cópia do dono do pedido, para o RLS (e o Realtime) decidir sem consultar outra tabela.
  customer_user_id uuid,
  kind text not null check (kind in ('status', 'itens')),
  status text not null,
  source text not null check (source in ('cliente', 'vendedor', 'sistema')),
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);
create index if not exists order_events_customer_idx on public.order_events (customer_user_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists "cliente le os proprios eventos" on public.order_events;
create policy "cliente le os proprios eventos" on public.order_events
  for select to authenticated using (customer_user_id is not null and customer_user_id = auth.uid());

drop policy if exists "vendedor le os eventos" on public.order_events;
create policy "vendedor le os eventos" on public.order_events
  for select to authenticated using (public.is_seller());

revoke all on public.order_events from anon, authenticated;
grant select on public.order_events to authenticated;
grant select, insert on public.order_events to service_role;

-- Pedidos de antes deste script: o "recebido" com o horário em que foram gravados (os outros
-- horários não existem e não são inventados).
insert into public.order_events (order_id, customer_user_id, kind, status, source, created_at)
select o.id, o.customer_user_id, 'status', 'novo', 'sistema', o.created_at
from public.orders o
where not exists (select 1 from public.order_events e where e.order_id = o.id);

-- 3. Gatilhos: a hora da última mudança e o histórico de cada situação.
create or replace function public.pedido_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_atualizado_em on public.orders;
create trigger orders_atualizado_em
  before update on public.orders
  for each row execute function public.pedido_atualizado_em();

-- Roda com o dono da função: o vendedor muda a situação, mas não grava eventos direto.
create or replace function public.registrar_evento_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, customer_user_id, kind, status, source)
    values (new.id, new.customer_user_id, 'status', new.status, 'cliente');
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, customer_user_id, kind, status, source)
    values (new.id, new.customer_user_id, 'status', new.status, case when public.is_seller() then 'vendedor' else 'sistema' end);
  end if;
  return null;
end;
$$;

revoke all on function public.registrar_evento_pedido() from public, anon, authenticated;

drop trigger if exists orders_registra_evento on public.orders;
create trigger orders_registra_evento
  after insert or update of status on public.orders
  for each row execute function public.registrar_evento_pedido();

-- 4. Realtime: o histórico entra na publicação (orders já entrou no 20261120180000).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'A publicação supabase_realtime não existe neste banco: o Realtime não foi ligado.';
  elsif not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events'
  ) then
    alter publication supabase_realtime add table public.order_events;
  end if;
end
$$;

-- 5. Acrescentar itens ao pedido (só a função "pedido", com a chave de servidor, chama).
create or replace function public.adicionar_itens_pedido(
  p_order_id uuid,
  p_customer_user_id uuid,
  p_attempt_key text,
  p_batch jsonb,
  p_subtotal_cents integer,
  p_change_for_cents integer,
  p_change_set boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  o public.orders%rowtype;
  novo_total integer;
  novo_troco integer;
begin
  if p_subtotal_cents is null or p_subtotal_cents <= 0 or char_length(coalesce(p_attempt_key, '')) <> 64 or jsonb_typeof(p_batch) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'reason', 'pedido-invalido');
  end if;

  -- Trava o pedido: o vendedor mudando a situação, ou outro acréscimo, espera esta transação.
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.customer_user_id is null or o.customer_user_id <> p_customer_user_id then
    return jsonb_build_object('ok', false, 'reason', 'nao-encontrado');
  end if;

  -- O mesmo acréscimo mandado de novo (toque duplo, internet que caiu): devolve o que já foi feito.
  if exists (select 1 from jsonb_array_elements(o.additions) as lote where lote ->> 'attempt_key' = p_attempt_key) then
    return jsonb_build_object('ok', true, 'repeated', true, 'subtotal_cents', o.subtotal_cents, 'total_cents', o.total_cents, 'change_for_cents', o.change_for_cents);
  end if;

  if o.status not in ('novo', 'preparando') then
    return jsonb_build_object('ok', false, 'reason', 'situacao', 'status', o.status);
  end if;

  -- O frete não muda (nunca é cobrado de novo): o total cresce só pelos itens.
  novo_total := o.total_cents + p_subtotal_cents;
  novo_troco := case when o.payment_method = 'dinheiro' and p_change_set then p_change_for_cents else o.change_for_cents end;
  if o.payment_method = 'dinheiro' and novo_troco is not null and novo_troco < novo_total then
    return jsonb_build_object('ok', false, 'reason', 'troco', 'total_cents', novo_total);
  end if;

  update public.orders set
    additions = additions || jsonb_build_array(p_batch || jsonb_build_object('attempt_key', p_attempt_key, 'created_at', now(), 'subtotal_cents', p_subtotal_cents)),
    subtotal_cents = subtotal_cents + p_subtotal_cents,
    total_cents = novo_total,
    change_for_cents = case when payment_method = 'dinheiro' then novo_troco else change_for_cents end
  where id = p_order_id;

  insert into public.order_events (order_id, customer_user_id, kind, status, source)
  values (o.id, o.customer_user_id, 'itens', o.status, 'cliente');

  return jsonb_build_object('ok', true, 'repeated', false, 'subtotal_cents', o.subtotal_cents + p_subtotal_cents, 'total_cents', novo_total, 'change_for_cents', novo_troco);
end;
$$;

revoke all on function public.adicionar_itens_pedido(uuid, uuid, text, jsonb, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.adicionar_itens_pedido(uuid, uuid, text, jsonb, integer, integer, boolean) to service_role;

-- 6. Gancho "Before User Created": só a sessão anônima de acompanhamento pode ser criada pelo
--    site. Cadastro com e-mail ou telefone é recusado (para criar outra conta de vendedor, desligue
--    o gancho por um instante em Authentication > Hooks).
create or replace function public.antes_de_criar_usuario(event jsonb)
returns jsonb
language plpgsql
stable
as $$
begin
  if coalesce((event -> 'user' ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error',
    jsonb_build_object('http_code', 403, 'message', 'Cadastros fechados: o site só cria a sessão anônima de acompanhamento de pedidos.')
  );
end;
$$;

revoke all on function public.antes_de_criar_usuario(jsonb) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.antes_de_criar_usuario(jsonb) to supabase_auth_admin;
  end if;
end
$$;

commit;
