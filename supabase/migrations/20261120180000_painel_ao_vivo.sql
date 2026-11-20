-- Painel de pedidos ao vivo (pedido de 2026-11-20).
--
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode DEPOIS do 20261120120000_modalidades_gps.sql. Passo a passo em docs/supabase.md.
--
-- O que este script faz, sem apagar nem mudar nenhum pedido:
-- * a situação (status) passa a aceitar o "pronto" de cada modalidade:
--   pronto_retirada (ready_for_pickup) e pronto_consumo (ready_for_dine_in). A entrega continua
--   com saiu_para_entrega (out_for_delivery). "confirmado" e "pronto" continuam valendo para os
--   pedidos antigos;
-- * regra que liga a situação à modalidade: saiu_para_entrega só na entrega, pronto_retirada só
--   na retirada, pronto_consumo só no comer no local;
-- * a tabela orders entra na publicação do Supabase Realtime, para o painel do vendedor receber
--   os pedidos na hora.
--
-- As permissões não mudam: só o vendedor logado lê os pedidos (também pelo Realtime, que segue o
-- RLS) e muda só a situação; visitantes não leem nem mudam nada; só a função grava.

begin;

-- 1. As situações.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in ('novo', 'confirmado', 'preparando', 'pronto', 'pronto_retirada', 'pronto_consumo', 'saiu_para_entrega', 'concluido', 'cancelado')
);

-- 2. A situação combina com a modalidade (retirar e comer no local nunca "saem para entrega").
alter table public.orders drop constraint if exists orders_status_modalidade_check;
alter table public.orders add constraint orders_status_modalidade_check check (
  (status <> 'saiu_para_entrega' or fulfillment = 'entrega')
  and (status <> 'pronto_retirada' or fulfillment = 'retirada')
  and (status <> 'pronto_consumo' or fulfillment = 'local')
);

-- 3. Realtime: a tabela na publicação supabase_realtime (que todo projeto do Supabase tem).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'A publicação supabase_realtime não existe neste banco: o Realtime não foi ligado.';
  elsif not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

commit;
