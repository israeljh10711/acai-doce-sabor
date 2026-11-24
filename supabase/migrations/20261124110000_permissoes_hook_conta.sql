begin;
revoke all on function public.antes_de_criar_usuario(jsonb) from public, anon, authenticated;
grant execute on function public.antes_de_criar_usuario(jsonb) to supabase_auth_admin;
commit;
