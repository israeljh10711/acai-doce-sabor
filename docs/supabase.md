# Ligar o modo vendedor e os pedidos ao Supabase

Com o Supabase ligado:
- o que o vendedor muda no site chega a todos os clientes:
  - preço, foto, esgotado, produto ou complemento novo, sabores;
  - loja aberta ou fechada, tempo de entrega, entrega e frete, horários e contato;
- cada pedido é conferido e registrado no banco antes de abrir o WhatsApp, com o código ADS-0001, ADS-0002... (desde 2026-11-17).

Sem ele, as mudanças ficam só no aparelho em que foram feitas, e o pedido vai só pelo WhatsApp.

O plano gratuito do Supabase basta. Não cadastre cartão de crédito.

## 1. Criar o projeto (você)

1. Entre em supabase.com e crie uma conta.
2. Clique em **New project**. Escolha um nome (por exemplo `acai-doce-sabor`), uma senha para o banco (guarde com você, não mande para ninguém) e a região **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1 a 2 minutos).

## 2. Criar as tabelas e o lugar das fotos

1. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
2. Copie todo o arquivo `supabase/migrations/20261116000000_modo_vendedor.sql` deste projeto, cole e clique em **Run**. Deve aparecer "Success".

Se você já rodou este arquivo antes de 2026-11-17, rode de novo: ele passou a aceitar as configurações da loja (o tipo `settings`). Rodar de novo não apaga nada.

3. Em **New query** de novo, copie todo o arquivo `supabase/migrations/20261117120000_pedidos.sql`, cole e clique em **Run**. Ele cria a tabela dos pedidos (`orders`) e a numeração dos códigos. Tem de ser depois do primeiro arquivo.
4. Em **New query** mais uma vez, copie todo o arquivo `supabase/migrations/20261120000000_permissoes.sql`, cole e clique em **Run**. Ele libera as tabelas para o site e para a função. Sem ele, projetos novos do Supabase respondem "permission denied for table catalog_changes". Tem de ser depois dos dois primeiros.

## 3. Criar a conta do vendedor

1. Abra **Authentication > Users** e clique em **Add user > Create new user**.
2. E-mail: um e-mail só para o login, por exemplo `vendedor@acaidocesabor.app`. Ele não precisa receber mensagens, porque a confirmação fica marcada no passo seguinte. Esse e-mail fica visível no código do site, então use um que não seja pessoal.
3. Senha: a senha que o vendedor vai digitar no site. O Supabase exige **pelo menos 6 caracteres**.
4. Marque **Auto Confirm User** e crie.
5. Volte ao **SQL Editor** e rode esta linha, com o e-mail do passo 2:

   ```sql
   insert into public.sellers (user_id) select id from auth.users where email = 'vendedor@acaidocesabor.app' on conflict do nothing;
   ```

6. Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. Assim ninguém cria conta pelo site.

## 4. Pegar o endereço e a chave pública

Em **Project Settings > API** (ou **Data API** e **API Keys**):

- **Project URL**: algo como `https://abcdxyz.supabase.co`;
- a chave **anon public** ou **publishable** (começa com `eyJ` ou com `sb_publishable_`).

Nunca use nem envie a chave **service_role** ou **secret**. Ela dá acesso total ao banco.

## 5. Onde colar

Na pasta do projeto (`C:\Users\johra\Projetos\acai-doce-sabor`), crie um arquivo chamado **`.env.local`** com estas três linhas (o `.env.example` mostra o modelo):

```
VITE_SUPABASE_URL=https://abcdxyz.supabase.co
VITE_SUPABASE_ANON_KEY=cole-aqui-a-chave-anon-ou-publishable
VITE_SELLER_EMAIL=vendedor@acaidocesabor.app
```

O `.env.local` não vai para o Git. Depois de salvar, reinicie o site (`npm run dev -- --host`).

## 6. Criar a função que registra os pedidos

A função `pedido` confere os preços e as regras no servidor, grava o pedido e devolve a mensagem com o código.

1. No menu da esquerda, abra **Edge Functions** e clique em **Deploy a new function** > **Via Editor**.
2. Dê o nome **`pedido`** (exatamente assim, em minúsculas).
3. Apague todo o código de exemplo do editor. Copie todo o arquivo `supabase/functions/pedido/index.ts` deste projeto (são umas 3.400 linhas) e cole no lugar.
4. Clique em **Deploy function** e espere a mensagem de sucesso.
5. Na página da função, abra **Details** (ou **Settings**) e **desligue** a verificação de JWT (**Verify JWT** / **Enforce JWT verification**). Depois salve. Sem isso, a função recusa os pedidos que chegam com a chave publishable.

A função usa a chave de servidor que o próprio Supabase guarda no ambiente dela. Você não cola chave nenhuma nela.

**Quando o cardápio do código mudar** (um produto, um preço ou um tamanho mudados direto no código), a função precisa da versão nova:
1. rode `npm run build:pedido`;
2. abra a função `pedido` no painel e cole de novo o arquivo `supabase/functions/pedido/index.ts`;
3. clique em **Deploy updates**.

O que o vendedor muda pelo modo vendedor não precisa disso: a função lê o banco a cada pedido.

## 7. Conferir

1. Abra o cardápio, clique em **Senha para vendedor** e entre com a senha do passo 3.3.
2. A faixa do topo deve dizer "Salvo na nuvem: vale para todos os clientes".
3. Mude o preço de um item e abra o site em outro aparelho: o preço novo aparece. Em quem já está com a página aberta, aparece em até 1 minuto ou ao voltar para a aba.
4. Toque em **Loja Aberta** para fechar a loja: no outro aparelho, o topo passa a mostrar "Loja fechada no momento". Toque de novo para abrir.
5. Faça um pedido de teste no site. No carrinho deve aparecer "Pedido ADS-0001 registrado", e o WhatsApp abre com a linha "🔖 Pedido: ADS-0001".
6. Os pedidos ficam em **Table Editor > orders**, com o nome, o endereço, os itens, o total, a comanda e a situação ("novo").
7. Para apagar o pedido de teste, marque a linha em **Table Editor > orders** e apague. O próximo código continua a numeração (ADS-0002).

## Se algo der errado

- **Senha certa não entra:** confira se o e-mail do `.env.local` é igual ao da conta e se a linha do passo 3.5 foi rodada.
- **Supabase fora do ar ou chave errada:** o site continua funcionando com o último cardápio que ele conseguiu ler.
- **No carrinho aparece "Não foi possível registrar o pedido agora":**
  - confira se a função se chama `pedido`;
  - confira se a verificação de JWT dela está desligada (passo 6.5);
  - confira se o arquivo `20261117120000_pedidos.sql` foi rodado (passo 2.3).

  Enquanto isso, o cliente pode tocar em **Enviar mesmo assim pelo WhatsApp**: o pedido chega pelo WhatsApp marcado "Pedido não registrado no sistema", e a venda não se perde.
- **No carrinho aparece sempre "Os preços mudaram":** a função colada está com um cardápio mais antigo que o site. Faça os passos de "Quando o cardápio do código mudar" (passo 6).
- **Mudanças feitas antes do Supabase, guardadas no aparelho:** no modo vendedor desse aparelho, use **Backup / Restaurar > Baixar backup**. Depois de ligar o Supabase, use **Restaurar backup** com o mesmo arquivo. As fotos também sobem.
