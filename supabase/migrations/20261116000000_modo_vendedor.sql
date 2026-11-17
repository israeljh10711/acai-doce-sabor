-- Modo vendedor do Açaí Doce Sabor (pedido de 2026-11-16).
--
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Passo a passo completo em docs/supabase.md.
--
-- O que este script faz:
-- * catalog_changes: as mudanças do vendedor no cardápio (preço, foto, esgotado, itens novos);
--   todos leem, só o vendedor grava;
-- * sellers: quem pode gravar (o usuário do vendedor, criado em Authentication > Users);
-- * bucket "catalogo": as fotos enviadas pelo vendedor, públicas para leitura.

create table if not exists public.catalog_changes (
  kind text not null check (kind in ('items', 'products', 'toppings')),
  id text not null check (char_length(id) between 1 and 80),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 20000),
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

create table if not exists public.sellers (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.catalog_changes enable row level security;
alter table public.sellers enable row level security;

-- Quem está logado é vendedor? (security definer: lê sellers mesmo com RLS.)
create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sellers where user_id = auth.uid());
$$;

revoke all on function public.is_seller() from public;
grant execute on function public.is_seller() to anon, authenticated;

drop policy if exists "todos leem o cardapio" on public.catalog_changes;
create policy "todos leem o cardapio" on public.catalog_changes
  for select to anon, authenticated using (true);

drop policy if exists "vendedor grava" on public.catalog_changes;
create policy "vendedor grava" on public.catalog_changes
  for insert to authenticated with check (public.is_seller());

drop policy if exists "vendedor altera" on public.catalog_changes;
create policy "vendedor altera" on public.catalog_changes
  for update to authenticated using (public.is_seller()) with check (public.is_seller());

drop policy if exists "vendedor apaga" on public.catalog_changes;
create policy "vendedor apaga" on public.catalog_changes
  for delete to authenticated using (public.is_seller());

drop policy if exists "vendedor se ve" on public.sellers;
create policy "vendedor se ve" on public.sellers
  for select to authenticated using (user_id = auth.uid());

-- Fotos: bucket público para leitura; só o vendedor envia ou apaga. Até 2 MB, só imagens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vendedor envia fotos" on storage.objects;
create policy "vendedor envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalogo' and public.is_seller());

drop policy if exists "vendedor apaga fotos" on storage.objects;
create policy "vendedor apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'catalogo' and public.is_seller());

-- Depois de criar o usuário do vendedor em Authentication > Users (com "Auto Confirm User"),
-- troque o e-mail abaixo pelo dele e rode só esta linha:
--
-- insert into public.sellers (user_id) select id from auth.users where email = 'vendedor@exemplo.com' on conflict do nothing;
