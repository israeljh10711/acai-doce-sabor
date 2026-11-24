# Contas de cliente e vendedor

A conta aceita um nome de usuário ou telefone brasileiro com DDD e uma senha. O telefone serve como identificador. O sistema não confirma a posse da linha por SMS. O visitante continua comprando com a sessão anônima. Pedidos e endereços pertencem ao UID que o Supabase Auth autenticou.

## Configuração de cada ambiente

1. Configure no frontend `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ou `VITE_SUPABASE_PUBLISHABLE_KEY`) do mesmo projeto. O modo local para demonstração funciona apenas em desenvolvimento. Na build de produção, a loja informa indisponibilidade se a configuração estiver incompleta.
2. No gerenciador de segredos das Edge Functions, crie `ACCOUNT_SECRET` com um valor aleatório exclusivo desse projeto, de pelo menos 32 bytes, e `SELLER_EMAIL` com o endereço Auth do vendedor já vinculado a `public.sellers`. O Supabase injeta as chaves privadas e públicas do projeto na função. Guarde uma cópia protegida do segredo. Alterá-lo sem migrar as credenciais impede o acesso às contas existentes.
3. Aplique em ordem as quatro migrations de 24/11/2026 em `supabase/migrations`. Mantenha habilitados o login anônimo e o hook `antes_de_criar_usuario` em Authentication.
4. Implante as funções `conta` e `pedido` no mesmo projeto, com o `config.toml` do repositório. A função de conta verifica a senha no Auth. A função de pedidos valida a sessão nas operações vinculadas ao cliente. O banco salva o endereço de entrega na conta quando registra o pedido.
5. Teste cadastro, login em outro navegador, saída, compra visitante e login operacional do vendedor em prévia antes de promover a versão. Sessões antigas do vendedor exigem novo login. No primeiro acesso, a função verifica a senha existente e atualiza a credencial interna e seu marcador em uma única operação no Auth. Uma falha antes da atualização permite nova tentativa após dois minutos. Uma falha depois da atualização permite entrar com a mesma senha.

## Limites e autorização

Há oito tentativas por identificador em quinze minutos, além de limite por IP de trinta acessos ou dez cadastros na mesma janela. As reservas no Postgres antecedem a verificação e funcionam entre instâncias concorrentes. Um login válido devolve apenas as próprias reservas. A resposta 429 informa o tempo de espera. O IP vem do cabeçalho sobrescrito pela plataforma Supabase. Em um ambiente auto-hospedado, configure o proxy de entrada para sobrescrever `cf-connecting-ip`.

A função deriva a credencial enviada ao Auth com HMAC-SHA-256 e um segredo de servidor. O usuário só fornece sua senha habitual. O Auth guarda o hash bcrypt da credencial derivada. A RLS do vendedor exige o UID autorizado e a sessão que a função aprovou. Uma sessão obtida diretamente com a senha legada antes da primeira conversão não recebe acesso administrativo. O Supabase também aplica seus próprios limites de Auth. [Documentação do Supabase](https://supabase.com/docs/guides/auth/rate-limits)

O esquema privado de tentativas usa chaves derivadas. O histórico e os endereços são protegidos por UID. O telefone digitado em um pedido não autoriza consultar compras antigas nem recuperar senha.
