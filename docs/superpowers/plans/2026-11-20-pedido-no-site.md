# Pedido 100% no site — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente finaliza no site, acompanha o pedido ao vivo e acrescenta itens ao mesmo pedido; o WhatsApp vira só atendimento.

**Architecture:** O cliente tem uma sessão anônima do Supabase Auth. A função `pedido` tem as operações `criar`, `consultar`, `meus` e `adicionar`, conferindo o token. O SQL ganha:
- `customer_user_id`, `updated_at` e `additions` em `orders`;
- `order_events`, com gatilho, RLS e Realtime;
- `adicionar_itens_pedido`, numa transação com trava;
- o gancho que só aceita cadastro anônimo.

O site ganha as telas `/acompanhar`, o modo de adição e a finalização sem WhatsApp. O painel do vendedor mostra os lotes acrescentados. O modo de demonstração segue o mesmo caminho no `localStorage`.

**Tech Stack:** React 19, TypeScript, Tailwind 4, `@supabase/realtime-js` 2.119.0 (já instalado), Vitest, PGlite (no rascunho), Edge sem janela com o Supabase de mentira.

**Spec:** `docs/superpowers/specs/2026-11-20-pedido-no-site-design.md`

## Global Constraints

- Textos fixos:
  - "✅ Pedido recebido com sucesso!", "Acompanhar pedido", "Acompanhe cada etapa da preparação do seu pedido.";
  - etapas: "✅ Pedido recebido — Aguardando confirmação", "🍨 Preparando seu pedido", "🛵 Seu pedido saiu para entrega", "🛍️ Seu pedido está pronto para retirada", "🍨 Seu pedido está pronto para consumo", "✅ Pedido concluído", "❌ Pedido cancelado";
  - "📦 Acompanhar pedido", "➕ Adicionar mais itens a este pedido", "➕ Adicionando itens ao pedido #ADS-0001";
  - "Escolha os produtos que deseja acrescentar ao seu pedido.", "Confirmar adição ao pedido", "Cancelar adição";
  - "💬 Dúvidas? Falar no WhatsApp", "➕ Novos itens adicionados pelo cliente".
- Nenhum WhatsApp aberto sem toque do cliente. Nenhuma confirmação sem a resposta do servidor. O carrinho só é esvaziado depois da confirmação.
- Nenhum token na URL nem em log. Nenhuma chave de servidor no site. Nenhuma permissão nova para visitantes.
- Acréscimo só em `novo` e `preparando`, conferido no banco. Sem frete de novo. A modalidade não muda.

## Tarefas

### Task 1: Banco
- [x] `supabase/migrations/20261120200000_acompanhamento_cliente.sql`:
  - colunas em `orders`;
  - `order_events` com RLS, permissões e Realtime;
  - gatilhos;
  - `adicionar_itens_pedido`;
  - `antes_de_criar_usuario`.
- [x] PGlite:
  - roda duas vezes;
  - pedidos antigos iguais;
  - RLS cliente A × B × vendedor;
  - eventos dos gatilhos;
  - acréscimo (dono, situação, repetição, troco, totais);
  - gancho.

### Task 2: Função `pedido`
- [x] `orderServer.ts`: as operações; chave de tentativa vinda do site; dono; visão reduzida; acréscimo com o cardápio do servidor.
- [x] `orderStore.ts`: pedido por id, eventos, pedidos do dono, a chamada da função SQL e a conferência do token.
- [x] `orderHttp.ts`: repassar o `Authorization`.
- [x] Testes de cada operação e de cada recusa.
- [x] `npm run build:pedido`.

### Task 3: Sessão e pedidos do aparelho
- [x] `src/services/customerSession.ts` (anônima: criar, renovar, guardar).
- [x] `src/features/tracking/trackedOrders.ts` (lista no aparelho, 30 dias, sem dado pessoal).
- [x] `trackingApi.ts` (operações; o nome final) e `timeline.ts` (etapas por modalidade), mais `customerLive.ts` (escuta ao vivo).
- [x] Testes.

### Task 4: Telas
- [x] Finalização sem WhatsApp (`CheckoutPanel.tsx`, `orderService.ts`).
- [x] `/acompanhar` (`TrackOrderPage.tsx`) com a escuta ao vivo.
- [x] "📦 Acompanhar pedido" (faixa logo abaixo do cabeçalho, como decidido acima).
- [x] Modo de adição (faixa e carrinho).
- [x] "💬 Dúvidas? Falar no WhatsApp".

### Task 5: Vendedor e demonstração
- [x] Lotes acrescentados no cartão; leitura de `additions` e `updated_at`.
- [x] O modo de demonstração cria, acompanha e acrescenta no `localStorage`.

### Task 6: Conferências no navegador
- [x] Supabase de mentira:
  - login anônimo e `/user`;
  - função com as operações;
  - `order_events`;
  - Realtime que só entrega ao dono.
- [x] Nova `check-acompanhamento.mjs`.
- [x] As antigas que liam o link do WhatsApp passam a ler a comanda guardada.

### Task 7: Documentação e validação
- [x] `docs/supabase.md`, Obsidian, `npm test`, `npm run lint`, `npm run build` e as conferências.
