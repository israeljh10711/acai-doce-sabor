-- Cardápio dinâmico (2026-11-21): o cardápio passa a morar no banco.
--
-- O que esta migração faz (só acrescenta; não apaga nem muda tabela que já existe):
-- * tabelas do cardápio, com ids estáveis, chaves estrangeiras sem apagar em cascata, limites e
--   índices: categorias, produtos, tamanhos, escolhas e opções, grupos de complementos,
--   complementos, grupos de cada produto, ofertas, revisão do cardápio e registro da importação;
-- * RLS: o público lê só o que está visível e não arquivado; só o vendedor (is_seller) escreve;
-- * GRANT explícito (o projeto não dá permissão sozinho);
-- * Realtime: a revisão (catalog_meta) sobe a cada mudança do cardápio ou das configurações;
-- * catalogo_publico(): o cardápio inteiro num JSON, para o site e para a função pedido;
-- * catalogo_salvar_produto(): produto, tamanhos, escolhas e grupos numa transação só;
-- * catalogo_ordenar(): a ordem de uma lista ("Subir"/"Descer");
-- * fotos: o vendedor também pode trocar (update), só JPEG, PNG e WebP, até 2 MB, sem SVG;
-- * semente: o cardápio do código, só uma vez (nunca sobrescreve o que o vendedor mudou);
-- * conversão das mudanças antigas (catalog_changes) de itens, produtos, complementos e seções,
--   registrada em catalog_import_log. As Configurações da loja continuam em catalog_changes.
--
-- Pode rodar mais de uma vez.

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------

create table if not exists public.catalog_meta (
  id smallint primary key default 1 check (id = 1),
  revision bigint not null default 0,
  seeded_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.catalog_meta (id) values (1) on conflict (id) do nothing;

create table if not exists public.catalog_categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  subtitle text not null default '' check (char_length(subtitle) <= 600),
  icon text not null default 'gift'
    check (icon in ('crown', 'iceCreamBowl', 'cupSoda', 'iceCreamCone', 'gift', 'sailboat', 'popsicle', 'glassWater', 'candy')),
  layout text not null default 'grade' check (layout in ('vitrine', 'grade')),
  nav_label text not null default '' check (char_length(nav_label) <= 120),
  pill_label text not null default '' check (char_length(pill_label) <= 120),
  anchor text not null default '' check (anchor = '' or (anchor ~ '^[a-z0-9][a-z0-9-]*$' and char_length(anchor) <= 80)),
  keywords text[] not null default '{}' check (cardinality(keywords) <= 30),
  position integer not null default 0 check (position >= 0),
  visible boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Uma vitrine só ("Monte do seu jeito").
create unique index if not exists catalog_categories_uma_vitrine
  on public.catalog_categories (layout) where layout = 'vitrine' and archived_at is null;
create index if not exists catalog_categories_ordem on public.catalog_categories (position, id);

create table if not exists public.catalog_groups (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  rule text not null check (rule in ('limited', 'included', 'paid')),
  min_select integer not null default 0 check (min_select between 0 and 50),
  max_select integer check (max_select between 1 and 50),
  free_count integer check (free_count between 0 and 50),
  extra_price_cents integer not null default 0 check (extra_price_cents between 0 and 1000000),
  in_completo boolean not null default false,
  available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_select is null or max_select >= min_select)
);
create index if not exists catalog_groups_ordem on public.catalog_groups (position, id);

create table if not exists public.catalog_products (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  category_id text not null references public.catalog_categories (id) on delete restrict,
  kind text not null check (kind in ('montavel', 'variacoes', 'direto')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  -- Foto: caminho do site (images/...) ou endereço https do Storage. Nunca SVG.
  image text not null default ''
    check (char_length(image) <= 600 and (image = '' or image ~ '^(images/|https://)') and image !~* '\.svg($|[?#])'),
  image_alt text not null default '' check (char_length(image_alt) <= 600),
  price_cents integer not null default 0 check (price_cents between 0 and 1000000),
  compare_at_cents integer check (compare_at_cents between 0 and 1000000),
  badge text check (char_length(badge) <= 40),
  keywords text[] not null default '{}' check (cardinality(keywords) <= 30),
  completo boolean not null default false,
  flavors_from text references public.catalog_groups (id) on delete restrict,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 8000),
  position integer not null default 0 check (position >= 0),
  visible boolean not null default true,
  available boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- "Completo" e sabores tirados de um grupo são só do montável.
  check (kind = 'montavel' or (not completo and flavors_from is null))
);
create index if not exists catalog_products_categoria on public.catalog_products (category_id, position, id);

create table if not exists public.catalog_variants (
  product_id text not null references public.catalog_products (id) on delete restrict,
  id text not null check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  container text check (container in ('pote', 'copo', 'isopor', 'barca')),
  price_cents integer not null check (price_cents between 0 and 1000000),
  free_count integer not null default 0 check (free_count between 0 and 50),
  available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, id),
  -- O carrinho guarda o nome do tamanho: dois tamanhos com o mesmo nome confundiriam o pedido.
  constraint catalog_variants_nome_unico unique (product_id, name) deferrable initially deferred
);

create table if not exists public.catalog_choices (
  product_id text not null references public.catalog_products (id) on delete restrict,
  -- "tamanho" é a escolha dos tamanhos (catalog_variants).
  id text not null check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80 and id <> 'tamanho'),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  allow_other boolean not null default false,
  photo_alt text check (char_length(photo_alt) <= 600),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, id)
);

create table if not exists public.catalog_choice_options (
  product_id text not null,
  choice_id text not null,
  id text not null check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  photo text check (char_length(photo) <= 600 and photo ~ '^(images/|https://)' and photo !~* '\.svg($|[?#])'),
  available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, choice_id, id),
  foreign key (product_id, choice_id) references public.catalog_choices (product_id, id) on delete restrict,
  constraint catalog_choice_options_nome_unico unique (product_id, choice_id, name) deferrable initially deferred
);

create table if not exists public.catalog_options (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  group_id text not null references public.catalog_groups (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  price_cents integer not null default 0 check (price_cents between 0 and 1000000),
  image text check (char_length(image) <= 600 and image ~ '^(images/|https://)' and image !~* '\.svg($|[?#])'),
  look text check (look ~ '^[a-z0-9][a-z0-9-]*$' and char_length(look) <= 80),
  -- Complemento só deste produto (o leite condensado de cobertura, só no milk-shake).
  product_id text references public.catalog_products (id) on delete restrict,
  no_completo boolean not null default false,
  available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists catalog_options_grupo on public.catalog_options (group_id, position, id);
create index if not exists catalog_options_produto on public.catalog_options (product_id) where product_id is not null;

create table if not exists public.catalog_product_groups (
  product_id text not null references public.catalog_products (id) on delete restrict,
  group_id text not null references public.catalog_groups (id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  -- Máximo do grupo só neste produto (a barca: 2 frutas).
  max_select integer check (max_select between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, group_id)
);
create index if not exists catalog_product_groups_grupo on public.catalog_product_groups (group_id);

create table if not exists public.catalog_offers (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 80),
  product_id text not null references public.catalog_products (id) on delete restrict,
  variant_id text,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  subtitle text not null default '' check (char_length(subtitle) <= 600),
  badge_emoji text not null default '' check (char_length(badge_emoji) <= 16),
  badge_text text not null default '' check (char_length(badge_text) <= 60),
  promo_price_cents integer check (promo_price_cents between 0 and 1000000),
  position integer not null default 0 check (position >= 0),
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'arquivada')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at),
  -- Oferta de um tamanho: o tamanho precisa existir (e não pode ser apagado enquanto houver oferta).
  foreign key (product_id, variant_id) references public.catalog_variants (product_id, id) on delete restrict
);
create index if not exists catalog_offers_produto on public.catalog_offers (product_id, position, id);

create table if not exists public.catalog_import_log (
  source_kind text not null,
  source_id text not null,
  status text not null check (status in ('convertido', 'pendente')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (source_kind, source_id)
);

-- ---------------------------------------------------------------------------------------------
-- Gatilhos: atualizado em, revisão do cardápio e guardas
-- ---------------------------------------------------------------------------------------------

create or replace function public.catalogo_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- A revisão sobe a cada comando que muda o cardápio: o site ouve catalog_meta pelo Realtime.
create or replace function public.catalogo_nova_revisao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.catalog_meta set revision = revision + 1, updated_at = now() where id = 1;
  return null;
end
$$;
revoke all on function public.catalogo_nova_revisao() from public;

do $gatilhos$
declare
  tabela text;
begin
  foreach tabela in array array[
    'catalog_categories', 'catalog_groups', 'catalog_products', 'catalog_variants', 'catalog_choices',
    'catalog_choice_options', 'catalog_options', 'catalog_product_groups', 'catalog_offers'
  ] loop
    execute format('drop trigger if exists %I on public.%I', tabela || '_atualizado_em', tabela);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.catalogo_atualizado_em()',
      tabela || '_atualizado_em', tabela
    );
    execute format('drop trigger if exists %I on public.%I', tabela || '_revisao', tabela);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each statement execute function public.catalogo_nova_revisao()',
      tabela || '_revisao', tabela
    );
  end loop;
end
$gatilhos$;

-- As Configurações da loja (catalog_changes) também sobem a revisão.
drop trigger if exists catalog_changes_revisao on public.catalog_changes;
create trigger catalog_changes_revisao after insert or update or delete on public.catalog_changes
  for each statement execute function public.catalogo_nova_revisao();

-- Categoria com produtos não arquiva: o vendedor move ou arquiva os produtos antes.
create or replace function public.catalogo_guarda_categoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null and old.archived_at is null
     and exists (select 1 from public.catalog_products p where p.category_id = new.id and p.archived_at is null) then
    raise exception 'A categoria ainda tem produtos. Mova ou arquive os produtos antes.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
drop trigger if exists catalog_categories_guarda on public.catalog_categories;
create trigger catalog_categories_guarda before update on public.catalog_categories
  for each row execute function public.catalogo_guarda_categoria();

-- Na vitrine só entra produto montável (os cartões de "Monte do seu jeito").
create or replace function public.catalogo_guarda_produto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> 'montavel'
     and exists (select 1 from public.catalog_categories c where c.id = new.category_id and c.layout = 'vitrine') then
    raise exception 'Na vitrine só entram produtos montáveis.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
drop trigger if exists catalog_products_guarda on public.catalog_products;
create trigger catalog_products_guarda before insert or update on public.catalog_products
  for each row execute function public.catalogo_guarda_produto();

-- ---------------------------------------------------------------------------------------------
-- RLS e permissões
-- ---------------------------------------------------------------------------------------------

-- Produto público: visível, não arquivado e numa categoria visível e não arquivada.
create or replace function public.catalogo_produto_publico(produto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.catalog_products p
    join public.catalog_categories c on c.id = p.category_id
    where p.id = produto and p.visible and p.archived_at is null and c.visible and c.archived_at is null
  );
$$;
revoke all on function public.catalogo_produto_publico(text) from public;
grant execute on function public.catalogo_produto_publico(text) to anon, authenticated, service_role;

alter table public.catalog_meta enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.catalog_groups enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_variants enable row level security;
alter table public.catalog_choices enable row level security;
alter table public.catalog_choice_options enable row level security;
alter table public.catalog_options enable row level security;
alter table public.catalog_product_groups enable row level security;
alter table public.catalog_offers enable row level security;
alter table public.catalog_import_log enable row level security;

drop policy if exists "todos leem a revisao" on public.catalog_meta;
create policy "todos leem a revisao" on public.catalog_meta for select to anon, authenticated using (true);

drop policy if exists "todos leem categorias publicas" on public.catalog_categories;
create policy "todos leem categorias publicas" on public.catalog_categories
  for select to anon, authenticated using (visible and archived_at is null);

drop policy if exists "todos leem grupos" on public.catalog_groups;
create policy "todos leem grupos" on public.catalog_groups for select to anon, authenticated using (true);

drop policy if exists "todos leem produtos publicos" on public.catalog_products;
create policy "todos leem produtos publicos" on public.catalog_products
  for select to anon, authenticated using (public.catalogo_produto_publico(id));

drop policy if exists "todos leem tamanhos publicos" on public.catalog_variants;
create policy "todos leem tamanhos publicos" on public.catalog_variants
  for select to anon, authenticated using (public.catalogo_produto_publico(product_id));

drop policy if exists "todos leem escolhas publicas" on public.catalog_choices;
create policy "todos leem escolhas publicas" on public.catalog_choices
  for select to anon, authenticated using (public.catalogo_produto_publico(product_id));

drop policy if exists "todos leem opcoes publicas" on public.catalog_choice_options;
create policy "todos leem opcoes publicas" on public.catalog_choice_options
  for select to anon, authenticated using (public.catalogo_produto_publico(product_id));

drop policy if exists "todos leem complementos" on public.catalog_options;
create policy "todos leem complementos" on public.catalog_options
  for select to anon, authenticated using (archived_at is null);

drop policy if exists "todos leem grupos dos produtos" on public.catalog_product_groups;
create policy "todos leem grupos dos produtos" on public.catalog_product_groups
  for select to anon, authenticated using (public.catalogo_produto_publico(product_id));

-- Ofertas ativas que ainda não acabaram (a que começa mais tarde já vai para o site, que espera a hora).
drop policy if exists "todos leem ofertas ativas" on public.catalog_offers;
create policy "todos leem ofertas ativas" on public.catalog_offers
  for select to anon, authenticated
  using (status = 'ativa' and (ends_at is null or ends_at > now()) and public.catalogo_produto_publico(product_id));

do $politicas$
declare
  tabela text;
begin
  foreach tabela in array array[
    'catalog_categories', 'catalog_groups', 'catalog_products', 'catalog_variants', 'catalog_choices',
    'catalog_choice_options', 'catalog_options', 'catalog_product_groups', 'catalog_offers'
  ] loop
    execute format('drop policy if exists "vendedor edita" on public.%I', tabela);
    execute format(
      'create policy "vendedor edita" on public.%I for all to authenticated using (public.is_seller()) with check (public.is_seller())',
      tabela
    );
  end loop;
end
$politicas$;

drop policy if exists "vendedor ve a importacao" on public.catalog_import_log;
create policy "vendedor ve a importacao" on public.catalog_import_log
  for select to authenticated using (public.is_seller());

grant select on public.catalog_meta, public.catalog_categories, public.catalog_groups, public.catalog_products,
  public.catalog_variants, public.catalog_choices, public.catalog_choice_options, public.catalog_options,
  public.catalog_product_groups, public.catalog_offers
  to anon, authenticated;
grant insert, update, delete on public.catalog_categories, public.catalog_groups, public.catalog_products,
  public.catalog_variants, public.catalog_choices, public.catalog_choice_options, public.catalog_options,
  public.catalog_product_groups, public.catalog_offers
  to authenticated;
grant select on public.catalog_import_log to authenticated;
grant select, insert, update, delete on public.catalog_meta, public.catalog_categories, public.catalog_groups,
  public.catalog_products, public.catalog_variants, public.catalog_choices, public.catalog_choice_options,
  public.catalog_options, public.catalog_product_groups, public.catalog_offers, public.catalog_import_log
  to service_role;

-- ---------------------------------------------------------------------------------------------
-- Realtime: a revisão
-- ---------------------------------------------------------------------------------------------

do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'catalog_meta'
     ) then
    alter publication supabase_realtime add table public.catalog_meta;
  end if;
end
$realtime$;

-- ---------------------------------------------------------------------------------------------
-- Funções: ler o cardápio, salvar um produto, ordenar uma lista
-- ---------------------------------------------------------------------------------------------

-- O cardápio inteiro, na ordem. Respeita o RLS de quem chama: o público recebe só o que é
-- público; o vendedor recebe também o oculto e o arquivado; a função pedido (service_role) recebe
-- tudo e confere visível, arquivado e disponível item a item.
create or replace function public.catalogo_publico()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'revision', coalesce((select m.revision from public.catalog_meta m where m.id = 1), 0),
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by c.position, c.id) from public.catalog_categories c
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(to_jsonb(p) - 'created_at' - 'updated_at' order by p.position, p.id) from public.catalog_products p
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) - 'created_at' - 'updated_at' order by v.product_id, v.position, v.id) from public.catalog_variants v
    ), '[]'::jsonb),
    'choices', coalesce((
      select jsonb_agg(to_jsonb(e) - 'created_at' - 'updated_at' order by e.product_id, e.position, e.id) from public.catalog_choices e
    ), '[]'::jsonb),
    'choice_options', coalesce((
      select jsonb_agg(to_jsonb(o) - 'created_at' - 'updated_at' order by o.product_id, o.choice_id, o.position, o.id)
      from public.catalog_choice_options o
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(to_jsonb(g) - 'created_at' - 'updated_at' order by g.position, g.id) from public.catalog_groups g
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(to_jsonb(o) - 'created_at' - 'updated_at' order by o.group_id, o.position, o.id) from public.catalog_options o
    ), '[]'::jsonb),
    'product_groups', coalesce((
      select jsonb_agg(to_jsonb(l) - 'created_at' - 'updated_at' order by l.product_id, l.position, l.group_id)
      from public.catalog_product_groups l
    ), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(to_jsonb(f) - 'created_at' - 'updated_at' order by f.position, f.id) from public.catalog_offers f
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.catalogo_publico() from public;
grant execute on function public.catalogo_publico() to anon, authenticated, service_role;

-- Salva um produto inteiro numa transação: o produto e, quando vierem na chamada, os tamanhos
-- (variants), as escolhas com as opções (choices) e os grupos de complementos (groups). Lista que
-- vem substitui a do banco (o que saiu é apagado; tamanho com oferta não sai). Lista que não vem
-- fica como está. Respeita o RLS: só o vendedor consegue.
create or replace function public.catalogo_salvar_produto(produto jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid text := produto->>'id';
  existe boolean;
  escolha record;
  tipo text;
begin
  if not public.is_seller() then
    raise exception 'Só o vendedor pode mudar o cardápio.' using errcode = '42501';
  end if;
  if jsonb_typeof(produto) is distinct from 'object' or pid is null then
    raise exception 'Produto sem id.' using errcode = '22023';
  end if;
  select true into existe from public.catalog_products p where p.id = pid;

  insert into public.catalog_products as p (
    id, category_id, kind, name, description, image, image_alt, price_cents, compare_at_cents, badge, keywords,
    completo, flavors_from, details, position, visible, available
  ) values (
    pid,
    produto->>'category_id',
    produto->>'kind',
    btrim(produto->>'name'),
    coalesce(produto->>'description', ''),
    coalesce(produto->>'image', ''),
    coalesce(produto->>'image_alt', ''),
    coalesce((produto->>'price_cents')::integer, 0),
    (produto->>'compare_at_cents')::integer,
    nullif(btrim(produto->>'badge'), ''),
    coalesce(array(select jsonb_array_elements_text(produto->'keywords')), '{}'),
    coalesce((produto->>'completo')::boolean, false),
    nullif(produto->>'flavors_from', ''),
    coalesce(produto->'details', '{}'::jsonb),
    coalesce(
      (produto->>'position')::integer,
      (select coalesce(max(q.position) + 1, 0) from public.catalog_products q where q.category_id = produto->>'category_id')
    ),
    coalesce((produto->>'visible')::boolean, true),
    coalesce((produto->>'available')::boolean, true)
  )
  on conflict (id) do update set
    category_id = excluded.category_id,
    kind = excluded.kind,
    name = excluded.name,
    description = excluded.description,
    image = excluded.image,
    image_alt = excluded.image_alt,
    price_cents = excluded.price_cents,
    compare_at_cents = excluded.compare_at_cents,
    badge = excluded.badge,
    keywords = excluded.keywords,
    completo = excluded.completo,
    flavors_from = excluded.flavors_from,
    details = excluded.details,
    position = case when produto ? 'position' then excluded.position else p.position end,
    visible = excluded.visible,
    available = excluded.available;

  if produto ? 'variants' then
    if exists (
      select 1 from public.catalog_offers f
      where f.product_id = pid and f.variant_id is not null
        and f.variant_id not in (select x->>'id' from jsonb_array_elements(produto->'variants') x)
    ) then
      raise exception 'Esse tamanho está numa oferta. Tire o tamanho da oferta (ou apague a oferta) antes.' using errcode = 'P0001';
    end if;
    delete from public.catalog_variants v
    where v.product_id = pid
      and v.id not in (select x->>'id' from jsonb_array_elements(produto->'variants') x);
    insert into public.catalog_variants as v (product_id, id, name, container, price_cents, free_count, available, position)
    select pid, x->>'id', btrim(x->>'name'), nullif(x->>'container', ''), (x->>'price_cents')::integer,
           coalesce((x->>'free_count')::integer, 0), coalesce((x->>'available')::boolean, true), (n - 1)::integer
    from jsonb_array_elements(produto->'variants') with ordinality as t(x, n)
    on conflict (product_id, id) do update set
      name = excluded.name, container = excluded.container, price_cents = excluded.price_cents,
      free_count = excluded.free_count, available = excluded.available, position = excluded.position;
  end if;

  if produto ? 'choices' then
    delete from public.catalog_choice_options o
    where o.product_id = pid
      and not exists (
        select 1 from jsonb_array_elements(produto->'choices') c, jsonb_array_elements(coalesce(c->'options', '[]'::jsonb)) x
        where c->>'id' = o.choice_id and x->>'id' = o.id
      );
    delete from public.catalog_choices e
    where e.product_id = pid and e.id not in (select c->>'id' from jsonb_array_elements(produto->'choices') c);
    for escolha in select t.c, t.n from jsonb_array_elements(produto->'choices') with ordinality as t(c, n) loop
      insert into public.catalog_choices as e (product_id, id, label, allow_other, photo_alt, position)
      values (
        pid, escolha.c->>'id', btrim(escolha.c->>'label'), coalesce((escolha.c->>'allow_other')::boolean, false),
        nullif(escolha.c->>'photo_alt', ''), (escolha.n - 1)::integer
      )
      on conflict (product_id, id) do update set
        label = excluded.label, allow_other = excluded.allow_other, photo_alt = excluded.photo_alt, position = excluded.position;
      insert into public.catalog_choice_options as o (product_id, choice_id, id, name, photo, available, position)
      select pid, escolha.c->>'id', x->>'id', btrim(x->>'name'), nullif(x->>'photo', ''),
             coalesce((x->>'available')::boolean, true), (n - 1)::integer
      from jsonb_array_elements(coalesce(escolha.c->'options', '[]'::jsonb)) with ordinality as t(x, n)
      on conflict (product_id, choice_id, id) do update set
        name = excluded.name, photo = excluded.photo, available = excluded.available, position = excluded.position;
    end loop;
  end if;

  if produto ? 'groups' then
    delete from public.catalog_product_groups l
    where l.product_id = pid and l.group_id not in (select x->>'group_id' from jsonb_array_elements(produto->'groups') x);
    insert into public.catalog_product_groups as l (product_id, group_id, position, max_select)
    select pid, x->>'group_id', (n - 1)::integer, (x->>'max_select')::integer
    from jsonb_array_elements(produto->'groups') with ordinality as t(x, n)
    on conflict (product_id, group_id) do update set position = excluded.position, max_select = excluded.max_select;
  end if;

  -- O produto precisa poder ser pedido do jeito do tipo dele.
  select p.kind into tipo from public.catalog_products p where p.id = pid;
  if tipo = 'montavel' and not exists (select 1 from public.catalog_variants v where v.product_id = pid) then
    raise exception 'Produto montável precisa de pelo menos um tamanho.' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', pid,
    'created', existe is null,
    'revision', (select m.revision from public.catalog_meta m where m.id = 1)
  );
end
$$;
revoke all on function public.catalogo_salvar_produto(jsonb) from public;
grant execute on function public.catalogo_salvar_produto(jsonb) to authenticated, service_role;

-- A ordem de uma lista: a posição de cada id é a ordem em que ele vem.
create or replace function public.catalogo_ordenar(lista text, ids text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_seller() then
    raise exception 'Só o vendedor pode mudar o cardápio.' using errcode = '42501';
  end if;
  if lista = 'categorias' then
    update public.catalog_categories c set position = (t.n - 1)::integer
    from unnest(ids) with ordinality as t(id, n) where c.id = t.id and c.position <> t.n - 1;
  elsif lista = 'produtos' then
    update public.catalog_products c set position = (t.n - 1)::integer
    from unnest(ids) with ordinality as t(id, n) where c.id = t.id and c.position <> t.n - 1;
  elsif lista = 'grupos' then
    update public.catalog_groups c set position = (t.n - 1)::integer
    from unnest(ids) with ordinality as t(id, n) where c.id = t.id and c.position <> t.n - 1;
  elsif lista = 'complementos' then
    update public.catalog_options c set position = (t.n - 1)::integer
    from unnest(ids) with ordinality as t(id, n) where c.id = t.id and c.position <> t.n - 1;
  elsif lista = 'ofertas' then
    update public.catalog_offers c set position = (t.n - 1)::integer
    from unnest(ids) with ordinality as t(id, n) where c.id = t.id and c.position <> t.n - 1;
  else
    raise exception 'Lista desconhecida: %', lista using errcode = '22023';
  end if;
end
$$;
revoke all on function public.catalogo_ordenar(text, text[]) from public;
grant execute on function public.catalogo_ordenar(text, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Fotos: o vendedor também troca (update). Só JPEG, PNG e WebP, até 2 MB (sem SVG), na pasta fotos/.
-- ---------------------------------------------------------------------------------------------

update storage.buckets
set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']
where id = 'catalogo';

drop policy if exists "vendedor envia fotos" on storage.objects;
create policy "vendedor envia fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'catalogo' and public.is_seller() and name ~ '^fotos/[A-Za-z0-9_-]+\.(webp|png|jpe?g)$');

drop policy if exists "vendedor troca fotos" on storage.objects;
create policy "vendedor troca fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalogo' and public.is_seller())
  with check (bucket_id = 'catalogo' and public.is_seller() and name ~ '^fotos/[A-Za-z0-9_-]+\.(webp|png|jpe?g)$');

-- ---------------------------------------------------------------------------------------------
-- Semente: o cardápio do código, uma vez só
-- ---------------------------------------------------------------------------------------------

-- >>> semente do cardápio (gerada por `node scripts/catalogo/gerar-semente.ts`; não edite à mão)
do $semente$
begin
  if (select m.seeded_at from public.catalog_meta m where m.id = 1) is not null then
    raise notice 'Cardápio já semeado: a semente não roda de novo.';
    return;
  end if;

  insert into public.catalog_categories (id, name, subtitle, icon, layout, nav_label, pill_label, anchor, keywords, position, visible, archived_at) values
    ('monte-do-seu-jeito', 'Monte do seu jeito', '', 'crown', 'vitrine', 'Monte do seu jeito', 'Monte do seu jeito', '', '{}'::text[], 0, true, null),
    ('combos-e-ofertas', 'Combos e Ofertas', 'Kits com casquinhas, combos de sorvete e o pote de 1 litro montado.', 'gift', 'grade', 'Combos e Ofertas', 'Combos', 'secao-combos', array['combo', 'combos', 'oferta', 'ofertas', 'promocao']::text[], 1, true, null),
    ('barcas-e-potes', 'Barcas e Potes Família (1L, 1,5L e 2L)', 'Barca, potes de açaí e potes de sorvete de 1, 1,5 e 2 litros.', 'sailboat', 'grade', 'Barcas e Potes Família', 'Barcas e Potes', 'secao-barcas-potes', array['familia', 'potes familia']::text[], 2, true, null),
    ('picoles-e-sorvetes', 'Picolés e Sorvetes', 'Picolés, copos de sorvete, sundae, cascão, cremosinho e coberturas.', 'popsicle', 'grade', 'Picolés e Sorvetes', 'Picolés e Sorvetes', 'secao-picoles-sorvetes', array['gelado', 'gelados']::text[], 3, true, null),
    ('bebidas', 'Bebidas', 'Refrigerante em lata e água mineral.', 'glassWater', 'grade', 'Bebidas', 'Bebidas', 'secao-bebidas', array['bebida', 'bebidas']::text[], 4, true, null),
    ('doces-e-bomboniere', 'Doces e Bomboniere', 'Brownie, trufas, balas, chicletes, pipocas, salgadinho e chocolates.', 'candy', 'grade', 'Doces e Bomboniere', 'Doces', 'secao-doces-bomboniere', array['doce', 'doces', 'bomboniere']::text[], 5, true, null)
  on conflict (id) do nothing;

  insert into public.catalog_groups (id, name, rule, min_select, max_select, free_count, extra_price_cents, in_completo, available, position) values
    ('dry', 'Adicionais', 'limited', 0, null, null, 0, true, true, 0),
    ('fruit', 'Frutas', 'included', 0, null, null, 0, true, true, 1),
    ('syrup', 'Caldas e cremes', 'included', 0, null, null, 0, false, true, 2),
    ('paid', 'Adicionais pagos', 'paid', 0, null, null, 0, false, true, 3),
    ('batido', 'Adicionais', 'paid', 0, null, null, 0, false, true, 4)
  on conflict (id) do nothing;

  insert into public.catalog_products (id, category_id, kind, name, description, image, image_alt, price_cents, compare_at_cents, badge, keywords, completo, flavors_from, details, position, available, visible, archived_at) values
    ('acai-oca', 'monte-do-seu-jeito', 'montavel', 'Açaí Oca', '', '', '', 1000, null, null, array['oca', 'especialidade']::text[], false, null, '{"summary":"Em pote, copo ou isopor, a partir de 200 ml.","tagline":"A especialidade da casa, montada com os adicionais, as frutas e as coberturas que você quiser.","actionLabel":"Montar açaí Oca","badges":["Especialidade da casa","O mais pedido"]}'::jsonb, 0, true, true, null),
    ('acai-tradicional', 'monte-do-seu-jeito', 'montavel', 'Açaí Tradicional', '', '', '', 600, null, null, array['tradicional']::text[], true, null, '{"summary":"Em pote, copo ou isopor, a partir de 150 ml.","tagline":"Do seu jeito: escolha os complementos um a um ou peça o Completo.","actionLabel":"Montar açaí Tradicional","badges":[]}'::jsonb, 1, true, true, null),
    ('acai-batido', 'monte-do-seu-jeito', 'montavel', 'Açaí Batido', '', '', '', 1000, null, null, array['batida', 'batido']::text[], false, null, '{"summary":"De 300 ml ou 500 ml, em 3 sabores.","tagline":"Açaí batido com leite condensado, puro, com amendoim ou com paçoca.","actionLabel":"Montar açaí Batido","badges":[]}'::jsonb, 2, true, true, null),
    ('milk-shake', 'monte-do-seu-jeito', 'montavel', 'Milk-shake', '', '', '', 1000, null, null, array['milkshake', 'milk shake', 'shake']::text[], false, null, '{"summary":"De 400 ml ou 500 ml, em 13 sabores.","tagline":"Cremoso e gelado, em 13 sabores, com coberturas se quiser.","actionLabel":"Montar milk-shake","badges":[],"flavorNotice":"Favor verificar com a nossa atendente a disponibilidade de sabores."}'::jsonb, 3, true, true, null),
    ('kit-completo-casquinha', 'combos-e-ofertas', 'variacoes', 'Kit Completo Casquinha DUO', 'Pote 2 litros + cobertura 300g da sua preferência e 10 und de casquinha DUO.', 'images/catalogo/kit-completo-casquinha-duo.jpg', 'Kit com pacote de casquinhas DUO, frasco de cobertura e pote de sorvete Qbombom Trio de 2 litros', 4100, null, null, array['kit', 'completo', 'casquinha', 'duo', 'pote', '2 litros', '2l', 'cobertura', 'combo', 'oferta', 'cascao']::text[], false, null, '{}'::jsonb, 0, true, true, null),
    ('kit-completo', 'combos-e-ofertas', 'variacoes', 'Kit Completo', '1 Pote de sorvete 2 litros da sua preferência + 1 cobertura da sua preferência + 1 pacote com 10 und de casquinhas.', 'images/catalogo/kit-completo.jpg', 'Kit com frasco de cobertura de chocolate, pacote de casquinhas e pote de sorvete Qbombom Napolitano', 4100, null, null, array['kit', 'completo', 'combo', 'sorvete', '2 litros', '2l', 'oferta']::text[], false, null, '{}'::jsonb, 1, true, true, null),
    ('pote-de-acai-1-litro', 'combos-e-ofertas', 'montavel', 'Pote de Açaí 1 Litro Montado', 'Pote de 1 Litro com até 7 adicionais grátis à sua escolha.', 'images/catalogo/pote-1-litro-acai-montado.jpg', 'Pote de 1 litro de açaí com morango, banana, gotas de chocolate e calda de chocolate', 3000, 3300, 'Oferta', array['pote', '1 litro', '1l', 'acai', 'montado', 'oferta', 'promocao']::text[], true, null, '{"actionLabel":"Montar pote"}'::jsonb, 2, true, true, null),
    ('combo-1-litro', 'combos-e-ofertas', 'variacoes', 'Combo 1 Litro', 'Pote de sorvete 1 litro + 10 casquinhas.', 'images/catalogo/combo-1-litro.jpg', 'Arte do combo: pote de sorvete Qbombom Napolitano de 1 litro e 10 casquinhas', 2399, null, null, array['combo', '1 litro', '1l', 'casquinhas', 'sorvete', 'oferta', 'cascao', 'qbombom']::text[], false, null, '{}'::jsonb, 3, true, true, null),
    ('combo-de-sorvete', 'combos-e-ofertas', 'variacoes', 'Combo de Sorvete', '1 litro do sorvete Ster Bom Dueto + 10 unidades de casquinhas para compartilhar.', 'images/catalogo/combo-de-sorvete.jpg', 'Arte do combo: potes de sorvete Ster Bom Dueto de 1 litro e 10 casquinhas', 2000, null, null, array['combo', 'sorvete', 'casquinhas', 'oferta', 'cascao', '1 litro', '1l', 'dueto', 'ster bom', 'sterbom']::text[], false, null, '{}'::jsonb, 4, true, true, null),
    ('barca-de-acai', 'barcas-e-potes', 'montavel', 'Barca de Açaí', 'Inclui 1 Cobertura, 2 Frutas e 7 Adicionais à sua escolha.', 'images/catalogo/barca-de-acai.jpg', 'Barca de açaí com confetes, gotas de chocolate, morango e cobertura, diante do coração de neon da loja', 3000, null, null, array['barca', 'acai', 'cobertura', 'frutas', 'adicionais']::text[], true, 'syrup', '{"actionLabel":"Montar barca","flavorTerm":{"label":"Cobertura","missing":"a cobertura"},"flavorHint":"1 inclusa no preço"}'::jsonb, 0, true, true, null),
    ('pote-de-acai-2-litros', 'barcas-e-potes', 'direto', 'Pote de Açaí 2 Litros (Açaímix Brazil)', 'Pote família 2 litros de Açaí Cremoso Açaímix pronto para consumo.', 'images/catalogo/pote-acai-2-litros.jpg', 'Pote de 2 litros de açaí Açaímix Brazil', 3500, null, null, array['pote', 'dois litros', '2 litros', '2l', 'acai', 'acaimix', 'brazil', 'pronto']::text[], false, null, '{}'::jsonb, 1, true, true, null),
    ('acai-de-1-litro', 'barcas-e-potes', 'direto', 'Açaí de 1 Litro (Açaímix Brazil)', 'Pote de 1 litro de Açaí Cremoso Açaímix pronto para consumo.', 'images/catalogo/acai-1-litro.jpg', 'Pote de 1 litro de açaí Açaímix Brazil, pronto para consumo', 2300, null, null, array['acai', '1 litro', '1l', 'pote', 'acaimix', 'brazil', 'pronto']::text[], false, null, '{}'::jsonb, 2, true, true, null),
    ('acai-do-oca-pronto', 'barcas-e-potes', 'variacoes', 'Açaí do Oca (Pote Pronto)', 'Pote pronto original Oca do Açaí Tradicional (escolha 500 ml ou 1 Litro).', 'images/catalogo/acai-do-oca-pote.jpg', 'Potes de açaí Oca do Açaí, sabor tradicional', 1700, null, null, array['acai', 'oca', 'oca do acai', 'pote', 'pronto', 'tradicional', '500ml', '1 litro', '1l']::text[], false, null, '{}'::jsonb, 3, true, true, null),
    ('pote-de-sorvete-1-5-litro', 'barcas-e-potes', 'variacoes', 'Pote de Sorvete 1,5 Litro (Qbombom)', 'Pote de sorvete cremoso 1,5L em 6 sabores especiais.', 'images/catalogo/pote-1-5l-qgresco.jpg', 'Pote de sorvete Qbombom de 1,5 litro, sabor Qgresco', 3000, null, null, array['pote', '1,5 litros', '1.5l', 'sorvete', 'qbombom', 'torta gelada']::text[], false, null, '{}'::jsonb, 4, true, true, null),
    ('pote-de-sorvete-2-litros-especiais', 'barcas-e-potes', 'variacoes', 'Pote de Sorvete 2 Litros (Qbombom Premium)', 'Pote de sorvete 2L em 12 sabores irresistíveis.', 'images/catalogo/pote-2l-sensacao.jpg', 'Pote de sorvete Qbombom Premium de 2 litros, sabor Sensação', 2800, null, null, array['pote', '2 litros', '2l', 'sorvete', 'qbombom', 'premium']::text[], false, null, '{}'::jsonb, 5, true, true, null),
    ('pote-de-sorvete-2-litros-tradicional', 'barcas-e-potes', 'direto', 'Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)', 'Pote 2L Clássicos 4 em 1: Chocolate meio amargo, Creme, Morango e Flocos.', 'images/catalogo/pote-2l-sterbom-4em1.jpg', 'Pote de sorvete Ster Bom Clássicos 4 em 1 de 2 litros', 2600, null, null, array['pote', '2 litros', '2l', 'sorvete', 'ster bom', 'sterbom', 'classicos', '4 em 1']::text[], false, null, '{}'::jsonb, 6, true, true, null),
    ('pote-de-sorvete-1-litro-especiais', 'barcas-e-potes', 'variacoes', 'Pote de Sorvete 1 Litro (Qbombom Premium)', 'Pote de sorvete 1L Premium nos sabores Qbrounie, Brigadeiro, Flocos e Napolitano.', 'images/catalogo/pote-1l-qbrounie.jpg', 'Pote de sorvete Qbombom Premium de 1 litro, sabor Qbrounie', 1800, null, null, array['pote', '1 litro', '1l', 'sorvete', 'qbombom', 'qbombon', 'premium']::text[], false, null, '{}'::jsonb, 7, true, true, null),
    ('pote-de-sorvete-1-litro-tradicional', 'barcas-e-potes', 'variacoes', 'Pote de Sorvete 1 Litro (Tradicional)', 'Pote de sorvete 1 litro — sabores tradicionais', 'images/catalogo/pote-sorvete-1l-tradicional.jpg', 'Sorvete com gotas de chocolate servido com a concha', 1600, null, null, array['pote', '1 litro', '1l', 'sorvete']::text[], false, null, '{}'::jsonb, 8, true, true, null),
    ('acai-com-creme-ninho', 'barcas-e-potes', 'direto', 'Açaí com Creme Ninho (Pronto)', 'Copo montado com açaí, creme de Ninho e amendoim', 'images/catalogo/acai-creme-ninho-pronto.jpg', 'Copo de açaí em camadas com creme ninho, frutas, granola, jujuba e amendoim', 1200, null, null, array['acai', 'creme ninho', 'ninho', 'amendoim', 'pronto']::text[], false, null, '{}'::jsonb, 9, true, true, null),
    ('acai-mix-150-ml', 'barcas-e-potes', 'direto', 'Açaí Mix 150 ml', 'Potinho individual de açaí 150 ml', 'images/catalogo/acai-mix-150ml.jpg', 'Potinho de 150 ml de açaí Açaímix Brazil', 500, null, null, array['acai', 'mix', '150ml', 'potinho']::text[], false, null, '{}'::jsonb, 10, true, true, null),
    ('copo-diamante-negro', 'picoles-e-sorvetes', 'direto', 'Copo Diamante Negro', 'Sorvete sabor Diamante Negro com cobertura e morango', 'images/catalogo/copo-diamante-negro.jpg', 'Copo de sorvete Diamante Negro com gotas de chocolate e morango, com tampa bolha', 1200, null, null, array['copo', 'diamante negro', 'sorvete', 'chocolate']::text[], false, null, '{}'::jsonb, 0, true, true, null),
    ('copao-400-ml', 'picoles-e-sorvetes', 'variacoes', 'Copão 400 ml', 'Copão de sorvete 400 ml (Napolitano e sabores)', 'images/catalogo/copao-400ml.jpg', 'Dois copões de sorvete Qbombom, Trio e Napolitano', 950, null, null, array['copao', '400ml', 'sorvete', 'napolitano']::text[], false, null, '{}'::jsonb, 1, true, true, null),
    ('sundae', 'picoles-e-sorvetes', 'variacoes', 'Sundae', 'Sorvete cremoso no copo com calda especial', 'images/catalogo/sundae.jpg', 'Sundae Qbombom no copo, com calda e farofa por cima', 700, null, null, array['sundae', 'sorvete', 'calda', 'morango', 'chocolate']::text[], false, null, '{}'::jsonb, 2, true, true, null),
    ('cascao-duo', 'picoles-e-sorvetes', 'direto', 'Cascão DUO', 'Cascão crocante recheado sabor baunilha com chocolate', 'images/catalogo/cascao-duo.jpg', 'Pacote de cascões DUO de baunilha e chocolate', 700, null, null, array['cascao', 'duo', 'casquinha', 'baunilha', 'chocolate']::text[], false, null, '{}'::jsonb, 3, true, true, null),
    ('cobertura-sterbom', 'picoles-e-sorvetes', 'variacoes', 'Cobertura Sterbom (Frasco)', 'Frasco de cobertura para sorvete (sabores variados)', 'images/catalogo/cobertura-sterbom.jpg', 'Cinco frascos de cobertura Ster Bom', 700, null, null, array['cobertura', 'sterbom', 'calda', 'sorvete']::text[], false, null, '{}'::jsonb, 4, true, true, null),
    ('moreninha', 'picoles-e-sorvetes', 'direto', 'Moreninha', 'Casquinha com sorvete banhada na cobertura crocante de chocolate', 'images/catalogo/moreninha.jpg', 'Moreninha: casquinha com sorvete banhada em chocolate', 350, null, null, array['moreninha', 'casquinha', 'sorvete', 'chocolate', 'cascao']::text[], false, null, '{}'::jsonb, 5, true, true, null),
    ('picole-trufado', 'picoles-e-sorvetes', 'variacoes', 'Picolé Trufado', 'Picolé cremoso recheado (Mousse de Maracujá e sabores)', 'images/catalogo/picole-trufado.jpg', 'Picolé trufado mordido, com recheio vermelho', 300, null, null, array['picole', 'trufado', 'mousse', 'maracuja', 'recheado']::text[], false, null, '{}'::jsonb, 6, true, true, null),
    ('picole-gourmet', 'picoles-e-sorvetes', 'variacoes', 'Picolé Gourmet', 'Picolé artesanal super cremoso', 'images/catalogo/picole-gourmet.jpg', 'Tabela dos picolés gourmet, com os sabores', 300, null, null, array['picole', 'gourmet', 'nutella', 'pacoca', 'iogurte']::text[], false, null, '{}'::jsonb, 7, true, true, null),
    ('garrafinha', 'picoles-e-sorvetes', 'variacoes', 'Garrafinha', 'Geladinho cremoso na garrafinha', 'images/catalogo/garrafinha.jpg', 'Duas garrafinhas de geladinho, uma azul e uma de chocolate', 300, null, null, array['garrafinha', 'geladinho', 'dindin', 'sacole']::text[], false, null, '{}'::jsonb, 8, true, true, null),
    ('roscao-mel', 'picoles-e-sorvetes', 'direto', 'Roscão Mel', 'Sorvete no roscão / copinho', 'images/catalogo/roscao-mel.jpg', 'Sorvete branco com calda vermelha por cima', 200, null, null, array['roscao', 'mel', 'sorvete']::text[], false, null, '{}'::jsonb, 9, true, true, null),
    ('picole-comum', 'picoles-e-sorvetes', 'variacoes', 'Picolé Comum', 'Picolé refrescante em sabores variados', 'images/catalogo/picole-comum.jpg', 'Picolé de coco da Welder ao lado da embalagem', 150, null, null, array['picole', 'comum', 'fruta']::text[], false, null, '{}'::jsonb, 10, true, true, null),
    ('cremosinho', 'picoles-e-sorvetes', 'variacoes', 'Cremosinho', 'Dindin / geladinho cremoso', 'images/catalogo/cremosinho.jpg', 'Pacotes de cremosinho Gostosinho de 80 g', 150, null, null, array['cremosinho', 'dindin', 'geladinho', 'sacole']::text[], false, null, '{}'::jsonb, 11, true, true, null),
    ('refrigerante-350-ml', 'bebidas', 'variacoes', 'Refrigerante 350 ml', 'Lata 350 ml bem gelada', 'images/catalogo/refrigerante-350ml.jpg', 'Latas de Fanta Uva, Fanta Laranja, Guaraná Antarctica Zero e Coca-Cola', 500, null, null, array['refrigerante', 'refri', '350ml', 'lata', 'coca', 'guarana', 'fanta']::text[], false, null, '{}'::jsonb, 0, true, true, null),
    ('agua-mineral-500-ml', 'bebidas', 'direto', 'Água Mineral 500 ml', 'Garrafa de água mineral sem gás 500 ml', 'images/catalogo/agua-mineral-500ml.jpg', 'Garrafa de água mineral Indaiá de 500 ml', 200, null, null, array['agua', 'mineral', '500ml', 'indaia']::text[], false, null, '{}'::jsonb, 1, true, true, null),
    ('quadradinho-de-brownie', 'doces-e-bomboniere', 'direto', 'Quadradinho de Brownie', 'Brownie artesanal macio de chocolate', 'images/catalogo/quadradinho-brownie.jpg', 'Quadradinho de brownie embalado, com o adesivo da Açaí Doce Sabor', 599, 600, null, array['brownie', 'quadradinho', 'chocolate', 'doce']::text[], false, null, '{}'::jsonb, 0, true, true, null),
    ('pippos', 'doces-e-bomboniere', 'direto', 'Pippo''s', 'Salgadinho Pippo''s sabor Churrasco', 'images/catalogo/pippos.jpg', 'Pacotes de salgadinho Pippo''s Vitaminado', 375, null, null, array['pippos', 'pippo''s', 'salgadinho', 'churrasco']::text[], false, null, '{}'::jsonb, 1, true, true, null),
    ('trufas', 'doces-e-bomboniere', 'variacoes', 'Trufas', 'Trufa artesanal recheada', 'images/catalogo/trufas.jpg', 'Trufa de chocolate cortada, com recheio cremoso', 250, 300, null, array['trufa', 'trufas', 'chocolate', 'beijinho', 'maracuja', 'coco']::text[], false, null, '{}'::jsonb, 2, true, true, null),
    ('trident', 'doces-e-bomboniere', 'variacoes', 'Trident', 'Chiclete Trident sem açúcar', 'images/catalogo/trident.jpg', 'Pacotes de chiclete Trident', 250, null, null, array['trident', 'chiclete', 'goma', 'menta']::text[], false, null, '{}'::jsonb, 3, true, true, null),
    ('batom-ao-leite', 'doces-e-bomboniere', 'direto', 'Batom ao Leite', 'Chocolate Garoto Batom ao Leite', 'images/catalogo/batom-ao-leite.jpg', 'Caixa de chocolates Baton ao leite', 200, null, null, array['batom', 'chocolate', 'ao leite']::text[], false, null, '{}'::jsonb, 4, true, true, null),
    ('mentos', 'doces-e-bomboniere', 'variacoes', 'Mentos', 'Bala mastigável Mentos', 'images/catalogo/mentos.jpg', 'Rolos de bala Mentos Fruit', 200, null, null, array['mentos', 'bala', 'fruit', 'menta']::text[], false, null, '{}'::jsonb, 5, true, true, null),
    ('halls', 'doces-e-bomboniere', 'variacoes', 'Halls', 'Bala refrescante Halls', 'images/catalogo/halls.jpg', 'Pacotes de bala Halls de morango', 200, null, null, array['halls', 'bala', 'menta', 'cereja', 'morango']::text[], false, null, '{}'::jsonb, 6, true, true, null),
    ('pipoca-kigarot-75g', 'doces-e-bomboniere', 'direto', 'Pipoca Kigarot 75g', 'Pipoca doce/salgada Kigarot pacote 75g — Sabor Manteiga', 'images/catalogo/pipoca-kigarot-75g.jpg', 'Pacote de pipoca Kigarot sabor manteiga de 75 g', 200, null, null, array['pipoca', 'kigarot', '75g', 'manteiga']::text[], false, null, '{}'::jsonb, 7, true, true, null),
    ('pipoca-kigarot-45g', 'doces-e-bomboniere', 'direto', 'Pipoca Kigarot 45g', 'Pipoca Kigarot pacote 45g — Sabor Manteiga', 'images/catalogo/pipoca-kigarot-45g.jpg', 'Pacotes de pipoca Kigarot sabor manteiga de 45 g', 150, null, null, array['pipoca', 'kigarot', '45g', 'manteiga']::text[], false, null, '{}'::jsonb, 8, true, true, null),
    ('fini-gelatinas', 'doces-e-bomboniere', 'direto', 'Fini Gelatinas', 'Pacotinho individual de balas de gelatina Fini', 'images/catalogo/fini-gelatinas.jpg', 'Pacotinhos de balas de gelatina Fini', 150, null, null, array['fini', 'gelatina', 'bala', 'doce']::text[], false, null, '{}'::jsonb, 9, true, true, null),
    ('docile-canudinho', 'doces-e-bomboniere', 'direto', 'Docile Canudinho', 'Canudinho doce Docile', 'images/catalogo/docile-canudinho.jpg', 'Canudinhos doces Docile', 150, null, null, array['docile', 'canudinho', 'fini', 'doce']::text[], false, null, '{}'::jsonb, 10, true, true, null),
    ('jujuba', 'doces-e-bomboniere', 'direto', 'Jujuba', 'Pacote de balas de goma / jujuba colorida', 'images/catalogo/jujuba.jpg', 'Rolos de balas de goma Gomets', 100, null, null, array['jujuba', 'goma', 'bala', 'gomets']::text[], false, null, '{}'::jsonb, 11, true, true, null),
    ('nucita', 'doces-e-bomboniere', 'direto', 'Nucita', 'Creme doce Napolitano Nucita', 'images/catalogo/nucita.jpg', 'Caixa do doce Ducrem Napolitano', 50, null, null, array['nucita', 'creme', 'napolitano', 'doce']::text[], false, null, '{}'::jsonb, 12, true, true, null),
    ('chocolate-recheado', 'doces-e-bomboniere', 'direto', 'Chocolate Recheado', 'Bombom / chocolate recheado individual', 'images/catalogo/chocolate-recheado.jpg', 'Bombons Bee recheados de vários sabores', 50, null, null, array['chocolate', 'recheado', 'bombom', 'uva']::text[], false, null, '{}'::jsonb, 13, true, true, null)
  on conflict (id) do nothing;

  insert into public.catalog_variants (product_id, id, name, container, price_cents, free_count, available, position) values
    ('acai-oca', 'pote-200', 'Pote 200 ml', 'pote', 1000, 2, true, 0),
    ('acai-oca', 'pote-530', 'Pote 530 ml', 'pote', 2000, 4, true, 1),
    ('acai-oca', 'copo-400', 'Copo 400 ml', 'copo', 1700, 3, true, 2),
    ('acai-oca', 'copo-500', 'Copo 500 ml', 'copo', 2000, 3, true, 3),
    ('acai-oca', 'isopor-p', 'Isopor P', 'isopor', 1600, 4, true, 4),
    ('acai-oca', 'isopor-m', 'Isopor M', 'isopor', 2200, 5, true, 5),
    ('acai-oca', 'isopor-g', 'Isopor G', 'isopor', 3000, 6, true, 6),
    ('acai-oca', 'isopor-gg', 'Isopor GG', 'isopor', 3800, 7, true, 7),
    ('acai-tradicional', 'pote-150', 'Pote 150 ml', 'pote', 600, 2, true, 0),
    ('acai-tradicional', 'pote-200', 'Pote 200 ml', 'pote', 700, 2, true, 1),
    ('acai-tradicional', 'pote-250', 'Pote 250 ml', 'pote', 800, 2, true, 2),
    ('acai-tradicional', 'pote-530', 'Pote 530 ml', 'pote', 1300, 4, true, 3),
    ('acai-tradicional', 'copo-400', 'Copo 400 ml', 'copo', 1000, 3, true, 4),
    ('acai-tradicional', 'copo-500', 'Copo 500 ml', 'copo', 1200, 3, true, 5),
    ('acai-tradicional', 'isopor-p', 'Isopor P', 'isopor', 1100, 4, true, 6),
    ('acai-tradicional', 'isopor-m', 'Isopor M', 'isopor', 1500, 5, true, 7),
    ('acai-tradicional', 'isopor-g', 'Isopor G', 'isopor', 1800, 6, true, 8),
    ('acai-tradicional', 'isopor-gg', 'Isopor GG', 'isopor', 2200, 7, true, 9),
    ('acai-batido', '300-ml', '300 ml', 'copo', 1000, 0, true, 0),
    ('acai-batido', '500-ml', '500 ml', 'copo', 1200, 0, true, 1),
    ('milk-shake', '400-ml', '400 ml', 'copo', 1000, 0, true, 0),
    ('milk-shake', '500-ml', '500 ml', 'copo', 1200, 0, true, 1),
    ('pote-de-acai-1-litro', 'pote-1-litro', 'Pote 1 litro', 'pote', 3000, 7, true, 0),
    ('barca-de-acai', 'barca', 'Barca', 'barca', 3000, 7, true, 0),
    ('acai-do-oca-pronto', '500-ml', '500 ml', null, 1700, 0, true, 0),
    ('acai-do-oca-pronto', '1-litro', '1 Litro', null, 3300, 0, true, 1)
  on conflict (product_id, id) do nothing;

  insert into public.catalog_choices (product_id, id, label, allow_other, photo_alt, position) values
    ('acai-batido', 'sabor', 'Sabor', false, null, 0),
    ('milk-shake', 'sabor', 'Sabor', false, null, 0),
    ('kit-completo-casquinha', 'sorvete', 'Sabor do sorvete (2 litros)', true, null, 0),
    ('kit-completo-casquinha', 'cobertura', 'Sabor da cobertura', false, null, 1),
    ('kit-completo', 'sorvete', 'Sabor do sorvete (2 litros)', true, null, 0),
    ('kit-completo', 'cobertura', 'Sabor da cobertura', false, null, 1),
    ('combo-1-litro', 'sorvete', 'Sabor do sorvete (1 litro)', false, null, 0),
    ('combo-de-sorvete', 'sorvete', 'Sabor do Ster Bom Dueto (1 litro)', false, null, 0),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'Sabor', true, 'Pote de sorvete Qbombom de 1,5 litro', 0),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'Sabor', true, 'Pote de sorvete Qbombom Premium de 2 litros', 0),
    ('pote-de-sorvete-1-litro-especiais', 'sabor', 'Sabor', false, 'Pote de sorvete Qbombom Premium de 1 litro', 0),
    ('pote-de-sorvete-1-litro-tradicional', 'sabor', 'Sabor', false, null, 0),
    ('copao-400-ml', 'sabor', 'Sabor', false, null, 0),
    ('sundae', 'sabor', 'Sabor', false, null, 0),
    ('cobertura-sterbom', 'sabor', 'Sabor', false, null, 0),
    ('picole-trufado', 'sabor', 'Sabor', false, null, 0),
    ('picole-gourmet', 'sabor', 'Sabor', false, null, 0),
    ('garrafinha', 'sabor', 'Sabor', false, null, 0),
    ('picole-comum', 'sabor', 'Sabor', false, null, 0),
    ('cremosinho', 'sabor', 'Sabor', false, null, 0),
    ('refrigerante-350-ml', 'sabor', 'Sabor', false, null, 0),
    ('trufas', 'sabor', 'Sabor', false, null, 0),
    ('trident', 'sabor', 'Sabor', false, null, 0),
    ('mentos', 'sabor', 'Sabor', false, null, 0),
    ('halls', 'sabor', 'Sabor', false, null, 0)
  on conflict (product_id, id) do nothing;

  insert into public.catalog_choice_options (product_id, choice_id, id, name, photo, available, position) values
    ('acai-batido', 'sabor', 'leite-condensado', 'Açaí Batido com Leite Condensado', null, true, 0),
    ('acai-batido', 'sabor', 'leite-condensado-amendoim', 'Açaí com Leite Condensado e Amendoim', null, true, 1),
    ('acai-batido', 'sabor', 'leite-condensado-pacoca', 'Açaí com Leite Condensado e Paçoca', null, true, 2),
    ('milk-shake', 'sabor', 'acai', 'Açaí', null, true, 0),
    ('milk-shake', 'sabor', 'toffe', 'Toffe', null, true, 1),
    ('milk-shake', 'sabor', 'ninho', 'Ninho', null, true, 2),
    ('milk-shake', 'sabor', 'pitaya', 'Pitaya', null, true, 3),
    ('milk-shake', 'sabor', 'maracuja', 'Maracujá', null, true, 4),
    ('milk-shake', 'sabor', 'morango', 'Morango', null, true, 5),
    ('milk-shake', 'sabor', 'prestigio', 'Prestígio', null, true, 6),
    ('milk-shake', 'sabor', 'chocolate', 'Chocolate', null, true, 7),
    ('milk-shake', 'sabor', 'choconute', 'Choconute', null, true, 8),
    ('milk-shake', 'sabor', 'laka-bis', 'Laka Bis', null, true, 9),
    ('milk-shake', 'sabor', 'iogurte-grego', 'Iogurte Grego', null, true, 10),
    ('milk-shake', 'sabor', 'ninho-trufado', 'Ninho Trufado', null, true, 11),
    ('milk-shake', 'sabor', 'chocolate-branco', 'Chocolate Branco', null, true, 12),
    ('kit-completo-casquinha', 'sorvete', 'sensacao', 'Sensação', null, true, 0),
    ('kit-completo-casquinha', 'sorvete', 'chocolate', 'Chocolate', null, true, 1),
    ('kit-completo-casquinha', 'sorvete', 'napolitano', 'Napolitano', null, true, 2),
    ('kit-completo-casquinha', 'sorvete', 'unicornio', 'Unicórnio', null, true, 3),
    ('kit-completo-casquinha', 'sorvete', 'pave', 'Pavê', null, true, 4),
    ('kit-completo-casquinha', 'sorvete', 'toffee', 'Toffee', null, true, 5),
    ('kit-completo-casquinha', 'sorvete', 'crocante', 'Crocante', null, true, 6),
    ('kit-completo-casquinha', 'sorvete', 'brownie', 'Brownie', null, true, 7),
    ('kit-completo-casquinha', 'sorvete', 'creme-com-passas', 'Creme com passas', null, true, 8),
    ('kit-completo-casquinha', 'sorvete', 'nata-com-goiabada', 'Nata com goiabada', null, true, 9),
    ('kit-completo-casquinha', 'sorvete', 'sonho-de-valsa', 'Sonho de valsa', null, true, 10),
    ('kit-completo-casquinha', 'sorvete', 'trio-chocolate-flocos-e-creme', 'Trio (Chocolate, flocos e creme)', null, true, 11),
    ('kit-completo-casquinha', 'cobertura', 'uva', 'Uva', null, true, 0),
    ('kit-completo-casquinha', 'cobertura', 'morango', 'Morango', null, true, 1),
    ('kit-completo-casquinha', 'cobertura', 'chocolate', 'Chocolate', null, true, 2),
    ('kit-completo-casquinha', 'cobertura', 'caramelo', 'Caramelo', null, true, 3),
    ('kit-completo-casquinha', 'cobertura', 'leite-condensado', 'Leite condensado', null, true, 4),
    ('kit-completo', 'sorvete', 'sensacao', 'Sensação', null, true, 0),
    ('kit-completo', 'sorvete', 'chocolate', 'Chocolate', null, true, 1),
    ('kit-completo', 'sorvete', 'napolitano', 'Napolitano', null, true, 2),
    ('kit-completo', 'sorvete', 'unicornio', 'Unicórnio', null, true, 3),
    ('kit-completo', 'sorvete', 'pave', 'Pavê', null, true, 4),
    ('kit-completo', 'sorvete', 'toffee', 'Toffee', null, true, 5),
    ('kit-completo', 'sorvete', 'crocante', 'Crocante', null, true, 6),
    ('kit-completo', 'sorvete', 'brownie', 'Brownie', null, true, 7),
    ('kit-completo', 'sorvete', 'creme-com-passas', 'Creme com passas', null, true, 8),
    ('kit-completo', 'sorvete', 'nata-com-goiabada', 'Nata com goiabada', null, true, 9),
    ('kit-completo', 'sorvete', 'sonho-de-valsa', 'Sonho de valsa', null, true, 10),
    ('kit-completo', 'sorvete', 'trio-chocolate-flocos-e-creme', 'Trio (Chocolate, flocos e creme)', null, true, 11),
    ('kit-completo', 'cobertura', 'uva', 'Uva', null, true, 0),
    ('kit-completo', 'cobertura', 'morango', 'Morango', null, true, 1),
    ('kit-completo', 'cobertura', 'chocolate', 'Chocolate', null, true, 2),
    ('kit-completo', 'cobertura', 'caramelo', 'Caramelo', null, true, 3),
    ('kit-completo', 'cobertura', 'leite-condensado', 'Leite condensado', null, true, 4),
    ('combo-1-litro', 'sorvete', 'qbrounie', 'Qbrounie', null, true, 0),
    ('combo-1-litro', 'sorvete', 'brigadeiro', 'Brigadeiro', null, true, 1),
    ('combo-1-litro', 'sorvete', 'flocos', 'Flocos', null, true, 2),
    ('combo-1-litro', 'sorvete', 'napolitano', 'Napolitano', null, true, 3),
    ('combo-de-sorvete', 'sorvete', 'azul-com-creme', 'Azul com Creme', null, true, 0),
    ('combo-de-sorvete', 'sorvete', 'nata-uva', 'Nata Uva', null, true, 1),
    ('combo-de-sorvete', 'sorvete', 'abacaxi-com-coco', 'Abacaxi com Coco', null, true, 2),
    ('combo-de-sorvete', 'sorvete', 'nata-com-morango', 'Nata com Morango', null, true, 3),
    ('combo-de-sorvete', 'sorvete', 'nata-com-chocolate', 'Nata com Chocolate', null, true, 4),
    ('combo-de-sorvete', 'sorvete', 'morango-com-chocolate', 'Morango com Chocolate', null, true, 5),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'mousse-de-maracuja', 'Mousse de maracujá', 'images/catalogo/pote-1-5l-maracuja.jpg', true, 0),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'leitinho-trufado', 'Leitinho trufado', 'images/catalogo/pote-1-5l-leitinho-trufado.jpg', true, 1),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'iogurte-grego', 'Iogurte grego', 'images/catalogo/pote-1-5l-iogurte-grego.jpg', true, 2),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'qmaltine', 'Qmaltine', 'images/catalogo/pote-1-5l-qmaltine.jpg', true, 3),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'cookies-cream', 'Cookies cream', 'images/catalogo/pote-1-5l-cookies-cream.jpg', true, 4),
    ('pote-de-sorvete-1-5-litro', 'sabor', 'qgresco', 'Qgresco', 'images/catalogo/pote-1-5l-qgresco.jpg', true, 5),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'sensacao', 'Sensação', 'images/catalogo/pote-2l-sensacao.jpg', true, 0),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'chocolate', 'Chocolate', 'images/catalogo/pote-2l-chocolate.jpg', true, 1),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'napolitano', 'Napolitano', 'images/catalogo/pote-2l-napolitano.jpg', true, 2),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'unicornio', 'Unicórnio', 'images/catalogo/pote-2l-unicornio.jpg', true, 3),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'pave', 'Pavê', 'images/catalogo/pote-2l-pave.jpg', true, 4),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'toffee', 'Toffee', null, true, 5),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'crocante', 'Crocante', 'images/catalogo/pote-2l-crocante.jpg', true, 6),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'brownie', 'Brownie', null, true, 7),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'creme-com-passas', 'Creme com passas', 'images/catalogo/pote-2l-creme-passas.jpg', true, 8),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'nata-com-goiabada', 'Nata com goiabada', 'images/catalogo/pote-2l-nata-goiabada.jpg', true, 9),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'sonho-de-valsa', 'Sonho de valsa', 'images/catalogo/pote-2l-sonho-de-valsa.jpg', true, 10),
    ('pote-de-sorvete-2-litros-especiais', 'sabor', 'trio-chocolate-flocos-e-creme', 'Trio (Chocolate, flocos e creme)', 'images/catalogo/pote-2l-trio.jpg', true, 11),
    ('pote-de-sorvete-1-litro-especiais', 'sabor', 'qbrounie', 'Qbrounie', 'images/catalogo/pote-1l-qbrounie.jpg', true, 0),
    ('pote-de-sorvete-1-litro-especiais', 'sabor', 'brigadeiro', 'Brigadeiro', 'images/catalogo/pote-1l-brigadeiro.jpg', true, 1),
    ('pote-de-sorvete-1-litro-especiais', 'sabor', 'flocos', 'Flocos', 'images/catalogo/pote-1l-flocos.jpg', true, 2),
    ('pote-de-sorvete-1-litro-especiais', 'sabor', 'napolitano', 'Napolitano', 'images/catalogo/pote-1l-napolitano.jpg', true, 3),
    ('pote-de-sorvete-1-litro-tradicional', 'sabor', 'napolitano', 'Napolitano', null, true, 0),
    ('pote-de-sorvete-1-litro-tradicional', 'sabor', 'chocolate', 'Chocolate', null, true, 1),
    ('pote-de-sorvete-1-litro-tradicional', 'sabor', 'morango', 'Morango', null, true, 2),
    ('pote-de-sorvete-1-litro-tradicional', 'sabor', 'flocos', 'Flocos', null, true, 3),
    ('pote-de-sorvete-1-litro-tradicional', 'sabor', 'creme', 'Creme', null, true, 4),
    ('copao-400-ml', 'sabor', 'napolitano', 'Napolitano', null, true, 0),
    ('copao-400-ml', 'sabor', 'chocolate', 'Chocolate', null, true, 1),
    ('copao-400-ml', 'sabor', 'morango', 'Morango', null, true, 2),
    ('copao-400-ml', 'sabor', 'flocos', 'Flocos', null, true, 3),
    ('sundae', 'sabor', 'morango', 'Morango', null, true, 0),
    ('sundae', 'sabor', 'chocolate', 'Chocolate', null, true, 1),
    ('sundae', 'sabor', 'caramelo', 'Caramelo', null, true, 2),
    ('cobertura-sterbom', 'sabor', 'chocolate', 'Chocolate', null, true, 0),
    ('cobertura-sterbom', 'sabor', 'morango', 'Morango', null, true, 1),
    ('cobertura-sterbom', 'sabor', 'caramelo', 'Caramelo', null, true, 2),
    ('cobertura-sterbom', 'sabor', 'leite-condensado', 'Leite Condensado', null, true, 3),
    ('cobertura-sterbom', 'sabor', 'uva', 'Uva', null, true, 4),
    ('picole-trufado', 'sabor', 'mousse-de-maracuja', 'Mousse de Maracujá', null, true, 0),
    ('picole-trufado', 'sabor', 'chocolate', 'Chocolate', null, true, 1),
    ('picole-trufado', 'sabor', 'morango', 'Morango', null, true, 2),
    ('picole-trufado', 'sabor', 'ninho-com-nutella', 'Ninho com Nutella', null, true, 3),
    ('picole-gourmet', 'sabor', 'nutella', 'Nutella', null, true, 0),
    ('picole-gourmet', 'sabor', 'pacoca', 'Paçoca', null, true, 1),
    ('picole-gourmet', 'sabor', 'morango-com-chocolate', 'Morango com Chocolate', null, true, 2),
    ('picole-gourmet', 'sabor', 'iogurte', 'Iogurte', null, true, 3),
    ('picole-gourmet', 'sabor', 'maracuja', 'Maracujá', null, true, 4),
    ('garrafinha', 'sabor', 'chocolate', 'Chocolate', null, true, 0),
    ('garrafinha', 'sabor', 'morango', 'Morango', null, true, 1),
    ('garrafinha', 'sabor', 'blue-ice', 'Blue Ice', null, true, 2),
    ('garrafinha', 'sabor', 'coco', 'Coco', null, true, 3),
    ('picole-comum', 'sabor', 'coco', 'Coco', null, true, 0),
    ('picole-comum', 'sabor', 'chocolate', 'Chocolate', null, true, 1),
    ('picole-comum', 'sabor', 'morango', 'Morango', null, true, 2),
    ('picole-comum', 'sabor', 'uva', 'Uva', null, true, 3),
    ('picole-comum', 'sabor', 'limao', 'Limão', null, true, 4),
    ('picole-comum', 'sabor', 'maracuja', 'Maracujá', null, true, 5),
    ('cremosinho', 'sabor', 'chocolate', 'Chocolate', null, true, 0),
    ('cremosinho', 'sabor', 'morango', 'Morango', null, true, 1),
    ('cremosinho', 'sabor', 'coco', 'Coco', null, true, 2),
    ('cremosinho', 'sabor', 'maracuja', 'Maracujá', null, true, 3),
    ('cremosinho', 'sabor', 'ninho', 'Ninho', null, true, 4),
    ('refrigerante-350-ml', 'sabor', 'coca-cola', 'Coca-Cola', null, true, 0),
    ('refrigerante-350-ml', 'sabor', 'guarana-antarctica', 'Guaraná Antarctica', null, true, 1),
    ('refrigerante-350-ml', 'sabor', 'fanta-laranja', 'Fanta Laranja', null, true, 2),
    ('refrigerante-350-ml', 'sabor', 'fanta-uva', 'Fanta Uva', null, true, 3),
    ('refrigerante-350-ml', 'sabor', 'sprite', 'Sprite', null, true, 4),
    ('trufas', 'sabor', 'chocolate-50', 'Chocolate 50%', null, true, 0),
    ('trufas', 'sabor', 'beijinho', 'Beijinho', null, true, 1),
    ('trufas', 'sabor', 'maracuja', 'Maracujá', null, true, 2),
    ('trufas', 'sabor', 'coco', 'Coco', null, true, 3),
    ('trident', 'sabor', 'menta', 'Menta', null, true, 0),
    ('trident', 'sabor', 'hortela', 'Hortelã', null, true, 1),
    ('trident', 'sabor', 'melancia', 'Melancia', null, true, 2),
    ('trident', 'sabor', 'tutti-frutti', 'Tutti-Frutti', null, true, 3),
    ('mentos', 'sabor', 'fruit-frutas', 'Fruit (Frutas)', null, true, 0),
    ('mentos', 'sabor', 'mint-menta', 'Mint (Menta)', null, true, 1),
    ('mentos', 'sabor', 'rainbow', 'Rainbow', null, true, 2),
    ('halls', 'sabor', 'extra-forte', 'Extra Forte', null, true, 0),
    ('halls', 'sabor', 'menta', 'Menta', null, true, 1),
    ('halls', 'sabor', 'cereja', 'Cereja', null, true, 2),
    ('halls', 'sabor', 'morango', 'Morango', null, true, 3),
    ('halls', 'sabor', 'melancia', 'Melancia', null, true, 4)
  on conflict (product_id, choice_id, id) do nothing;

  insert into public.catalog_options (id, group_id, name, price_cents, image, look, product_id, no_completo, available, position, archived_at) values
    ('leite-em-po', 'dry', 'Leite em pó', 0, null, null, null, false, true, 0, null),
    ('granola', 'dry', 'Granola', 0, null, null, null, false, true, 1, null),
    ('pacoca', 'dry', 'Paçoca', 0, null, null, null, false, true, 2, null),
    ('chocoball', 'dry', 'Chocoball', 0, null, null, null, false, true, 3, null),
    ('amendoim', 'dry', 'Amendoim', 0, null, null, null, false, true, 4, null),
    ('gotas-de-chocolate', 'dry', 'Gotas de chocolate', 0, null, null, null, false, true, 5, null),
    ('canudinho', 'dry', 'Canudinho', 0, null, null, null, false, true, 6, null),
    ('bis', 'dry', 'BIS', 0, null, null, null, false, true, 7, null),
    ('farinha-lactea', 'dry', 'Farinha láctea', 0, null, null, null, false, true, 8, null),
    ('sucrilhos', 'dry', 'Sucrilhos', 0, null, null, null, false, true, 9, null),
    ('marshmallow', 'dry', 'Marshmallow', 0, null, null, null, false, true, 10, null),
    ('leite-condensado', 'dry', 'Leite condensado', 0, null, null, null, true, true, 11, null),
    ('disquete', 'dry', 'Disquete (confete)', 0, null, null, null, false, true, 12, null),
    ('kiwi', 'fruit', 'Kiwi', 0, null, null, null, false, true, 0, null),
    ('morango', 'fruit', 'Morango', 0, null, null, null, false, true, 1, null),
    ('banana', 'fruit', 'Banana', 0, null, null, null, false, true, 2, null),
    ('creme-de-ninho', 'syrup', 'Creme de ninho', 300, null, null, null, false, true, 0, null),
    ('creme-de-avela', 'syrup', 'Creme de avelã', 300, null, null, null, false, true, 1, null),
    ('calda-frutas-vermelhas', 'syrup', 'Frutas vermelhas', 0, null, null, null, false, true, 2, null),
    ('calda-doce-de-leite', 'syrup', 'Doce de leite', 0, null, null, null, false, true, 3, null),
    ('calda-acai', 'syrup', 'Açaí', 0, null, null, null, false, true, 4, null),
    ('calda-banana-caramelizada', 'syrup', 'Banana caramelada', 0, null, null, null, false, true, 5, null),
    ('calda-chocolate', 'syrup', 'Chocolate', 0, null, null, null, false, true, 6, null),
    ('calda-morango', 'syrup', 'Morango', 0, null, null, null, false, true, 7, null),
    ('calda-leite-condensado', 'syrup', 'Leite condensado', 0, null, 'leite-condensado', 'milk-shake', false, true, 8, null),
    ('cereja', 'paid', 'Cereja', 300, null, null, null, false, true, 0, null),
    ('kit-kat', 'paid', 'Kit Kat', 400, null, null, null, false, true, 1, null),
    ('batido-creme-de-avela', 'batido', 'Creme de avelã', 300, null, 'creme-de-avela', null, false, true, 0, null),
    ('batido-creme-de-morango', 'batido', 'Creme de morango', 300, null, 'creme-de-morango', null, false, true, 1, null),
    ('batido-creme-de-cookies', 'batido', 'Creme de cookies', 300, null, 'creme-de-cookies', null, false, true, 2, null),
    ('batido-creme-de-ninho', 'batido', 'Creme de ninho', 300, null, 'creme-de-ninho', null, false, true, 3, null),
    ('batido-ovomaltine', 'batido', 'Ovomaltine', 300, null, 'ovomaltine', null, false, true, 4, null)
  on conflict (id) do nothing;

  insert into public.catalog_product_groups (product_id, group_id, position, max_select) values
    ('acai-oca', 'dry', 0, null),
    ('acai-oca', 'fruit', 1, null),
    ('acai-oca', 'syrup', 2, null),
    ('acai-oca', 'paid', 3, null),
    ('acai-tradicional', 'dry', 0, null),
    ('acai-tradicional', 'fruit', 1, null),
    ('acai-tradicional', 'syrup', 2, null),
    ('acai-tradicional', 'paid', 3, null),
    ('acai-batido', 'batido', 0, null),
    ('milk-shake', 'syrup', 0, null),
    ('milk-shake', 'paid', 1, null),
    ('pote-de-acai-1-litro', 'dry', 0, null),
    ('pote-de-acai-1-litro', 'fruit', 1, null),
    ('pote-de-acai-1-litro', 'syrup', 2, null),
    ('pote-de-acai-1-litro', 'paid', 3, null),
    ('barca-de-acai', 'dry', 0, null),
    ('barca-de-acai', 'fruit', 1, 2),
    ('barca-de-acai', 'paid', 2, null)
  on conflict (product_id, group_id) do nothing;

  insert into public.catalog_offers (id, product_id, badge_emoji, badge_text, title, subtitle, variant_id, promo_price_cents, position, status, starts_at, ends_at) values
    ('pote-de-acai-1-litro', 'pote-de-acai-1-litro', '🔥', 'Oferta mais pedida', 'Pote de Açaí 1 Litro Montado', 'Escolha até 7 adicionais grátis por apenas {preco} (de {preco_antigo})!', null, null, 0, 'ativa', null, null),
    ('barca-de-acai', 'barca-de-acai', '⭐', 'Especial da casa', 'Barca de Açaí Completa', 'Barca super recheada + 1 cobertura à sua escolha por {preco}!', null, null, 1, 'ativa', null, null),
    ('kit-completo-casquinha', 'kit-completo-casquinha', '🍦', 'Combo família', 'Kit Completo Casquinha', 'Pote de sorvete 2 Litros + 1 cobertura + 10 casquinhas por {preco}!', null, null, 2, 'ativa', null, null),
    ('pote-de-acai-2-litros', 'pote-de-acai-2-litros', '🍨', 'Tamanho família', 'Açaí Pote de 2 Litros', '2 litros de açaí cremoso pronto para dividir com a galera!', null, null, 3, 'ativa', null, null),
    ('combo-1-litro', 'combo-1-litro', '⚡', 'Combo perfeito', 'Combo Sorvete 1L + 10 Casquinhas', 'Pote de 1 Litro + 10 casquinhas crocantes por apenas {preco}!', null, null, 4, 'ativa', null, null),
    ('pote-de-sorvete-2-litros-especiais', 'pote-de-sorvete-2-litros-especiais', '🍧', 'Super cremoso', 'Pote de Sorvete 2 Litros', 'Sabores especiais como Sensação, Napolitano e Chocolate por {preco}!', null, null, 5, 'ativa', null, null),
    ('acai-oca', 'acai-oca', '👑', 'Carro-chefe da loja', 'Açaí Oca — O Mais Pedido', 'Monte no pote, copo ou isopor a partir de {preco} com adicionais grátis!', null, null, 6, 'ativa', null, null),
    ('acai-batido', 'acai-batido', '🥤', 'Refrescante', 'Açaí Batido Cremoso', 'Com leite condensado, amendoim ou paçoca a partir de {preco}!', null, null, 7, 'ativa', null, null),
    ('picole-gourmet', 'picole-gourmet', '🍫', 'Dica irresistível', 'Picolé Gourmet Cremoso', 'Sabores Nutella, Paçoca, Morango com Chocolate e Iogurte por {preco}!', null, null, 8, 'ativa', null, null),
    ('picole-trufado', 'picole-trufado', '✨', 'Recheado', 'Picolé Trufado', 'Cremosidade e recheio de Mousse de Maracujá, Ninho com Nutella e mais por {preco}!', null, null, 9, 'ativa', null, null),
    ('moreninha', 'moreninha', '🍦', 'Clássico gelado', 'Sorvete Moreninha', 'Casquinha com sorvete banhada na cobertura crocante de chocolate por {preco}!', null, null, 10, 'ativa', null, null),
    ('cremosinho', 'cremosinho', '❄️', 'Geladinho', 'Cremosinho (Dindin)', 'Super cremoso nos sabores Ninho, Chocolate, Morango e Coco por apenas {preco}!', null, null, 11, 'ativa', null, null)
  on conflict (id) do nothing;

  update public.catalog_meta set seeded_at = now() where id = 1;
end
$semente$;
-- <<< fim da semente do cardápio

-- ---------------------------------------------------------------------------------------------
-- Conversão das mudanças antigas do vendedor (catalog_changes), uma vez por linha
-- ---------------------------------------------------------------------------------------------
-- Campos simples (nome, descrição, preço, preço riscado, foto, disponível, excluído, seção e preço
-- de cada tamanho) entram nos registros novos. Tamanhos, sabores e escolhas trocados por inteiro,
-- itens novos e o que não der para ler ficam "pendente" em catalog_import_log, com a mudança
-- inteira, para o vendedor refazer no painel. catalog_changes não é apagada.

do $conversao$
declare
  r record;
  d jsonb;
  resto jsonb;
begin
  for r in
    select c.kind, c.id, c.data from public.catalog_changes c
    where c.kind in ('items', 'products', 'toppings', 'sections')
    order by c.kind, c.id
  loop
    continue when exists (select 1 from public.catalog_import_log l where l.source_kind = r.kind and l.source_id = r.id);
    d := r.data;
    begin
      if r.kind in ('items', 'products') then
        if coalesce((d->>'created')::boolean, false) or not exists (select 1 from public.catalog_products p where p.id = r.id) then
          insert into public.catalog_import_log (source_kind, source_id, status, detail)
          values (r.kind, r.id, 'pendente', jsonb_build_object('motivo', 'item novo ou fora do cardápio', 'mudanca', d));
          continue;
        end if;
        update public.catalog_products p set
          name = coalesce(nullif(btrim(d->>'name'), ''), p.name),
          description = case when r.kind = 'items' then coalesce(d->>'description', p.description) else p.description end,
          price_cents = case when r.kind = 'items' then coalesce((d->>'priceCents')::integer, p.price_cents) else p.price_cents end,
          compare_at_cents = case
            when r.kind = 'items' and d ? 'originalPriceCents' then (d->>'originalPriceCents')::integer
            else p.compare_at_cents end,
          image = case when coalesce(d->>'image', '') ~ '^(images/|https://)' then d->>'image' else p.image end,
          available = coalesce((d->>'available')::boolean, p.available),
          category_id = case
            when r.kind = 'items' and exists (
              select 1 from public.catalog_categories c where c.id = d->>'drawer' and c.layout = 'grade'
            ) then d->>'drawer'
            else p.category_id end,
          archived_at = case when coalesce((d->>'deleted')::boolean, false) then coalesce(p.archived_at, now()) else p.archived_at end
        where p.id = r.id;
        if r.kind = 'products' and jsonb_typeof(d->'sizePrices') = 'object' and not d ? 'sizes' then
          update public.catalog_variants v set price_cents = e.value::integer
          from jsonb_each_text(d->'sizePrices') e
          where v.product_id = r.id and v.id = e.key;
        end if;
        resto := jsonb_strip_nulls(jsonb_build_object(
          'sizes', d->'sizes',
          'flavors', d->'flavors',
          'groups', d->'groups',
          'description', case when r.kind = 'products' then d->'description' end
        ));
      elsif r.kind = 'toppings' then
        if coalesce((d->>'created')::boolean, false) or not exists (select 1 from public.catalog_options o where o.id = r.id) then
          insert into public.catalog_import_log (source_kind, source_id, status, detail)
          values (r.kind, r.id, 'pendente', jsonb_build_object('motivo', 'complemento novo ou fora do cardápio', 'mudanca', d));
          continue;
        end if;
        update public.catalog_options o set
          name = coalesce(nullif(btrim(d->>'name'), ''), o.name),
          price_cents = coalesce((d->>'priceCents')::integer, o.price_cents),
          image = case when coalesce(d->>'image', '') ~ '^(images/|https://)' then d->>'image' else o.image end,
          available = coalesce((d->>'available')::boolean, o.available),
          archived_at = case when coalesce((d->>'deleted')::boolean, false) then coalesce(o.archived_at, now()) else o.archived_at end
        where o.id = r.id;
        resto := '{}'::jsonb;
      else
        if r.id = 'monte' then
          update public.catalog_categories c set name = coalesce(nullif(btrim(d->>'name'), ''), c.name)
          where c.layout = 'vitrine' and c.archived_at is null;
        elsif exists (select 1 from public.catalog_categories c where c.id = r.id) then
          update public.catalog_categories c set
            name = coalesce(nullif(btrim(d->>'name'), ''), c.name),
            subtitle = coalesce(d->>'subtitle', c.subtitle)
          where c.id = r.id;
        else
          insert into public.catalog_import_log (source_kind, source_id, status, detail)
          values (r.kind, r.id, 'pendente', jsonb_build_object('motivo', 'seção fora do cardápio', 'mudanca', d));
          continue;
        end if;
        resto := '{}'::jsonb;
      end if;
      insert into public.catalog_import_log (source_kind, source_id, status, detail)
      values (
        r.kind, r.id,
        case when resto = '{}'::jsonb then 'convertido' else 'pendente' end,
        jsonb_build_object('mudanca', d, 'nao_convertido', resto)
      );
    exception when others then
      insert into public.catalog_import_log (source_kind, source_id, status, detail)
      values (r.kind, r.id, 'pendente', jsonb_build_object('motivo', 'erro ao converter: ' || sqlerrm, 'mudanca', d));
    end;
  end loop;
end
$conversao$;
