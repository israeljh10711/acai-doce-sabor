# Operação do modo vendedor e comanda do WhatsApp — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** esgotado em 1 toque, loja aberta/fechada com horário e contato editáveis, frete por bairro, duplicar item, observação por item e a comanda nova do WhatsApp.

**Architecture:** as configurações da loja viram um tipo novo de mudança do vendedor (`settings`, id `loja`) na mesma camada do cardápio (aparelho ou Supabase). Regras puras e testadas em `features/store/storeSettings.ts`, `store-hours/hours.ts`, `catalog/availability.ts`, `checkout/delivery.ts` e `orders/orderMessage.ts`; as telas só leem essas regras.

**Tech Stack:** React 19, TypeScript, Tailwind 4, motion, Vitest, conferências no navegador por CDP (`tests/browser/*.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-17-operacao-vendedor-e-comanda-design.md` (aprovado em 2026-11-17, 1A e 2A, com acréscimos).

## Global Constraints

- Preservar o layout atual, as 73 fotos reais em `public/images/`, a barra lateral, o menu deslizante, a senha do vendedor, a regra do Completo e a foto ampliada.
- Sem pacote novo; sem chave secreta no site; nada de senha no Obsidian.
- Não inventar dados do cardápio: frete começa "a combinar"; prazo padrão "30–45 min" (dado do responsável); horário padrão 13h–21h.
- Na tela, ícones e bolinhas no lugar de emojis (mesmo texto e cores pedidos); na comanda, emojis exatamente como no modelo.
- Textos da tela em português do Brasil, iguais aos do pedido: "Disponível", "Esgotado", "ESGOTADO", "Indisponível no momento", "Loja Aberta", "Loja Fechada", "Aberto agora • Entrega: 30–45 min", "Loja fechada no momento", "Entrega / Frete", "Horários e Contato", "Duplicar", "Duplicar Item — [Nome] (Cópia)", "+ Adicionar bairro/taxa", "+ Observação", "Entrega", "Retirar na loja", "Grátis (R$ 0,00)".
- Nunca dizer que o pedido foi enviado: o WhatsApp só abre com a mensagem.

## Review Focus

1. Cliente sem Supabase nunca vê configuração que só existe no aparelho do vendedor (vê os padrões).
2. Interruptor perto da virada do dia (00h–05h) e com horário editado (ex.: fecha 00:00).
3. Troco em dinheiro com frete somado; frete "a combinar" sem "Levar troco".
4. Bairro escolhido que deixa de existir; lista vazia no modo de taxas.
5. Item ou complemento que esgota com o cliente no carrinho (na memória e ao recarregar).

---

### Task 1: Configurações da loja (modelo e gravação)

**Files:**
- Create: `src/features/store/storeSettings.ts`, `src/features/store/storeSettings.test.ts`
- Modify: `src/features/catalog/catalogChanges.ts`, `src/features/catalog/catalogStore.ts`, `src/services/sellerCatalogStore.ts`, `src/services/supabaseBackend.ts`, `supabase/migrations/20261116000000_modo_vendedor.sql`

**Interfaces:**
- Produces: `StoreSettings = { hours: { opensAt: number; closesAt: number }; override: { state: 'open' | 'closed'; until: number } | null; deliveryTime: string; closedOrders: 'antecipado' | 'bloquear'; delivery: { mode: 'gratis' | 'taxas' | 'combinar'; zones: { id: string; name: string; feeCents: number }[] }; contact: { whatsapp: string; street: string; city: string; uf: string } }`, `DEFAULT_STORE_SETTINGS`, `parseStoreSettings(raw: unknown): StoreSettings`, `DELIVERY_TIMES = ['20–35 min','30–45 min','45–60 min','60–80 min']`.
- Produces: `CatalogChanges.settings: Record<string, Partial<StoreSettings>>`, `ChangeKind` com `'settings'`, `getStoreSettings(): StoreSettings`, `useStoreSettings(): StoreSettings` (mesma referência enquanto nada muda).

- [ ] **Step 1: testes** — `parseStoreSettings(undefined)` = padrão (13h–21h = 780/1260, '30–45 min', 'antecipado', modo 'combinar', zonas [], contato do `storeInfo`); campo inválido volta ao padrão sem derrubar os outros; zona sem nome ou com valor negativo sai; abertura < 05:00 ou fechamento ≤ abertura ou > 1440 voltam ao padrão; override sem `until` numérico vira `null`; `parseChanges({settings:{loja:{deliveryTime:'45–60 min'}}})` mantém; `changesFromRows` aceita `kind: 'settings'`.
- [ ] **Step 2: ver falhar** — `npx vitest run src/features/store src/features/catalog/catalogChanges.test.ts src/services` → FAIL (módulo não existe).
- [ ] **Step 3: implementar** os tipos, o padrão, a leitura validada, `settings` em `NO_CHANGES`/`parseChanges`/`withPhotos`/KINDS, `getStoreSettings` memoizado pela referência de `changes.settings.loja`, e `'settings'` no `check` do SQL.
- [ ] **Step 4: ver passar** — mesmo comando → PASS; `npx vitest run` inteiro → PASS.
- [ ] **Step 5: commit** "Configurações da loja como mudança do vendedor".

### Task 2: Horário editável e interruptor (regras)

**Files:**
- Modify: `src/features/store-hours/hours.ts`, `src/features/store-hours/hours.test.ts`, `src/features/store-hours/useStoreStatus.ts`

**Interfaces:**
- Consumes: `StoreSettings` (Task 1).
- Produces: `storeStatusAt(ms, hours?)`, `effectiveStatus(ms, settings): StoreStatus & { manual: boolean; reopensAt: number | null; reopenText: string }` (`title` 'ABERTO AGORA'/'FECHADO AGORA'; `detail` "Entrega: 30–45 min" aberto, "Abrimos hoje às 13h"/"Abrimos amanhã às 13h" fechado), `overrideFor(action: 'open' | 'close', ms, hours): StoreSettings['override']`, `hoursText(hours)`, `useStoreStatus()` (relê quando as configurações mudam).

- [ ] **Step 1: testes** (horário de Brasília):
  - Fechar às 15:00 de 17/11 → fechada até 18/11 13:00; às 10:00 → até 18/11 13:00; às 01:00 de 18/11 → até 18/11 13:00.
  - Abrir às 11:00 → aberta até 21:00 do mesmo dia; às 22:00 → até 05:00 do dia seguinte; às 15:00 (já aberta pelo horário) → `null`.
  - `effectiveStatus` com override vencido = horário; dentro do prazo = override com `manual: true`.
  - Horário 14:00–00:00 (`closesAt` 1440): 23:30 aberta, 00:10 fechada; `hoursText` → "Todos os dias, das 14h às 0h"... formato "das 13h às 21h" e minutos quando houver ("das 13h30 às 21h").
- [ ] **Step 2: ver falhar** — `npx vitest run src/features/store-hours` → FAIL.
- [ ] **Step 3: implementar**; dia da loja vira às 05:00.
- [ ] **Step 4: ver passar** — mesmo comando e o inteiro → PASS.
- [ ] **Step 5: commit** "Horário editável e interruptor da loja (regras)".

### Task 3: Disponibilidade e observação no carrinho (regras)

**Files:**
- Create: `src/features/catalog/availability.ts`, `src/features/catalog/availability.test.ts`
- Modify: `src/features/catalog/catalogChanges.ts` (+test), `src/features/catalog/menu.ts`, `src/features/catalog/selection.ts`, `src/features/cart/cart.ts` (+test), `src/features/cart/cartStore.ts`

**Interfaces:**
- Produces: `ProductChange.available`, `Product.available?`, `isProductAvailable(slug): boolean` (produto ou item do personalizador esgotado → false), `cartItemProblem(item): { kind: 'item' } | { kind: 'toppings'; names: string[] } | null`, `CartItem.note?: string`, `setNote(cart, id, note)`, `MAX_NOTE_LENGTH = 140`, `cartActions.setNote(id, note)`.

- [ ] **Step 1: testes** — produto com `available:false` pela mudança; Barca esgotada pelo item → `isProductAvailable('barca-de-acai') === false`; observação gravada, cortada em 140, vazia apaga, volta igual depois de `serializeCart`/`parseCart`; item das seções esgotado continua no carrinho ao recarregar e `cartItemProblem` = `{kind:'item'}`; complemento esgotado continua na montagem ao recarregar e aparece em `names`.
- [ ] **Step 2: ver falhar** — `npx vitest run src/features/catalog src/features/cart` → FAIL.
- [ ] **Step 3: implementar**; `normalizeSelection` refaz sem olhar o esgotado (a trava de esgotado continua ao adicionar); `cartStore` lê o carrinho na primeira vez que a tela pede (depois das mudanças do vendedor).
- [ ] **Step 4: ver passar**.
- [ ] **Step 5: commit** "Esgotado nos produtos e observação no carrinho (regras)".

### Task 4: Entrega e dados do cliente (regras)

**Files:**
- Create: `src/features/checkout/delivery.ts`, `src/features/checkout/delivery.test.ts`

**Interfaces:**
- Consumes: `StoreSettings['delivery']`.
- Produces: `CustomerDraft = { name; phone; kind: 'entrega' | 'retirada' | null; street; number; district; zoneId: string | null; reference }`, `EMPTY_CUSTOMER`, `OTHER_ZONE = 'outro'`, `DeliveryFee = { kind: 'retirada' } | { kind: 'gratis' } | { kind: 'taxa'; cents; zoneName } | { kind: 'combinar'; zoneName?: string }`, `feeFor(draft, delivery): DeliveryFee | null`, `feeCents(fee)`, `checkCustomer(draft, delivery): { ok: true; customer: Customer } | { ok: false; problems: Partial<Record<CustomerField, string>> }`, `formatPhone(digits)`.

- [ ] **Step 1: testes** — retirada não pede endereço e custa 0; grátis; taxa do bairro escolhido; "Outro bairro" = a combinar e pede o bairro digitado; lista vazia no modo de taxas = a combinar com bairro digitado; bairro escolhido que saiu da lista = problema "Escolha o bairro"; nome vazio; telefone com 9 dígitos = problema, com 11 = "(83) 99999-0000"; rua, número e bairro obrigatórios na entrega.
- [ ] **Step 2: ver falhar** — `npx vitest run src/features/checkout` → FAIL.
- [ ] **Step 3: implementar**.
- [ ] **Step 4: ver passar**.
- [ ] **Step 5: commit** "Entrega por bairro e dados do cliente (regras)".

### Task 5: Comanda do WhatsApp

**Files:**
- Modify: `src/features/orders/orderMessage.ts`, `src/features/orders/orders.test.ts`, `src/features/orders/orderService.ts`, `src/features/cart/cartCompleto.test.ts`

**Interfaces:**
- Consumes: Tasks 3 e 4 (`note`, `Customer`, `DeliveryFee`), `Payment`.
- Produces: `OrderDraft = { cart; customer: Customer; payment: Payment; sentAt: number; antecipado: boolean; code?: string }`, `buildOrderMessage(order): string`, `orderWhatsAppUrl(order): string` (número do contato das configurações), `keycap(n)`.

- [ ] **Step 1: testes** com as linhas exatas do modelo aprovado (spec, seção 5): cabeçalho, data "17/11/2026 às 15:42" (Brasília), dados do cliente, endereço só na entrega, "1️⃣", "🔟", "1️⃣1️⃣", montagem "COMPLETO (todos os acompanhamentos)" sem nada tirado e "COMPLETO" + "🚫 *RETIRAR (SEM):*" com algo tirado, "➕ *Cremes / Extras Pagos:*" com "(+R$ 3,00)", "🥄 *Acompanhamentos:*" com uma linha por grupo, "📝 *Observação:*" só com texto, resumo com frete (taxa, grátis, a combinar, retirada), Pix com comprovante, dinheiro com e sem troco, cartão com maquininha só na entrega, "⏰ *Pedido antecipado:*", rodapé.
- [ ] **Step 2: ver falhar** — `npx vitest run src/features/orders src/features/cart` → FAIL.
- [ ] **Step 3: implementar**.
- [ ] **Step 4: ver passar** e o inteiro.
- [ ] **Step 5: commit** "Comanda nova do WhatsApp".

### Task 6: Telas do cliente

**Files:**
- Create: `src/features/store-hours/StoreHeaderBadge.tsx`, `src/features/store-hours/StoreClosedCard.tsx`
- Modify: `StoreStatusBadge.tsx`, `SiteHeader.tsx`, `SiteFooter.tsx`, `HomePage.tsx`, `BuildOrderPage.tsx`, `CartPage.tsx`, `CheckoutPanel.tsx`, `ItemActions.tsx`, `CatalogSections.tsx` (`SoldOut`), `TopHighlightsStrip.tsx`, `MenuShowcase.tsx`, `OrderSummary.tsx`, `PreviewPanel.tsx`, `components/ui/icons.tsx`

- [ ] Selo do cabeçalho (computador no cabeçalho; celular numa linha fina abaixo); selo grande com o mesmo estado; aviso de loja fechada no início, no cardápio e no carrinho; tarja "ESGOTADO" sobre a foto esmaecida e "Indisponível no momento" nos itens, nos 4 produtos e no personalizador; "+ Observação" e marcação de esgotado em cada linha do carrinho; carrinho com "Seus dados", "Entrega" / "Retirar na loja", endereço ou bairro, Subtotal/Entrega/Total, troco com frete, aviso de loja fechada (bloqueio ou antecipado), envio bloqueado com item esgotado; dados do cliente guardados na aba (`sessionStorage`); rodapé e "Peça agora" com horário e contato atuais.
- [ ] Conferir: `npx tsc -b`, `npm run lint`, `npx vitest run`; sonda no navegador em 390 e 1280 px sem erro no console.
- [ ] Commit "Telas do cliente: loja fechada, esgotado, entrega e observação".

### Task 7: Telas do vendedor

**Files:**
- Create: `src/features/seller/StoreControls.tsx` (interruptor, Tempo), `src/features/seller/DeliverySettingsModal.tsx`, `src/features/seller/StoreHoursContactModal.tsx`
- Modify: `SellerAccess.tsx` (pílula "Disponível/Esgotado", "Duplicar"), `sellerModeContext.ts` (`copyOf`), `SellerItemFormModal.tsx` (duplicar), `SellerBar.tsx`, `CatalogSections.tsx`, `TopHighlightsStrip.tsx`, `MenuShowcase.tsx`, `ToppingStep.tsx`

- [ ] Pílula de 1 toque nos itens, destaques, 4 produtos e complementos (abaixo do nome); "Duplicar" no rodapé dos itens (não no Pote 1 L e na Barca) abrindo "Duplicar Item — [Nome] (Cópia)" preenchido e sem foto; na faixa: "Loja Aberta/Fechada" com o prazo do interruptor, "Tempo" (4 opções e "Outro prazo"), "Entrega / Frete" (3 modos, "+ Adicionar bairro/taxa", editar, excluir) e "Horários e Contato" (abre/fecha, com a loja fechada, WhatsApp, endereço).
- [ ] Conferir como na Task 6.
- [ ] Commit "Telas do vendedor: esgotado em 1 toque, loja, tempo, frete, horários e duplicar".

### Task 8: Conferências no navegador

**Files:**
- Create: `tests/browser/check-operacao.mjs`; script `check:operacao` no `package.json`
- Modify: `check-completo.mjs`, `check-configurator.mjs`, `check-contrast.mjs`, `check-e2e.mjs`, `check-menu.mjs`, `check-vendedor.mjs`

- [ ] `check:operacao` (390 e 1280 px): esgotar e reabrir item, produto e complemento em 1 toque e ver o efeito do cliente; fechar a loja (selo, aviso com endereço e WhatsApp, carrinho antecipado e bloqueado); "Abrir" de volta; Tempo; Horários e Contato; frete por bairro somando no total e no troco; "Outro bairro"; retirada; duplicar; observação; comanda completa conferida linha a linha.
- [ ] Ajustar as 6 conferências antigas ao carrinho novo (nome e retirada antes de enviar) e às linhas da comanda nova.
- [ ] Rodar todas: `npm run check:*` → 0 falhas; contraste 0 abaixo do AA.
- [ ] Commit "Conferências da operação do vendedor e da comanda".

### Task 9: Documentação e fechamento

**Files:**
- Modify: `docs/supabase.md`, spec (decisões tomadas), Obsidian (Decisões, Histórico, Visão, Funcionalidades, Testes, Estrutura, Tarefas)

- [ ] `npm run lint`, `npm test`, `npm run build` sem erros; Obsidian atualizado sem senha; servidor `npm run dev -- --host` no ar.
- [ ] Commit "Documentação da operação do vendedor e da comanda".
