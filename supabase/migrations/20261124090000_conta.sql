-- O contador é compartilhado por todas as instâncias da função conta.
begin;
create schema if not exists conta_privada;
revoke all on schema conta_privada from public, anon, authenticated;
create table conta_privada.tentativas (
  chave text primary key,
  ate timestamptz not null,
  quantidade integer not null
);
create index tentativas_expiradas on conta_privada.tentativas(ate);
alter table conta_privada.tentativas enable row level security;

create function public.conta_reservar_tentativa(chave text, limite integer, segundos integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  agora timestamptz := clock_timestamp();
  janela interval := make_interval(secs => segundos);
  fim timestamptz;
begin
  if chave is null or chave !~ '^[0-9a-f]{64}$' or limite not between 1 and 100
    or segundos not between 60 and 3600 then
    raise exception 'Parâmetros inválidos';
  end if;
  -- Limpeza limitada para não manter registros antigos nem varrer a tabela inteira.
  delete from conta_privada.tentativas t where t.chave in (
    select v.chave from conta_privada.tentativas v where v.ate < agora - interval '1 hour'
    order by v.ate limit 20 for update skip locked
  );
  insert into conta_privada.tentativas as t values (chave, agora + janela, 1)
  on conflict on constraint tentativas_pkey do update set
    quantidade = case when t.ate <= agora then 1 else t.quantidade + 1 end,
    ate = case when t.ate <= agora then agora + janela else t.ate end
  where t.ate <= agora or t.quantidade < limite
  returning ate into fim;
  if found then return -floor(extract(epoch from fim))::integer; end if;
  select t.ate into fim from conta_privada.tentativas t where t.chave = $1;
  return greatest(1, ceil(extract(epoch from fim - agora))::integer);
end $$;
revoke all on function public.conta_reservar_tentativa(text, integer, integer) from public, anon, authenticated;
grant execute on function public.conta_reservar_tentativa(text, integer, integer) to service_role;

create table conta_privada.sessoes_vendedor (
  sessao uuid primary key references auth.sessions(id) on delete cascade,
  vendedor uuid not null references public.sellers(user_id) on delete cascade
);
create index sessoes_por_vendedor on conta_privada.sessoes_vendedor(vendedor);
alter table conta_privada.sessoes_vendedor enable row level security;

create function public.conta_autorizar_vendedor(sessao uuid, vendedor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.sessions s join public.sellers v on v.user_id = s.user_id
    where s.id = $1 and v.user_id = $2
  ) then return false; end if;
  insert into conta_privada.sessoes_vendedor values ($1, $2) on conflict do nothing;
  return true;
end $$;

create function public.conta_devolver_tentativa(chave text, janela integer)
returns void language sql security definer set search_path = '' as $$
  update conta_privada.tentativas t set quantidade = greatest(0, t.quantidade - 1)
  where t.chave = $1 and floor(extract(epoch from t.ate)) = $2;
$$;
revoke all on function public.conta_devolver_tentativa(text, integer) from public, anon, authenticated;
grant execute on function public.conta_devolver_tentativa(text, integer) to service_role;

-- Uma única atualização administrativa por vez, inclusive se duas abas iniciarem o primeiro login.
create table conta_privada.conversoes_vendedor (
  vendedor uuid primary key references public.sellers(user_id) on delete cascade,
  ate timestamptz not null
);
alter table conta_privada.conversoes_vendedor enable row level security;

create function public.conta_reservar_conversao(vendedor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.sellers s join auth.users u on u.id = s.user_id
    where s.user_id = $1 and coalesce(u.raw_app_meta_data->>'seller_password_version','') <> '1'
  ) then return false; end if;
  insert into conta_privada.conversoes_vendedor as c values ($1, now() + interval '2 minutes')
  on conflict on constraint conversoes_vendedor_pkey do update set ate = excluded.ate where c.ate <= now();
  return found;
end $$;
revoke all on function public.conta_reservar_conversao(uuid), public.conta_autorizar_vendedor(uuid, uuid) from public, anon, authenticated;
grant execute on function public.conta_reservar_conversao(uuid), public.conta_autorizar_vendedor(uuid, uuid) to service_role;

-- Um token obtido diretamente no Auth não concede acesso administrativo.
create or replace function public.is_seller() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (select 1 from conta_privada.sessoes_vendedor s
    where s.sessao = nullif((select auth.jwt())->>'session_id', '')::uuid and s.vendedor = (select auth.uid()));
$$;
create or replace function public.antes_de_criar_usuario(event jsonb)
returns jsonb language sql stable set search_path = '' as $$
  select case when event->'user'->>'is_anonymous' = 'true'
    or (event->'user'->'app_metadata'->>'customer_account' = 'true' and
        event->'user'->>'email' ~ '^[0-9a-f]{48}@cliente[.]invalid$')
    then '{}'::jsonb else jsonb_build_object('error', jsonb_build_object(
      'http_code',403,'message','Use o cadastro de cliente no site.'
    )) end;
$$;
commit;
