-- Permissões das tabelas do Açaí Doce Sabor (2026-11-20).
--
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode DEPOIS dos arquivos 20261116000000_modo_vendedor.sql e 20261117120000_pedidos.sql.
--
-- Por que existe: projetos novos do Supabase não liberam mais as tabelas novas para o site
-- sozinhos. Sem estas linhas, o banco responde "permission denied for table catalog_changes"
-- e nem as regras (RLS) dos outros arquivos chegam a valer. Aqui não se abre nada além do que
-- aquelas regras já previam: quem grava continua sendo decidido por elas.

grant usage on schema public to anon, authenticated, service_role;

-- Cardápio: todos leem; o vendedor logado grava, altera e apaga (a regra confere is_seller()).
grant select on public.catalog_changes to anon, authenticated, service_role;
grant insert, update, delete on public.catalog_changes to authenticated;

-- Vendedores: cada um vê só a própria linha (para o site saber que o login é de vendedor).
grant select on public.sellers to authenticated;

-- Pedidos: a função "pedido" grava com a chave de servidor; o vendedor lê e muda só a situação.
grant select, insert, update on public.orders to service_role;
grant select on public.orders to authenticated;
grant update (status) on public.orders to authenticated;
