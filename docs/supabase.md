# Ligar o modo vendedor e os pedidos ao Supabase

Com o Supabase ligado:
- o que o vendedor muda no site chega a todos os clientes:
  - preço, foto, esgotado, produto ou complemento novo, sabores;
  - loja aberta ou fechada, tempo de entrega, entrega e frete, horários e contato;
- o cliente finaliza o pedido no próprio site, sem WhatsApp (desde 2026-11-20). A função `pedido` confere e grava cada pedido com o código ADS-0001, ADS-0002...;
- o cliente acompanha cada etapa ao vivo e pode acrescentar itens ao mesmo pedido enquanto ele está em Novo ou Preparando.

Sem ele, o site funciona em modo de demonstração: as mudanças e os pedidos ficam só no navegador em que foram feitos, e a loja não recebe os pedidos.

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

Fora dessa ordem:
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
VITE_SELLER_EMAIL=vendedor@acaidocesabor.app
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

**Quando o cardápio do código mudar** (um produto, um preço ou um tamanho mudados direto no código), a função precisa da versão nova:
1. rode `npm run build:pedido`;
2. abra a função `pedido` no painel e cole de novo o arquivo `supabase/functions/pedido/index.ts`;
3. clique em **Deploy updates**.

O que o vendedor muda pelo modo vendedor não precisa disso: a função lê o banco a cada pedido.

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

- **Quando toca:** um bipe curto de duas notas, feito pela Web Audio do navegador, sem arquivo de som. Toca uma vez para cada pedido "novo" que chega depois da carga.
- **Quando não toca:** os pedidos que já estavam lá ao abrir, as mudanças de situação e os eventos repetidos.
- **Liberação pelo navegador:** o navegador só libera o som depois de um toque na página. Até lá, o painel mostra **🔔 Ativar som** em vez de **🔔 Som Ativo**.
- **Silenciar:** **🔕 Silenciar** desliga o bipe. A escolha fica guardada no aparelho.

### Modo de demonstração local (sem o Supabase)

Sem as três variáveis do Supabase no `.env.local`, o painel funciona em **modo de demonstração local**:
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
4. No painel do vendedor, o mesmo cartão ganha "➕ Novos itens adicionados pelo cliente", com a hora, os itens e o valor. Não vira cartão novo, não aumenta o contador e não toca o bipe.
5. Se a loja terminar de preparar enquanto o cliente escolhe, a tela bloqueia na hora. O banco também recusa, e o cliente pode fazer um pedido novo com os mesmos itens.

### Modo de demonstração (sem o Supabase)

O mesmo caminho, no `localStorage` do navegador:
- finalizar leva ao acompanhamento do `DEMO-0001`, com o aviso de demonstração;
- as mudanças feitas no painel deste navegador chegam na hora (outras abas também);
- dá para acrescentar itens com as mesmas regras.

A loja não recebe nada desse modo.

## 7. Conferir

1. Abra o cardápio, clique em **Senha para vendedor** e entre com a senha do passo 3.3.
2. A faixa do topo deve dizer "Salvo na nuvem: vale para todos os clientes".
3. Mude o preço de um item e abra o site em outro aparelho: o preço novo aparece. Em quem já está com a página aberta, aparece em até 1 minuto ou ao voltar para a aba.
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
   - No celular, toque em **➕ Adicionar mais itens a este pedido**, escolha um item e toque em **Confirmar adição ao pedido**. No painel, o mesmo cartão mostra "➕ Novos itens adicionados pelo cliente", sem bipe.
8. Para apagar o pedido de teste, marque a linha em **Table Editor > orders** e apague. O próximo código continua a numeração (ADS-0002).

## Se algo der errado

- **Senha certa não entra:** confira se o e-mail do `.env.local` é igual ao da conta e se a linha do passo 3.5 foi rodada.
- **Supabase fora do ar ou chave errada:** o site continua funcionando com o último cardápio que ele conseguiu ler.
- **No carrinho aparece "Não foi possível confirmar o pedido agora":**
  - confira se a função se chama `pedido`;
  - confira se a verificação de JWT dela está desligada (passo 6.5);
  - confira se o arquivo `20261117120000_pedidos.sql` foi rodado (passo 2.3).

  O cliente toca em **Tentar de novo** (o mesmo pedido nunca é gravado duas vezes) ou fala com a loja pelo WhatsApp do rodapé.
- **"O acompanhamento ao vivo não ficou disponível para este pedido":** o login anônimo está desligado ou o gancho está recusando. Confira os passos 3.6 e 3.7 e se o `20261120200000_acompanhamento_cliente.sql` foi rodado (passo 2.7).
- **O painel do vendedor mostra "column orders.additions does not exist":** falta rodar o `20261120200000_acompanhamento_cliente.sql` (passo 2.7).
- **A tela do cliente não muda sozinha ("Sem conexão ao vivo"):** confira se `order_events` aparece em **Database > Publications > supabase_realtime**. Enquanto isso, a tela confere a cada 20 segundos.
- **"Comer no Local" recusado com "Confira seus dados", ou "Não foi possível confirmar" só depois de 2026-11-20:** falta um passo de "Já tinha tudo funcionando antes de 2026-11-20?" (passo 2): o SQL das modalidades ou a função nova.
- **No carrinho aparece sempre "Os preços mudaram":** a função colada está com um cardápio mais antigo que o site. Faça os passos de "Quando o cardápio do código mudar" (passo 6).
- **Mudanças feitas antes do Supabase, guardadas no aparelho:** no modo vendedor desse aparelho, use **Backup / Restaurar > Baixar backup**. Depois de ligar o Supabase, use **Restaurar backup** com o mesmo arquivo. As fotos também sobem.
