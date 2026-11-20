# Painel de pedidos ao vivo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** O painel "📋 Pedidos" recebe os pedidos na hora (Realtime), com contador vermelho na faixa, som, filtros novos, o fluxo de situação de cada modalidade, "Chamar Cliente no WhatsApp" e um modo de demonstração no `localStorage`.

**Architecture:**
- A interface lê uma loja de pedidos (`ordersLive.ts`) que não sabe de onde os dados vêm. Duas fontes com a mesma forma (`OrdersSource`):
  - Supabase: REST + Realtime;
  - local: `localStorage` + `BroadcastChannel`/`storage`.
- A loja faz a carga inicial, junta os eventos sem repetir (`id`), decide quando tocar o som e muda a situação.
- A faixa do vendedor liga a loja enquanto o vendedor está logado.

**Tech Stack:** React 19, TypeScript, Tailwind 4, `@supabase/realtime-js` 2.119.0, Vitest, Edge sem janela com o Supabase de mentira (agora com um servidor WebSocket próprio, sem pacote).

**Spec:** `docs/superpowers/specs/2026-11-20-painel-ao-vivo-design.md`

## Global Constraints

- Situações gravadas: `novo`, `preparando`, `saiu_para_entrega`, `pronto_retirada`, `pronto_consumo`, `concluido`, `cancelado`. Os antigos `confirmado` e `pronto` continuam lidos.
- Textos fixos:
  - "Aceitar / Preparar", "🛵 Saiu para Entrega", "🛍️ Pronto para Retirada", "🍨 Pronto para Consumo", "✅ Concluir", "❌ Cancelar";
  - "💬 Chamar Cliente no WhatsApp", "🔔 Som Ativo", "🔕 Silenciar", "Modo de demonstração local";
  - filtros "Todos", "🆕 Novos", "🍨 Preparando", "🛵 Saiu / Pronto", "✅ Concluídos";
  - "💠 Pix", "💵 Dinheiro", "💵 Dinheiro — Troco para R$ XX", "💳 Cartão";
  - "🚫 SEM:", "📝 Observação:".
- Nada de chave de servidor no site; nenhuma permissão nova para visitantes.
- O som nunca toca para a carga inicial, para `UPDATE` ou para um `id` já visto.
- Sem Supabase configurado: modo local. Com Supabase e falha: aviso, nunca o modo local.

## Review Focus

- Um `INSERT` do Realtime que chega enquanto a carga inicial ainda está em andamento, e o mesmo pedido também vem na carga: aparece uma vez e sem som.
- O vendedor sai do Modo Vendedor com o painel aberto: a inscrição é removida e o contador some.
- A mudança de situação falha: o cartão continua na situação antiga e mostra o erro.
- Duas abas no modo local: a mudança feita numa aparece na outra sem repetir o pedido.
- O mesmo pedido mandado duas vezes no modo local (toque duplo): um pedido só.

---

### Task 1: Regras (`ordersPanel.ts`)
- [x] Testes e código: situações novas, `nextStep` por modalidade, `canCancel`, os 5 filtros e contagens, pagamento com emoji, `parseComandaItems` (produto, extra, Completo, SEM, pagos, acompanhamentos, observação, comanda ilegível).

### Task 2: Linha do pedido compartilhada (`orderRow.ts`)
- [x] Tirar do `orderServer.prepare` a montagem da linha para usar também no modo local. A função `pedido` continua com o mesmo comportamento; gerar o arquivo de novo.

### Task 3: Fontes (`supabaseOrdersSource.ts`, `localOrdersSource.ts`)
- [x] Supabase: carga, mudança de situação e Realtime (endereço, chave, token do vendedor, `INSERT`/`UPDATE`, saída do canal), com um cliente de mentira nos testes.
- [x] Local: guardar o pedido (código DEMO, sem duplicar), ler depois de recarregar, mudar a situação, avisar outras abas, limite de 200.

### Task 4: Loja ao vivo (`ordersLive.ts`) e som (`orderAlert.ts`)
- [x] Testes com uma fonte de mentira:
  - carga sem som, `INSERT` com som, `UPDATE` sem som, repetidos;
  - eventos durante a carga, contador;
  - situação gravada ou com erro;
  - parar remove a inscrição;
  - reserva por consulta;
  - som silenciado ou bloqueado.

### Task 5: SQL
- [x] `20261120180000_painel_ao_vivo.sql`: situações novas, situação × modalidade, publicação Realtime. Conferir no PGlite.

### Task 6: Tela
- [x] Faixa: "📋 Pedidos" com selo vermelho pulsante, nos dois modos.
- [x] Página: indicador ao vivo ou de demonstração, filtros novos, controle do som.
- [x] Cartão novo.
- [x] Carrinho: guardar o pedido de demonstração no modo local.

### Task 7: Conferências no navegador
- [x] Supabase de mentira com WebSocket do Realtime:
  - pedido novo na hora, com som e contador;
  - `UPDATE` de outro aparelho sem som;
  - fluxos das 3 modalidades, cancelar, erro;
  - contador em outra página;
  - sair remove a inscrição.
- [x] Modo local: pedido do carrinho no painel, fluxo, cancelar, recarregar, duas abas, sem duplicar.

### Task 8: Documentação e validação
- [x] `docs/supabase.md`, Obsidian, `npm test`, `npm run lint`, `npm run build`, conferências.
