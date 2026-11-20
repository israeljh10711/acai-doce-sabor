-- Três modalidades de pedido e GPS na entrega (pedido de 2026-11-20).
--
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode DEPOIS do 20261117120000_pedidos.sql e do 20261120000000_permissoes.sql, e ANTES de colar
-- a função "pedido" nova (ela grava as colunas novas). Passo a passo em docs/supabase.md.
--
-- O que este script faz, sem apagar nem mudar nenhum pedido:
-- * fulfillment (a modalidade) passa a aceitar 'local' (comer na sorveteria), além de 'entrega' e
--   'retirada' (buscar e levar). No código: entrega = delivery, retirada = pickup, local = dine_in;
-- * delivery_fee passa a aceitar 'local' (sempre grátis);
-- * colunas novas, vazias nos pedidos antigos: customer_lat, customer_lng e maps_url (o GPS que o
--   cliente anexou na entrega);
-- * regras no banco: GPS só na entrega e completo (as três colunas juntas, coordenadas válidas e o
--   link do Google Maps); retirada e local sempre sem frete e sem endereço.
--
-- As permissões não mudam: o vendedor já lê a tabela inteira (as colunas novas também) e só muda a
-- situação; os visitantes continuam sem acesso; só a função grava.

begin;

-- 1. A terceira modalidade.
alter table public.orders drop constraint if exists orders_fulfillment_check;
alter table public.orders add constraint orders_fulfillment_check
  check (fulfillment in ('entrega', 'retirada', 'local'));

alter table public.orders drop constraint if exists orders_delivery_fee_check;
alter table public.orders add constraint orders_delivery_fee_check
  check (delivery_fee in ('retirada', 'local', 'gratis', 'taxa', 'combinar'));

-- 2. O GPS da entrega (opcional).
alter table public.orders add column if not exists customer_lat double precision;
alter table public.orders add column if not exists customer_lng double precision;
alter table public.orders add column if not exists maps_url text;

-- 3. Coerência: o GPS vem completo e só na entrega; nunca latitude sem longitude.
--    (Os "is not null" são necessários: no SQL, uma regra com valor nulo não conta como falsa.)
alter table public.orders drop constraint if exists orders_gps_check;
alter table public.orders add constraint orders_gps_check check (
  (customer_lat is null and customer_lng is null and maps_url is null)
  or (
    fulfillment = 'entrega'
    and customer_lat is not null
    and customer_lng is not null
    and maps_url is not null
    and customer_lat between -90 and 90
    and customer_lng between -180 and 180
    and maps_url like 'https://www.google.com/maps?q=%'
    and char_length(maps_url) <= 120
  )
);

-- 4. Coerência: a modalidade e o frete andam juntos. Retirada e local nunca têm frete nem endereço.
--    Os pedidos antigos já seguem esta regra (a função sempre gravou assim).
alter table public.orders drop constraint if exists orders_modalidade_frete_check;
alter table public.orders add constraint orders_modalidade_frete_check check (
  (fulfillment = 'entrega' and delivery_fee in ('gratis', 'taxa', 'combinar'))
  or (fulfillment = 'retirada' and delivery_fee = 'retirada' and delivery_fee_cents = 0 and address is null)
  or (fulfillment = 'local' and delivery_fee = 'local' and delivery_fee_cents = 0 and address is null)
);

comment on column public.orders.fulfillment is 'Modalidade: entrega (delivery), retirada (pickup: busca e leva) ou local (dine_in: come na sorveteria).';
comment on column public.orders.customer_lat is 'Latitude do GPS anexado pelo cliente na entrega (6 casas). Nula sem GPS e em retirada/local.';
comment on column public.orders.customer_lng is 'Longitude do GPS anexado pelo cliente na entrega (6 casas). Nula sem GPS e em retirada/local.';
comment on column public.orders.maps_url is 'https://www.google.com/maps?q=LAT,LNG com as coordenadas gravadas. Nulo sem GPS.';

commit;
