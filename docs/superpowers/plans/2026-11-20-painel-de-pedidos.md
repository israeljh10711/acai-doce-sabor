# Painel de pedidos do Modo Vendedor (etapa 2) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Página "Pedidos" do Modo Vendedor, para o balcão: os pedidos do dia gravados pela função `pedido`, com o selo da modalidade, endereço, "Abrir GPS no Mapa", itens, total e pagamento; atualização automática, filtro por situação, aviso sonoro de pedido novo e botões para avançar a situação.

**Architecture:** Regras puras em `src/features/orders/ordersPanel.ts` (ler a linha do banco com cuidado, próximos passos, filtros, textos). Leitura e mudança de situação no cliente REST que já existe (`supabaseRest.ts`), com o token do vendedor. Página `/pedidos` carregada sob demanda, aberta pelo botão "Pedidos" da faixa do vendedor. Sem biblioteca nova: consulta a cada 15 s enquanto a página está visível, e bipe pela Web Audio.

**Tech Stack:** React 19, TypeScript, Tailwind 4, motion, Vitest, Edge sem janela com o Supabase de mentira (`tests/browser/fake-supabase.mjs`).

**Spec:** pedido de 2026-11-20 (seção 10), `docs/superpowers/specs/2026-11-20-modalidades-e-gps-design.md`, e a opção B escolhida em 2026-11-20.

## Decisões

- **Página `/pedidos`** (não uma janela), só para o vendedor logado e só com o Supabase ligado. Sem Supabase, explica que os pedidos não ficam guardados. Sem login, oferece a senha. Fora dos buscadores (`noindex`).
- **Quais pedidos:** os do dia da loja (desde as 5h de Brasília) mais os de dias anteriores ainda em andamento. Os mais novos em cima. No máximo 200.
- **Atualização:** a cada 15 s com a página visível; também ao voltar para a aba; e em "Atualizar agora".
- **Aviso sonoro:** pedido novo (situação "novo") que aparece depois da primeira carga toca um bipe duplo e é anunciado para leitor de tela. O título da aba mostra quantos estão como "novo". O som liga e desliga pelo botão (o navegador só libera áudio depois de um toque); a escolha fica no aparelho.
- **Situação:**
  - novo → **Confirmar** → confirmado → **Preparando** → preparando → **Pronto** → pronto;
  - depois de pronto: na entrega, **Saiu para entrega** e depois **Concluído**; em Retirar e Comer no Local, direto **Concluído**;
  - **Cancelar** existe até concluir e pede confirmação no próprio cartão;
  - o banco só deixa o vendedor mudar a situação (regra de 2026-11-17).
- **Filtro:** Em andamento (padrão), Novos, Confirmados, Preparando, Prontos, Saiu para entrega, Concluídos, Cancelados e Todos, com a contagem.
- **Cartão:**
  - código, hora, "Pedido antecipado", situação e o selo da modalidade (ícone + texto; Comer no Local em dourado e roxo);
  - cliente e telefone (com link do WhatsApp);
  - na entrega: endereço, referência e "Abrir GPS no Mapa" (só com GPS válido, link refeito das coordenadas validadas);
  - os itens como saíram na comanda (montagem, retirar, extras, observação);
  - subtotal, frete, total e pagamento (com troco);
  - em Retirar e Comer no Local, nunca endereço nem GPS, mesmo que venham na linha.
- **Pedidos antigos e linhas estranhas:** campo ausente vira vazio. Modalidade desconhecida aparece como "Modalidade não informada". Linha sem id, código ou situação válida fica de fora.

## Tarefas

### Task 1: Regras do painel (`ordersPanel.ts`)
- [x] Testes: leitura da linha (3 modalidades, antiga sem colunas novas, GPS inválido, retirada com GPS na linha), próximos passos por modalidade, cancelar, filtros e contagens, textos de pagamento e frete, itens da comanda, pedidos novos, início do dia da loja.
- [x] Implementar e ver passar.

### Task 2: Banco pelo site (`supabaseRest.ts`, `sellerBackend.ts`)
- [x] Testes: `readOrders(since)` (endereço, filtro `or`, ordem, limite, token) e `setOrderStatus(id, status)` (PATCH só com a situação, `null` quando nada muda).
- [x] `getSupabaseRest()` no `sellerBackend.ts`.

### Task 3: Página e faixa
- [x] `OrdersPage.tsx` (rota `/pedidos`, sob demanda), `OrderCard.tsx`, `useOrdersFeed.ts`, `orderAlert.ts`; botão "Pedidos" na faixa (só com Supabase); ícone `ClipboardList`.

### Task 4: Conferência no navegador
- [x] `fake-supabase.mjs`: login do vendedor, `sellers`, leitura dos pedidos e PATCH da situação com as regras do SQL.
- [x] `check-pedidos-painel.mjs`: pedidos criados pela função gerada (entrega com GPS, retirar, comer no local) e um antigo; selos, GPS, sem endereço fora da entrega, filtros, avanço e cancelamento gravados, pedido novo pela atualização com bipe, sem login, 1280/390/320 px.

### Task 5: Supabase de verdade (só leitura), documentação e validação final
- [x] A consulta da página e um PATCH num id inexistente contra o Supabase real (nada muda).
- [x] `docs/supabase.md`, Obsidian, `npm test`, `npm run lint`, `npm run build`, conferências do navegador.
