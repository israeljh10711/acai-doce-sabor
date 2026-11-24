# Ligar o modo vendedor e os pedidos ao Supabase

Com o Supabase ligado:
- o que o vendedor muda no site chega a todos os clientes:
  - preço, foto, esgotado, produto ou complemento novo, sabores;
  - loja aberta ou fechada, tempo de entrega, entrega e frete, horários e contato;
- o cliente finaliza o pedido no próprio site, sem WhatsApp (desde 2026-11-20). A função `pedido` confere e grava cada pedido com o código ADS-0001, ADS-0002...;
- o cliente acompanha cada etapa ao vivo e pode acrescentar itens ao mesmo pedido enquanto ele está em Novo ou Preparando.

Em desenvolvimento, sem o Supabase, a demonstração usa os dados deste navegador. Em produção a conexão é obrigatória. A autenticação atual de clientes e vendedor usa a Edge Function `conta`. Consulte a [configuração de contas](conta-cliente.md).

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
5. Em **New query**, copie todo o arquivo `supabase/migrations/20261120120000_modalidades_gps.sql`, cole e clique em **Run**. Ele acrescenta "Comer no Local" e o GPS da entrega aos pedidos (veja "Modalidades e GPS nos pedidos", abaixo). Tem de ser depois dos três primeiros e **antes** de colar a função nova (passo 6).
6. Em **New query**, copie todo o arquivo `supabase/migrations/20261120180000_painel_ao_vivo.sql`, cole e clique em **Run**. Ele liga o Realtime da tabela `orders` e acrescenta as situações "pronto para retirada" e "pronto para consumo" (veja "Painel de pedidos ao vivo", abaixo). Tem de ser depois do passo 5.
7. Em **New query**, copie todo o arquivo `supabase/migrations/20261120200000_acompanhamento_cliente.sql`, cole e clique em **Run**. Ele cria o acompanhamento do cliente e a adição de itens (veja "Pedido 100% no site", abaixo). Tem de ser depois do passo 6 e **antes** de colar a função nova e de publicar o site novo.
8. Em **New query**, copie todo o arquivo `supabase/migrations/20261121120000_catalogo_dinamico.sql` (umas 1.100 linhas), cole e clique em **Run**. Ele cria o cardápio no banco, com a semente (veja "Cardápio dinâmico", abaixo). Tem de ser depois do passo 7 e **antes** de colar a função nova e de publicar o site novo. Rodar de novo não apaga nada nem sobrescreve o que o vendedor mudou.

### Já tinha tudo funcionando antes de 2026-11-20?

Para ligar as três modalidades e o GPS, siga esta ordem:
1. rode o `20261120120000_modalidades_gps.sql` (passo 2.5);
2. rode `npm run build:pedido` e cole de novo o arquivo `supabase/functions/pedido/index.ts` na função `pedido` (como em "Quando o cardápio do código mudar", no passo 6);
3. publique o site novo.

Para o **painel ao vivo** (também de 2026-11-20): rode o `20261120180000_painel_ao_vivo.sql` (passo 2.6) antes de publicar o site novo. Sem ele, o painel funciona, mas sem receber na hora (confere a cada 15 s), e os botões "Pronto para Retirada" e "Pronto para Consumo" são recusados pelo banco. A função `pedido` não precisa ser colada de novo por causa do painel.

Para o **pedido 100% no site** (acompanhamento e adição de itens, também de 2026-11-20), siga esta ordem:
1. rode o `20261120200000_acompanhamento_cliente.sql` (passo 2.7);
2. ligue o login anônimo e o gancho (passos 3.6 e 3.7);
3. rode `npm run build:pedido` e cole de novo o arquivo `supabase/functions/pedido/index.ts` na função `pedido`;
4. publique o site novo.

Para o **Pacote 1** (2026-11-21): nenhum SQL. Para o telefone obrigatório no frete a combinar valer também no servidor, rode `npm run build:pedido` e cole de novo a função `pedido` (veja "Pacote 1", abaixo).

Para o **cardápio dinâmico** (2026-11-21), siga esta ordem:
1. rode o `20261121120000_catalogo_dinamico.sql` (passo 2.8);
2. rode `npm run build:pedido` e cole de novo o arquivo `supabase/functions/pedido/index.ts` na função `pedido`;
3. publique o site novo.

Fora dessa ordem:
- **Função nova sem o SQL 2.8:** todo pedido responde "Não foi possível confirmar o pedido agora", e nada é gravado.
- **Site novo sem o SQL 2.8:** a loja mostra "Cardápio indisponível agora".
- **Site novo com a função antiga:** os pedidos "Comer no Local" são recusados ("Confira seus dados"). Os outros são gravados, mas sem acompanhamento ao vivo.
- **Função nova sem o SQL:** a gravação falha. O cliente vê "Não foi possível confirmar o pedido agora" e "Tentar de novo", e nada é gravado pela metade.
- **Site novo sem o SQL 2.7:** o painel do vendedor mostra o erro "column orders.additions does not exist".
- **Sem o login anônimo (passo 3.6):** os pedidos são gravados, mas o cliente vê "o acompanhamento ao vivo não ficou disponível".

## 3. Criar a conta do vendedor

1. Abra **Authentication > Users** e clique em **Add user > Create new user**.
2. E-mail: um e-mail só para o login, por exemplo `vendedor@acaidocesabor.app`. Ele não precisa receber mensagens, porque a confirmação fica marcada no passo seguinte. Esse e-mail fica visível no código do site, então use um que não seja pessoal.
3. Senha: a senha que o vendedor vai digitar no site. O Supabase exige **pelo menos 6 caracteres**.
4. Marque **Auto Confirm User** e crie.
5. Volte ao **SQL Editor** e rode esta linha, com o e-mail do passo 2:

   ```sql
   insert into public.sellers (user_id) select id from auth.users where email = 'vendedor@acaidocesabor.app' on conflict do nothing;
   ```

6. Em **Authentication > Sign In / Providers**, **ligue** **Allow anonymous sign-ins** e deixe **Allow new users to sign up** ligado. O login anônimo é a sessão de acompanhamento do cliente (sem e-mail nem dados), e o Supabase só cria sessões anônimas com o cadastro ligado. Quem impede contas com e-mail é o gancho do passo 7.
7. Em **Authentication > Hooks**, clique em **Add hook > Before User Created**:
   - tipo **Postgres**;
   - schema `public`;
   - função `antes_de_criar_usuario` (criada no passo 2.7).

   Salve. A partir daí, só a sessão anônima de acompanhamento pode ser criada pelo site; cadastro com e-mail ou telefone é recusado.

   Para criar outra conta de vendedor depois, desligue o gancho por um instante, crie a conta (passos 1 a 5) e ligue de novo.

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
# SELLER_EMAIL é definido no ambiente privado da função conta.
```

O `.env.local` não vai para o Git. Depois de salvar, reinicie o site (`npm run dev -- --host`).

## 6. Criar a função que registra os pedidos

A função `pedido` confere os preços e as regras no servidor, grava o pedido ligado à sessão do cliente, responde as consultas do acompanhamento e acrescenta itens (veja "Pedido 100% no site", abaixo).

1. No menu da esquerda, abra **Edge Functions** e clique em **Deploy a new function** > **Via Editor**.
2. Dê o nome **`pedido`** (exatamente assim, em minúsculas).
3. Apague todo o código de exemplo do editor. Copie todo o arquivo `supabase/functions/pedido/index.ts` deste projeto (são umas 3.500 linhas) e cole no lugar.
4. Clique em **Deploy function** e espere a mensagem de sucesso.
5. Na página da função, abra **Details** (ou **Settings**) e **desligue** a verificação de JWT (**Verify JWT** / **Enforce JWT verification**). Depois salve. Sem isso, a função recusa os pedidos que chegam com a chave publishable.

A função usa a chave de servidor que o próprio Supabase guarda no ambiente dela. Você não cola chave nenhuma nela.

Desde 2026-11-21, a função lê o cardápio do banco a cada pedido: o que o vendedor muda no painel vale na hora, sem colar nada.

**Quando as regras do código mudarem** (o teste `tests/pedidoBundle.test.ts` avisa), a função precisa da versão nova:
1. rode `npm run build:pedido`;
2. abra a função `pedido` no painel e cole de novo o arquivo `supabase/functions/pedido/index.ts`;
3. clique em **Deploy updates**.

O que o vendedor muda pelo painel ou pelo modo vendedor não precisa disso: a função lê o banco a cada pedido.

## Modalidades e GPS nos pedidos (2026-11-20)

O cliente escolhe uma das três modalidades. A modalidade fica na coluna `fulfillment` da tabela `orders`, a mesma desde 2026-11-17:

| No site | `fulfillment` | `delivery_fee` | Frete | Endereço (`address`) | GPS |
|---|---|---|---|---|---|
| 🛵 Entrega | `entrega` | `gratis`, `taxa` ou `combinar` | o do vendedor | obrigatório | opcional |
| 🛍️ Retirar (buscar e levar) | `retirada` | `retirada` | sempre R$ 0,00 | vazio | nunca |
| 🍨 Comer no Local | `local` | `local` | sempre R$ 0,00 | vazio | nunca |

No código, o tipo é `DeliveryType = 'entrega' | 'retirada' | 'local'`, em `src/features/checkout/delivery.ts`. Corresponde a delivery, pickup e dine_in.

**Colunas do GPS** (todas opcionais):
- `customer_lat` e `customer_lng` (double precision): o ponto que o cliente anexou, com 6 casas decimais (cerca de 11 cm).
- `maps_url` (text): `https://www.google.com/maps?q=LAT,LNG`, montado com essas mesmas coordenadas. É o mesmo link da comanda.

**Regras que o próprio banco confere:**
- as três colunas do GPS vêm juntas ou ficam todas vazias, nunca latitude sem longitude;
- o GPS só pode existir na entrega, com as coordenadas dentro do mapa;
- `retirada` e `local` têm sempre frete zero e nenhum endereço.

A função `pedido` confere tudo isso de novo antes de gravar:
- descarta o GPS fora da entrega;
- descarta coordenadas inválidas;
- calcula o frete pela modalidade, sem aceitar o valor que vem do navegador.

**Pedidos antigos** (antes de 2026-11-20) continuam como estavam:
- `entrega` ou `retirada`;
- as três colunas novas vazias.

O SQL não muda nem apaga nenhum pedido.

**Quem vê o GPS:** só o vendedor logado (a mesma regra de leitura da tabela) e a função. Os visitantes não leem a tabela `orders`. O site só pede a localização quando o cliente toca em "📍 Usar minha localização atual", e o ponto nunca fica guardado no navegador. Depois do toque, o site faz uma consulta ao Nominatim (OpenStreetMap) com o ponto, para sugerir rua e bairro.

## Painel de pedidos ao vivo do Modo Vendedor (2026-11-20)

Com o Modo Vendedor desbloqueado, a faixa do topo mostra o botão **📋 Pedidos**. Quando há pedidos na situação "novo", aparece um selo vermelho pulsante com a quantidade, por exemplo "📋 Pedidos (2)". O botão abre a página `/pedidos`, feita para ficar aberta no balcão. Sem o desbloqueio, nem o botão nem a página mostram pedidos.

### Supabase Realtime

- **Publicação:** o `20261120180000_painel_ao_vivo.sql` (passo 2.6) põe a tabela `orders` na publicação `supabase_realtime`.
  - Para conferir no painel do Supabase: **Database > Publications > supabase_realtime**, e a tabela `orders` tem de aparecer marcada.
  - Pode rodar o SQL de novo: ele não repete a tabela.
- **Inscrição:**
  - o site se inscreve nos eventos `INSERT` (pedido registrado) e `UPDATE` (situação mudada) da tabela `orders`, pelo cliente oficial `@supabase/realtime-js`;
  - a inscrição leva o token do login do vendedor, entregue antes de entrar no canal. O Realtime segue o RLS: só quem é vendedor (`is_seller()`) recebe os pedidos, e um visitante não recebe nada;
  - a inscrição fica ligada enquanto o vendedor estiver logado, em qualquer página (o selo da faixa conta na hora). Ao sair do Modo Vendedor, ela é removida.
- **Carga e eventos:**
  - ao abrir, o painel carrega os pedidos do dia da loja (desde as 5h de Brasília) e os de antes ainda em andamento;
  - os eventos que chegam durante a carga são juntados sem repetir (pelo `id`);
  - se a conexão ao vivo cair, o painel confere sozinho a cada 15 segundos. Com ela ligada, confere a cada 60 segundos, só por garantia.
  - **colunas que não vêm no UPDATE:** numa mudança de situação, o Realtime não repete as colunas grandes que não mudaram, porque o Postgres as guarda à parte (TOAST). No teste real do ADS-0003 (2026-11-20), o UPDATE chegou sem a comanda (`message`). O painel junta cada UPDATE à última linha conhecida do pedido, e o que não veio fica como estava. Sem isso, o cartão perdia a montagem detalhada (Completo, SEM, extras) depois da primeira mudança.

### Situação dos pedidos

| Situação no banco | Botão que leva até ela | Modalidade |
|---|---|---|
| `novo` | (o pedido acabou de chegar) | todas |
| `preparando` | **Aceitar / Preparar** | todas |
| `saiu_para_entrega` (out_for_delivery) | **🛵 Saiu para Entrega** | só entrega |
| `pronto_retirada` (ready_for_pickup) | **🛍️ Pronto para Retirada** | só retirada |
| `pronto_consumo` (ready_for_dine_in) | **🍨 Pronto para Consumo** | só comer no local |
| `concluido` | **✅ Concluir** | todas |
| `cancelado` | **❌ Cancelar** (pede confirmação) | todas, até concluir |

- O banco recusa a situação que não combina com a modalidade (regra `orders_status_modalidade_check`).
- Concluído e cancelado não têm mais ações. Nada é apagado.
- `confirmado` e `pronto` são do fluxo anterior e continuam valendo nos pedidos antigos.
- Se a mudança falhar, o cartão continua na situação antiga e mostra o erro.

**Filtros:** Todos (inclui os cancelados), 🆕 Novos, 🍨 Preparando, 🛵 Saiu / Pronto e ✅ Concluídos.

**Quem pode o quê (RLS, sem mudança):**
- só o vendedor logado lê os pedidos (também pelo Realtime) e muda só a coluna `status`;
- os visitantes não leem nem mudam nada;
- só a função `pedido`, com a chave de servidor do ambiente dela, grava pedidos.

Nenhuma chave de servidor vai para o site.

### Aviso sonoro

Há dois sons, os dois feitos pela Web Audio do navegador, sem arquivo de som:

| Som | Quando toca | Como é |
|---|---|---|
| **Pedido novo** | uma vez para cada pedido "novo" que chega depois da carga | bipe duplo curto e agudo (lá e ré, 0,2 s cada) |
| **Itens acrescentados** (2026-11-20) | uma vez para cada lote de itens que o cliente acrescenta a um pedido já no painel | "ding-dong" ascendente, mais grave e mais longo, com timbre de sino (dó e sol, 0,5 s cada) |

- **Quando não toca:** os pedidos e lotes que já estavam lá ao abrir, as mudanças de situação (inclusive cancelar e concluir), os eventos repetidos e os acréscimos recusados (troco, preço, situação).
- **Liberação pelo navegador:** o navegador só libera o som depois de um toque na página. Até lá, o painel mostra **🔔 Ativar som** em vez de **🔔 Som Ativo**, e a faixa do vendedor mostra o aviso de som bloqueado em qualquer página (2026-11-21).
- **Silenciar:** **🔕 Silenciar** desliga os dois sons. A escolha fica guardada no aparelho.

### Aviso de itens acrescentados pelo cliente (2026-11-20)

**Como o painel sabe que é um acréscimo de verdade:**
- cada lote em `orders.additions` tem um id único, gravado pelo servidor (`attempt_key`);
- só a função do banco `adicionar_itens_pedido` escreve nessa coluna, chamada pela função `pedido` depois de conferir a sessão do cliente. O vendedor só pode mudar `status`;
- por isso, um lote com id que o painel nunca viu, num pedido que ele já conhecia, é sempre um acréscimo confirmado do cliente. Não é preciso olhar quem fez o UPDATE nem mudar o banco.

**Quando não avisa:**
- **mudança de situação (inclusive cancelar e concluir):** não traz lote novo;
- **evento repetido do Realtime:** o lote já foi visto;
- **UPDATE sem a coluna `additions` (TOAST):** fica o que já se sabia;
- **acréscimo recusado:** nada é gravado, então não chega UPDATE.

**Sem aviso duplicado:** o painel guarda os ids dos lotes já vistos e avisa uma vez por lote, venha ele pelo Realtime, pela consulta de reserva (conexão caída) ou na linha que volta quando o vendedor muda a situação. A carga inicial (abrir ou recarregar o painel) só registra os lotes, sem aviso.

**Em qualquer página:**
- a escuta é a mesma do painel ao vivo: uma inscrição só, ligada enquanto o vendedor estiver no Modo Vendedor, em qualquer página;
- o balão "🔔 Novos itens adicionados ao pedido ADS-0003" fica na faixa do vendedor, que o cliente nunca vê;
- ao sair do Modo Vendedor, a inscrição, os lotes vistos, os destaques e os avisos são apagados.

**O que o vendedor vê:**
- **Balão no alto da tela:** some sozinho em 9 s. Tem "Ver pedido", que abre o painel no cartão, e ✕. Vários acréscimos empilham até 4 balões, sem apagar os anteriores.
- **Cartão destacado:** borda roxa e a faixa "➕ Novos itens adicionados" com **✓ Visto**. O destaque sai no "✓ Visto", quando o vendedor muda a situação do pedido, ou sozinho depois de 10 minutos.
- **O que não muda:** o contador vermelho de pedidos novos, a situação do pedido, o número de cartões e o código.

**Onde está no código:**
- `src/features/orders/orderAlert.ts`: os dois sons;
- `src/features/orders/ordersLive.ts`: a detecção, os destaques e os avisos;
- `src/features/orders/AddedItemsNotices.tsx`: os balões, na faixa do vendedor;
- `src/features/orders/OrderCard.tsx`: o cartão destacado;
- `src/features/orders/orderFocus.ts`: o "Ver pedido".

### Modo de demonstração local (sem o Supabase)

No servidor de desenvolvimento, sem a configuração pública do Supabase no `.env.local`, o painel funciona em **modo de demonstração local**:
- O pedido finalizado no carrinho fica guardado no `localStorage` do próprio navegador, com o código `DEMO-0001`, `DEMO-0002`... e a mesma estrutura da tabela `orders`. A mesma tentativa mandada duas vezes não é repetida.
- O cliente vai para o acompanhamento, marcado como demonstração, e pode acrescentar itens (veja "Pedido 100% no site").
- O painel mostra esses pedidos com a marca "Modo de demonstração local". Dá para filtrar, mudar a situação e cancelar, e tudo fica guardado no navegador.
- As outras abas do mesmo navegador recebem as mudanças na hora.

**Diferenças em relação ao Supabase:**
- os pedidos ficam só naquele navegador, sem sincronização com nada. Num site publicado sem Supabase, o vendedor não vê os pedidos feitos nos celulares dos clientes;
- a senha `vendedor2026` desse modo é conferida só no navegador e protege apenas os dados daquele navegador. No Supabase, o desbloqueio é o login de verdade (Supabase Auth), e o RLS protege os pedidos;
- ao ligar o Supabase, os pedidos de demonstração **não** são levados para lá, para não duplicar;
- com o Supabase configurado, uma falha de conexão nunca faz o site passar para o modo local: o cliente vê "Não foi possível confirmar o pedido agora" e "Tentar de novo".

**Tipos gerados:** o projeto não usa tipos gerados pelo Supabase. Os tipos da linha ficam em `OrderRow`, em `src/features/orders/orderRow.ts`.

## Pedido 100% no site, acompanhamento e adição de itens (2026-11-20)

O cliente finaliza, acompanha e complementa o pedido sem sair do site. O WhatsApp fica só como atalho opcional de dúvidas ("💬 Dúvidas? Falar no WhatsApp", que abre a conversa com a loja e o código do pedido, sem comanda).

### Como o cliente é reconhecido

- **Sessão anônima do Supabase Auth.** No primeiro "Finalizar pedido", o site cria uma sessão anônima (sem e-mail, sem senha, sem dados pessoais). Ela fica no `localStorage` do aparelho e é renovada sozinha.
- **O pedido fica ligado à sessão.** A função `pedido` confere o token da sessão no servidor de login do Supabase (`/auth/v1/user`) e grava o id dela em `orders.customer_user_id`.
- **O código não autoriza nada.** `ADS-0001` só escolhe qual pedido deste aparelho mostrar. Quem abre `/acompanhar/ADS-0001` em outro aparelho vê "Pedido não encontrado neste aparelho". Pela função, outra sessão recebe a recusa, sem dados.
- **O token nunca vai na URL nem para log.** Vai só no cabeçalho `Authorization`. O aparelho guarda, além da sessão, só o id, o código, a data, a situação e a modalidade de cada pedido. Nada de nome, telefone, endereço ou pagamento.
- **Sem a sessão** (login anônimo desligado no Supabase, ou uma falha ao criar): o pedido é gravado mesmo assim, sem `customer_user_id`. O cliente vê "Pedido recebido" com o aviso de que o acompanhamento ao vivo não ficou disponível.

### O que o `20261120200000_acompanhamento_cliente.sql` cria

- **Em `orders`:**
  - `customer_user_id` (a sessão do cliente; vazio nos pedidos antigos);
  - `updated_at` (atualizado sozinho a cada mudança);
  - `additions` (lista dos lotes acrescentados, cada um com os itens, o bloco da comanda, a hora e o valor).
- **`order_events`:** o histórico de cada pedido, com a hora real:
  - uma linha por situação nova e uma por lote de itens acrescentado;
  - gravado por um gatilho do banco, nunca pelo site;
  - os pedidos antigos ganham a linha "novo".
- **RLS de `order_events`:**
  - o cliente lê só os eventos da própria sessão (`customer_user_id = auth.uid()`);
  - o vendedor lê todos;
  - ninguém grava pelo site.
- **Realtime:** `order_events` entra na publicação `supabase_realtime`. O site do cliente se inscreve com o filtro `customer_user_id=eq.<sessão>` e o token da sessão. O Realtime aplica o RLS, então cada cliente só recebe os eventos dos próprios pedidos.
- **`adicionar_itens_pedido`:** a função do banco que acrescenta itens de uma vez só:
  - trava a linha do pedido, então o vendedor mudando a situação ou outro acréscimo espera;
  - confere o dono, a situação (só `novo` ou `preparando`), a repetição e o troco;
  - soma ao total sem cobrar a entrega de novo e registra o evento.

  Só a função `pedido` pode chamá-la (chave de servidor).
- **`antes_de_criar_usuario`:** o gancho "Before User Created" (passo 3.7). Ele só deixa criar a sessão anônima de acompanhamento. Cadastro com e-mail ou telefone é recusado.

O SQL não apaga nenhum pedido. Pode rodar de novo sem duplicar nada.

### O que a função `pedido` faz (operações)

| `op` | O que faz | Precisa da sessão |
|---|---|---|
| `criar` (ou nada: o site antigo) | confere preços, estoque, loja e dados; grava o pedido ligado à sessão | não (sem ela, grava sem acompanhamento) |
| `consultar` | a visão reduzida do próprio pedido: situação, histórico, itens, valores, modalidade, endereço só na entrega. Nunca nome, telefone ou GPS | sim |
| `meus` | os próprios pedidos dos últimos 30 dias | sim |
| `adicionar` | confere preços, estoque e loja pelo cardápio do banco; chama `adicionar_itens_pedido` | sim |

**Repetição sem duplicar (idempotência):**
- **Na finalização:** o site manda um `attemptId` sorteado para aquela tentativa. "Tentar de novo" depois de uma falha reaproveita o mesmo id, então se o pedido já tinha chegado, a função devolve o mesmo pedido. Depois de confirmado, o próximo pedido é outra tentativa.
- **No acréscimo:** o mesmo vale, com a chave guardada dentro do lote, em `additions`.
- **Sem confirmação falsa:** o site só mostra "✅ Pedido recebido com sucesso!" depois da resposta do servidor. Uma falha mostra "Não foi possível confirmar o pedido agora" e "Tentar de novo".

### Acompanhamento (`/acompanhar`)

- **`/acompanhar/ADS-0001`:**
  - a linha do tempo: recebido, preparando, o "pronto" da modalidade, concluído; ou cancelado;
  - o horário real de cada etapa;
  - o resumo com os itens acrescentados;
  - "➕ Adicionar mais itens a este pedido" (só em Novo ou Preparando);
  - "💬 Dúvidas? Falar no WhatsApp".
- **`/acompanhar`:** os pedidos deste aparelho nos últimos 30 dias.
- **Nas outras páginas:** enquanto houver pedido em andamento, a faixa "📦 Acompanhar pedido #ADS-0001 · Preparando" aparece logo abaixo do cabeçalho.
- **Ao vivo:** pelo Realtime; o estado oficial vem sempre da função. Sem a conexão ao vivo, a tela confere sozinha a cada 20 segundos, ao reconectar e ao voltar para a aba.

### Adicionar itens

1. Em "➕ Adicionar mais itens a este pedido", o site entra no modo de adição. A faixa "➕ Adicionando itens ao pedido #ADS-0001" fica no topo (sobrevive a recarregar) e tem "Cancelar adição".
2. O carrinho mostra o pedido atual, os novos itens, o novo total (sem frete de novo) e, no dinheiro, o troco. O site confere se o troco cobre o novo total.
3. "Confirmar adição ao pedido" acrescenta ao MESMO pedido, com o mesmo código.
4. No painel do vendedor, o mesmo cartão ganha "➕ Novos itens adicionados pelo cliente", com a hora, os itens e o valor. Não vira cartão novo e não aumenta o contador. O vendedor ouve o "ding-dong" de itens acrescentados (não o bipe de pedido novo), vê o cartão destacado e o balão do aviso, em qualquer página (veja "Aviso de itens acrescentados pelo cliente").
5. Se a loja terminar de preparar enquanto o cliente escolhe, a tela bloqueia na hora. O banco também recusa, e o cliente pode fazer um pedido novo com os mesmos itens.

### Modo de demonstração (sem o Supabase)

O mesmo caminho, no `localStorage` do navegador:
- finalizar leva ao acompanhamento do `DEMO-0001`, com o aviso de demonstração;
- as mudanças feitas no painel deste navegador chegam na hora (outras abas também);
- dá para acrescentar itens com as mesmas regras.

A loja não recebe nada desse modo.

## Pacote 1: compra rápida e fila de produção (2026-11-21)

Nenhuma mudança no banco: sem SQL, sem coluna nova e sem mudança de RLS.

### Para o cliente

- **Frete a combinar pede telefone.** Quando a entrega fica "a combinar", o telefone passa a ser obrigatório. Isso acontece no modo "A combinar com o cliente", com a lista de bairros vazia e em "Outro bairro". O campo mostra: "Para entregas com frete a combinar, informe seu telefone. A loja entrará em contato para confirmar o valor da entrega."
  - O site confere antes de finalizar.
  - A função `pedido` também confere, desde que a versão nova seja colada (veja abaixo).
  - Em Retirar, Comer no Local e entrega com taxa conhecida, o telefone continua opcional.
- **Lembrar meus dados neste dispositivo.** É uma opção no carrinho, desmarcada até o cliente marcar.
  - **O que guarda:** nome, telefone e endereço (rua, número, bairro e referência), no `localStorage` (`acai_doce_sabor_meus_dados_v1`). Nunca guarda a modalidade, o GPS, o pagamento ou a sessão de acompanhamento.
  - **Na visita seguinte:** os campos já vêm preenchidos e podem ser mudados. O que foi digitado na aba vale mais que os dados guardados.
  - **Desmarcar:** apaga os dados.
- **Pix no acompanhamento.** O mesmo cartão do carrinho (mesma chave, botão de copiar) aparece em `/acompanhar/ADS-…` quando o pagamento é Pix e o pedido não foi cancelado.
  - Mostra o total do pedido gravado.
  - Com itens acrescentados, mostra o valor de antes, o valor dos acréscimos e a diferença: "Já fez o Pix de R$ 3,00? Faça outro Pix só dos itens acrescentados: R$ 2,00".
  - **Limite:** o sistema não registra pagamento recebido. Por isso o cartão nunca diz que algo já foi pago.
- **Previsão de entrega.** A linha do tempo mostra o "Tempo" de entrega da loja (o mesmo do topo do site), contado a partir do pedido, por exemplo "até por volta das 16:19".
  - Só aparece em entregas: a loja não configura tempo de retirada nem de consumo no local.
  - Some quando o pedido termina.
- **"Meus pedidos" no rodapé**, em todas as páginas. Ele abre `/acompanhar`, que lista só os pedidos da sessão deste aparelho.
- **Textos:** os que ainda falavam do pedido pelo WhatsApp foram atualizados (troco, "Entrega / Frete", "Horários e Contato"). O WhatsApp continua como atendimento.

### Para o vendedor (painel `/pedidos`)

- **Fila de produção:** o painel abre em "⏳ Em andamento" (tudo menos concluído e cancelado). Os pedidos aparecem do mais antigo para o mais novo, pela hora do pedido. Os outros filtros continuam iguais.
- **Há quanto tempo:** cada pedido em andamento mostra "Há 12 min". O tempo atualiza sozinho a cada 30 s, sem consultar o banco.
- **Atraso:** uma entrega que passa do maior valor do "Tempo" de entrega da loja (45 min em "30–45 min") fica em vermelho, com "⚠️ … · atrasado". Retirar e Comer no Local mostram o tempo, mas não ficam atrasados, porque a loja não configura um tempo para eles. Se o "Tempo" não puder ser lido em minutos, nenhum alerta aparece.
- **"✅ Concluir" com confirmação:** o cartão pergunta "Deseja realmente concluir este pedido?", com "Cancelar" e "Confirmar".
- **"↩ Voltar etapa":** volta para a etapa imediatamente anterior do fluxo da modalidade:
  - Preparando → Novo;
  - o "pronto" da modalidade → Preparando;
  - Concluído → o "pronto" da modalidade.

  Cancelado nunca volta. Depois de concluir ou cancelar, o cartão fica 8 s na lista com o aviso e o "↩ Voltar etapa", até o vendedor trocar de filtro.
- **Busca:** "Buscar pedido por código ou nome do cliente...", na lista que já está na tela (sem consultar o banco). Aceita código inteiro ou parte dele, e nome inteiro ou parte dele, sem diferenciar acento nem maiúsculas. Funciona junto com o filtro.
- **Tela acesa:** enquanto o painel está aberto e visível, a tela do aparelho não apaga (Screen Wake Lock). Ao sair do painel, ela volta ao normal. Sem suporte no navegador, nada acontece.
- **Som bloqueado:** se o navegador ainda não liberou o som, a faixa do vendedor mostra um aviso com "🔔 Ativar som", em qualquer página. Se o vendedor silenciou de propósito, o aviso não aparece.
- **Ofertas:** as ofertas flutuantes não aparecem com o Modo Vendedor ligado e voltam ao sair.

### Função `pedido`

A única mudança na função é o telefone obrigatório no frete a combinar. Para essa regra valer também no servidor, rode `npm run build:pedido` e cole de novo `supabase/functions/pedido/index.ts`. Sem colar, o site já exige o telefone, mas um aparelho com o site antigo ainda passaria sem ele.

## Cardápio dinâmico: o cardápio inteiro no banco (2026-11-21)

Desde 2026-11-21, o cardápio inteiro mora no Supabase e o vendedor muda tudo pelo **painel do vendedor** (`/vendedor`). O cardápio que estava no código virou só a semente do banco e o cardápio do modo de demonstração.

### 1. O que mudou

- **Para o cliente:** a loja lê o cardápio do banco. Enquanto carrega, aparece "Carregando o cardápio…". Se o Supabase não responder, aparece "Cardápio indisponível agora" com **Tentar de novo**, e nunca o cardápio antigo do código (que poderia ter preços velhos).
- **Para o vendedor:**
  - o painel tem as abas **Pedidos**, **Catálogo**, **Categorias**, **Produtos**, **Complementos**, **Ofertas** e **Configurações da loja**;
  - na própria loja, "Editar", "+ Adicionar", "Duplicar", "Renomear" e "Disponível / Esgotado" abrem os mesmos editores e gravam no banco;
  - "Entrega / Frete" e "Horários e Contato", na faixa do vendedor, levam às Configurações da loja.
- **Para a função `pedido`:** ela lê o cardápio do banco a cada pedido e confere tudo (veja o item 19).

### 2. Ordem para ligar

1. Rode o `20261121120000_catalogo_dinamico.sql` (passo 2.8).
2. Rode `npm run build:pedido` e cole de novo a função `pedido` (passo 6).
3. Publique o site novo.

Fora dessa ordem:
- **Função nova sem o SQL:** todo pedido responde "Não foi possível confirmar o pedido agora" (a função não acha o `catalogo_publico`). Nada é gravado.
- **Site novo sem o SQL:** a loja mostra "Cardápio indisponível agora".
- **Site novo com a função antiga:** o que o vendedor muda no painel (preço, esgotado, oferta) não vale no servidor. O carrinho pode mostrar sempre "Os preços mudaram". Cole a função nova.

### 3. Tabelas

| Tabela | O que guarda |
|---|---|
| `catalog_categories` | Categorias: a vitrine "Monte do seu jeito" (`layout = 'vitrine'`, só uma) e as seções em grade. |
| `catalog_products` | Produtos, com o tipo (`kind`), preço, preço antigo, selo, foto, palavras de busca, Completo, visível, disponível e arquivado. |
| `catalog_variants` | Tamanhos de cada produto: preço, adicionais grátis, recipiente e disponível. |
| `catalog_choices` e `catalog_choice_options` | Escolhas obrigatórias ("Sabor", "Sabor da cobertura") e as opções de cada uma. |
| `catalog_groups` | Grupos de complementos e as regras (veja o item 15). |
| `catalog_options` | Complementos (granola, kiwi, cremes...). Um complemento pode ser só de um produto (`product_id`). |
| `catalog_product_groups` | Os grupos que cada produto montável aceita, a ordem e o máximo só daquele produto (a barca: 2 frutas). |
| `catalog_offers` | Ofertas do aviso flutuante, com preço promocional opcional. |
| `catalog_meta` | A revisão do cardápio (sobe a cada mudança) e quando a semente rodou. |
| `catalog_import_log` | O que foi convertido das mudanças antigas (`catalog_changes`). |

### 4. Ids e ordem

- Os ids são estáveis e só têm letras minúsculas, números e hífen (`acai-oca`, `copo-500-ml`).
- O produto novo ganha o id pelo nome (`Açaí Zero` → `acai-zero`). Os ids da semente são os mesmos do código, então carrinhos e pedidos antigos continuam valendo.
- A ordem é a coluna `position`: "↑ Subir" e "↓ Descer" no painel. No empate, vale o id.

### 5. Regras do banco

- Preços em centavos inteiros, de 0 a R$ 10.000,00. Nome obrigatório (até 120 letras).
- Dois tamanhos ou duas opções com o mesmo nome no mesmo produto são recusados.
- Na vitrine só entram produtos montáveis.
- "Completo" e "sabores tirados de um grupo" são só de produto montável.
- Produto montável precisa de pelo menos um tamanho.
- Nada apaga em cascata. Apagar uma categoria com produtos, ou um grupo em uso, é recusado.
- Arquivar uma categoria com produtos é recusado com "A categoria ainda tem produtos. Mova ou arquive os produtos antes."
- Tirar um tamanho que está numa oferta é recusado.
- Foto: só caminho do site (`images/...`) ou endereço `https://`, nunca SVG.

### 6. Quem lê e quem grava (RLS)

- **Visitante e cliente:** leem só o público:
  - categorias visíveis e não arquivadas;
  - produtos visíveis, não arquivados e de categoria visível;
  - os tamanhos, escolhas e grupos desses produtos;
  - os complementos não arquivados;
  - as ofertas ativas que ainda não acabaram.
- **Vendedor (`is_seller()`):** lê tudo (também o oculto e o arquivado) e grava.
- **Função `pedido` (chave de servidor):** lê tudo e confere item a item (item 19).
- `catalog_import_log`: só o vendedor lê.

### 7. Permissões (GRANT)

O projeto não dá permissão sozinho (aviso de 2026-11-20), então o SQL dá:
- `select` para `anon` e `authenticated` (o RLS filtra);
- `insert`, `update` e `delete` para `authenticated` (o RLS só deixa o vendedor);
- tudo para `service_role`.

### 8. Funções do banco

- **`catalogo_publico()`:** o cardápio inteiro num JSON, na ordem. Respeita o RLS de quem chama. O site chama com a chave pública (ou com o token do vendedor); a função `pedido`, com a chave de servidor.
- **`catalogo_salvar_produto(produto)`:** grava o produto inteiro numa transação só: o produto, os tamanhos, as escolhas com as opções e os grupos. Se alguma parte falha, nada fica gravado pela metade. Só o vendedor consegue.
- **`catalogo_ordenar(lista, ids)`:** a ordem de categorias, produtos, grupos, complementos ou ofertas. Só o vendedor consegue.

### 9. Revisão e tempo real

- Cada mudança no cardápio ou nas Configurações da loja sobe a revisão em `catalog_meta`.
- O site ouve `catalog_meta` pelo Realtime e lê o cardápio de novo. Vários avisos seguidos viram uma leitura só (espera de 0,4 s), e nunca há duas leituras ao mesmo tempo.
- Sem o Realtime, o site confere a cada minuto e ao voltar para a aba.
- `catalog_meta` precisa estar em **Database > Publications > supabase_realtime** (o SQL acrescenta).

### 10. Fotos (Storage)

- Bucket `catalogo`, público para leitura.
- Só JPEG, PNG e WebP, até 2 MB, na pasta `fotos/`, com nomes únicos (hora e sorteio). SVG é recusado no site e no banco.
- Só o vendedor envia, troca ou apaga.
- O painel reduz a foto no aparelho (até 800 px, WebP) antes de enviar e mostra "Preparando a foto…" e "Enviando a foto…".

### 11. Semente

- O SQL traz o cardápio do código (6 categorias, 48 produtos, 26 tamanhos, 25 escolhas, 144 opções, 5 grupos, 32 complementos e 12 ofertas).
- Ela roda **uma vez só** (marca `catalog_meta.seeded_at`) e usa `on conflict do nothing`. Rodar o SQL de novo nunca traz de volta o que o vendedor apagou nem sobrescreve o que ele mudou.
- Quem mexer no cardápio do código e quiser a semente nova: `node scripts/catalogo/gerar-semente.ts`. O teste `seedSql.test.ts` avisa quando a migração ficou diferente do código.
- A semente nova só vale para um banco novo: num banco já semeado, ela não roda.

### 12. Mudanças antigas (`catalog_changes`)

- O SQL converte uma vez as mudanças antigas de itens, produtos, complementos e seções. Os campos convertidos são:
  - nome, descrição, preço e preço riscado;
  - foto e disponível;
  - excluído (vira arquivado);
  - seção e preço de cada tamanho.
- O que não dá para converter fica **pendente** em `catalog_import_log`, com a mudança inteira, para o vendedor refazer no painel:
  - listas de tamanhos, sabores e escolhas trocadas por inteiro;
  - itens novos;
  - dados ilegíveis.
- `catalog_changes` **não é apagada**.
- No projeto real, `catalog_changes` tinha 0 linhas de cardápio em 2026-11-21, então não há nada a converter.

### 13. Configurações da loja

Continuam em `catalog_changes` (tipo `settings`, id `loja`) e agora têm também:
- **identidade:** nome, subtítulo, slogan, telefone e Instagram. O nome aparece no cabeçalho, no rodapé e na comanda;
- **Pix:** ligado, tipo (CPF, CNPJ, e-mail, celular ou chave aleatória), chave e titular. Uma chave fora do formato do tipo é recusada;
- **formas de pagamento:** Pix, Dinheiro e Cartão, com pelo menos uma ligada;
- **bairros** com liga/desliga (o desligado sai da lista do cliente, sem perder a taxa), além de grátis, a combinar e "Outro bairro";
- **horário por dia da semana**, com até 3 períodos por dia (almoço e noite), ou o mesmo horário todos os dias;
- **fechamento temporário:** "Fechar agora (até a próxima abertura)", "Abrir agora" e "Voltar ao horário".

### 14. Tipos de produto

- **Produto montável:** o personalizador, com tamanhos, sabor (lista própria ou os complementos grátis de um grupo, como as coberturas da barca), grupos de complementos e o Completo. Na vitrine, vira um cartão de "Monte do seu jeito"; numa seção, um item com "Montar".
- **Produto com sabores ou variações:** o cliente escolhe tamanho (com o preço de cada um) e/ou opções. A escolha pode aceitar "Outro sabor".
- **Produto direto:** vai direto para o carrinho.
- **"Duplicar produto":** cria outro id com tudo copiado. A cópia nasce **oculta**, para o vendedor revisar antes de mostrar.

### 15. Grupos de complementos e o preço

Cada grupo tem:
- a regra:
  - `limited`: conta no limite grátis do tamanho;
  - `included`: um de cada;
  - `paid`: cobrado por unidade, até 10 de cada;
- o mínimo (maior que zero: escolha obrigatória);
- o máximo (o produto pode ter um máximo próprio);
- as unidades grátis e o preço de cada unidade a mais;
- se entra no Completo;
- disponível (desligado: todos os complementos do grupo ficam esgotados).

O preço de um produto montado, no site e no servidor (a mesma conta):

> preço do tamanho + Σ (preço do complemento × quantidade) + Σ por grupo (unidades além das grátis × preço extra)

Tudo em centavos inteiros. O preço que o cliente manda nunca vale: o servidor refaz a conta.

### 16. Completo

O botão "Completo" marca 1 de cada complemento sem custo dos grupos marcados "Entra no Completo" (na semente: adicionais e frutas). Ficam de fora:
- os esgotados;
- os complementos com preço;
- os complementos marcados "Fica fora do Completo" (na semente, o leite condensado).

### 17. Ofertas

- **Situação:** ativa, pausada ou arquivada, mais as datas de início e de fim. No painel, uma oferta ativa fora das datas aparece como "Agendada" ou "Encerrada".
- **Aviso flutuante:** só as ofertas ativas, dentro das datas, de produtos visíveis e disponíveis.
- **Preço promocional (opcional):** troca o preço do produto todo ou só de um tamanho, em todo o site, no carrinho e no servidor. O preço de antes aparece riscado. Um "preço promocional" maior que o normal não vale.
- **Ordem que decide:** se duas ofertas mudam o preço do mesmo produto, vale a de cima no painel (no empate, o menor id).
- **Hora usada:** o servidor confere as datas com a hora dele. O cliente não consegue usar uma oferta encerrada.
- **Frase:** `{preco}` e `{preco_antigo}` viram os preços na hora.

### 18. Painel do vendedor (`/vendedor`)

- Só com o Modo Vendedor ligado. Sem ele, a página pede a senha.
- **Catálogo:** o resumo e os atalhos.
- **Categorias:** nome, subtítulo, ícone, visível, ordem e arquivar.
- **Produtos:** busca, filtro por categoria e situação, ordem, "Marcar esgotado", "Ocultar", "Duplicar produto" e o editor completo.
- **Complementos:** os grupos com as regras e "Usado em: ...", e os complementos de cada grupo.
- **Ofertas:** a lista com a situação, "Pausar"/"Ativar", ordem e o editor com a prévia.
- **Configurações da loja:** o item 13.
- Ao salvar: "Salvar alterações", "Há alterações não salvas.", "Alterações salvas com sucesso" e "Não foi possível salvar. Tente novamente." (ou o motivo do banco, em português).

### 19. O que a função `pedido` confere

A cada pedido e a cada acréscimo, a função lê, em paralelo, as configurações (`catalog_changes`) e o cardápio (`catalogo_publico()`). São duas consultas por pedido, nunca uma por item. Depois ela confere:
- **o item:** existe, está visível, a categoria está visível e não está arquivado. Senão: "item-indisponivel";
- **o tamanho, o sabor, as opções e os complementos:** pertencem ao produto e estão disponíveis (também o grupo). Senão: "esgotado", com o nome;
- **o mínimo, o máximo e um de cada:** escolha que não vale mais como foi enviada (ex.: o vendedor baixou o máximo de frutas) é recusada com o nome do item, em vez de ser cortada em silêncio;
- **os preços:** do banco, com as ofertas pela hora do servidor. Total diferente: "total-mudou", com o total certo e o preço de cada item (`items`), e o carrinho lê o cardápio de novo;
- **a forma de pagamento:** desligada nas Configurações é recusada, mesmo que o cliente mande;
- **o bairro:** desligado é recusado;
- **a loja fechada** com "não aceitar pedidos": recusada.

Se o cardápio não carrega ou vem fora do formato, a função responde erro (500) e nada é gravado. Ela nunca usa um cardápio velho.

**Cópias:**
- o pedido grava os itens com o nome e o preço do momento (`orders.items` e a comanda). Mudar o cardápio depois não muda pedidos antigos;
- no acréscimo, só os itens novos usam o preço de agora;
- a gravação do pedido é um `insert` só (com a chave de repetição), e o acréscimo usa a função SQL `adicionar_itens_pedido`, numa transação.

### 20. Modo de demonstração e backup

- **Sem o Supabase:** o cardápio fica no aparelho (`acai_doce_sabor_catalogo_v2`), começando pela semente, com as mesmas regras do banco. As fotos ficam no aparelho.
- **Backup v2** ("Backup / Restaurar"): leva as configurações, o cardápio e as fotos que ele usa.
- **Restaurar:** no aparelho, volta o cardápio. No Supabase, volta só as configurações (o cardápio do banco se muda pelo painel).

### 21. Testes e conferências

- `npm test`, com o principal:
  - a ida e volta exata do cardápio;
  - a semente igual à migração;
  - as regras de grupo;
  - as ofertas;
  - a gravação local e no Supabase;
  - as Configurações da loja;
  - o horário por dia;
  - a função `pedido` com cardápios criados pelo vendedor;
  - o arquivo da função em dia (`tests/pedidoBundle.test.ts`).
- `npm run check:catalogo-vendedor`: o painel inteiro no navegador.
- `check:vendedor`, `check:operacao`, `check:pedido`, `check:pedido-funcao` e as outras.
- O teste da migração (Postgres na memória, PGlite) roda todas as migrações e confere a semente, o RLS, as restrições, as funções, a revisão, o Realtime, as fotos e a conversão.

## 7. Conferir

1. Abra o cardápio, clique em **Senha para vendedor** e entre com a senha do passo 3.3.
2. A faixa do topo deve dizer "Salvo na nuvem: vale para todos os clientes".
3. Abra o **🗂️ Cardápio** (painel `/vendedor`), mude o preço de um produto e toque em **Salvar alterações**. Abra o site em outro aparelho: o preço novo aparece. Em quem já está com a página aberta, aparece em segundos (Realtime), ou em até 1 minuto, ou ao voltar para a aba.
4. Toque em **Loja Aberta** para fechar a loja: no outro aparelho, o topo passa a mostrar "Loja fechada no momento". Toque de novo para abrir.
5. Faça um pedido de teste no site e toque em **Finalizar pedido**:
   - o site vai para "Acompanhar pedido", com "✅ Pedido recebido com sucesso!" e o código ADS-0001;
   - nenhum WhatsApp abre;
   - em **Table Editor > orders**, a coluna `customer_user_id` vem preenchida (sem ela, confira os passos 3.6 e 3.7).
6. Os pedidos ficam em **Table Editor > orders**, com o nome, a modalidade (`fulfillment`), o endereço, o GPS (quando anexado), os itens, o total, a comanda e a situação ("novo").
   Para conferir as modalidades, faça um pedido "Comer no Local" e veja `local` na coluna `fulfillment`. Depois, faça uma entrega tocando em "📍 Usar minha localização atual" e veja `customer_lat`, `customer_lng` e `maps_url` preenchidos.
   O GPS só funciona com o site em **https** (ou em `localhost` no computador). Pelo endereço da rede (`http://10.0.0.x:5173`), o navegador do celular bloqueia a localização, e o site mostra a mensagem para preencher o endereço à mão.
7. **Painel ao vivo:** no computador do balcão, entre no Modo Vendedor, abra **📋 Pedidos** e toque em **🔔 Ativar som**. O topo deve dizer "🟢 Ao vivo". Faça um pedido pelo celular: ele aparece no painel em segundos, com o bipe e o selo vermelho na faixa, sem recarregar. Toque em **Aceitar / Preparar** e confira a coluna `status` em **Table Editor > orders**.
   - No celular, a tela do pedido muda sozinha para "🍨 Preparando seu pedido", com o horário.
   - Em **Table Editor > order_events** aparece uma linha por etapa.
   - No celular, toque em **➕ Adicionar mais itens a este pedido**, escolha um item e toque em **Confirmar adição ao pedido**. No painel, o mesmo cartão mostra "➕ Novos itens adicionados pelo cliente" e fica destacado, com o "ding-dong" (diferente do bipe de pedido novo) e o balão "🔔 Novos itens adicionados ao pedido ...".
8. Para apagar o pedido de teste, marque a linha em **Table Editor > orders** e apague. O próximo código continua a numeração (ADS-0002).

## Se algo der errado

- **Senha certa não entra:** confira se o e-mail do `.env.local` é igual ao da conta e se a linha do passo 3.5 foi rodada.
- **Supabase fora do ar ou chave errada:** a loja mostra "Cardápio indisponível agora" com **Tentar de novo** (desde 2026-11-21 ela não usa o cardápio do código no lugar). Quem já estava com a página aberta continua com o último cardápio lido até a próxima leitura.
- **"Cardápio indisponível agora" logo depois de publicar o site novo:** falta rodar o `20261121120000_catalogo_dinamico.sql` (passo 2.8).
- **O vendedor salva e aparece "Sua sessão de vendedor acabou":** saia e entre de novo no Modo Vendedor.
- **"A categoria ainda tem produtos" ao arquivar:** mova os produtos para outra categoria ou arquive-os antes.
- **Mudanças antigas que não apareceram no painel:** veja `catalog_import_log` (linhas "pendente") e refaça no painel.
- **No carrinho aparece "Não foi possível confirmar o pedido agora":**
  - confira se a função se chama `pedido`;
  - confira se a verificação de JWT dela está desligada (passo 6.5);
  - confira se o arquivo `20261117120000_pedidos.sql` foi rodado (passo 2.3).

  O cliente toca em **Tentar de novo** (o mesmo pedido nunca é gravado duas vezes) ou fala com a loja pelo WhatsApp do rodapé.
- **"O acompanhamento ao vivo não ficou disponível para este pedido":** o login anônimo está desligado ou o gancho está recusando. Confira os passos 3.6 e 3.7 e se o `20261120200000_acompanhamento_cliente.sql` foi rodado (passo 2.7).
- **O painel do vendedor mostra "column orders.additions does not exist":** falta rodar o `20261120200000_acompanhamento_cliente.sql` (passo 2.7).
- **A tela do cliente não muda sozinha ("Sem conexão ao vivo"):** confira se `order_events` aparece em **Database > Publications > supabase_realtime**. Enquanto isso, a tela confere a cada 20 segundos.
- **"Comer no Local" recusado com "Confira seus dados", ou "Não foi possível confirmar" só depois de 2026-11-20:** falta um passo de "Já tinha tudo funcionando antes de 2026-11-20?" (passo 2): o SQL das modalidades ou a função nova.
- **No carrinho aparece sempre "Os preços mudaram":** a função colada está mais antiga que o site (ainda sem o cardápio do banco). Faça os passos de "Quando as regras do código mudarem" (passo 6).
- **Mudanças feitas antes do Supabase, guardadas no aparelho:** no modo vendedor desse aparelho, use **Backup / Restaurar > Baixar backup**. Depois de ligar o Supabase, use **Restaurar backup** com o mesmo arquivo. As fotos também sobem.
