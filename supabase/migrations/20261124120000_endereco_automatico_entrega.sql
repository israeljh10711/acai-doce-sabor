begin;

-- O endereço acompanha a confirmação do pedido na mesma transação. Reenvios
-- idempotentes que apenas consultam o pedido não substituem o endereço atual.
create function conta_privada.guardar_endereco_entrega()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users u where u.id = new.customer_user_id
      and not u.is_anonymous and u.raw_app_meta_data->'customer_account' = 'true'::jsonb
  ) then
    insert into public.customer_addresses (user_id, street, number, district, reference)
    values (new.customer_user_id, new.address->>'street', new.address->>'number',
      new.address->>'district', coalesce(new.address->>'reference', ''))
    on conflict (user_id) do update set street = excluded.street, number = excluded.number,
      district = excluded.district, reference = excluded.reference,
      zone_id = case when customer_addresses.district = excluded.district then customer_addresses.zone_id end;
  end if;
  return new;
end $$;
revoke all on function conta_privada.guardar_endereco_entrega() from public, anon, authenticated;
create trigger guardar_endereco_entrega after insert on public.orders
for each row when (new.fulfillment = 'entrega' and new.customer_user_id is not null)
execute function conta_privada.guardar_endereco_entrega();
commit;
