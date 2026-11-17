# Gerenciador de sabores e pedidos no Supabase — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gerenciador de sabores no modo vendedor, Duplicar com todas as escolhas, limpeza de fotos, e o registro do pedido no Supabase por uma função que confere os preços (código ADS-0001, sem duplicar, com "Enviar mesmo assim" na falha).

**Architecture:** sabores esgotáveis nos dados (`Flavor.available`, `ChoiceGroup.unavailable`) e nas mudanças (`ProductChange.flavors`, `ItemChange.groups`), com as regras puras de escolha conferindo o esgotado. O estado do cardápio sem React (`catalogState.ts`) serve ao site e à função. A função é um módulo puro (`src/server/orderServer.ts`) com um invólucro Deno (`supabase/functions-src/pedido.ts`), empacotado pelo Vite num arquivo só (`supabase/functions/pedido/index.ts`).

**Tech Stack:** React 19, TypeScript, Vite 8 (empacota a função), Vitest, Node 26 (Supabase de mentira na conferência), Supabase REST, Edge Functions (Deno).

**Spec:** `docs/superpowers/specs/2026-11-17-sabores-e-pedidos-no-banco-design.md`

## Global Constraints

- Sem pacote novo; sem chave de servidor no site; nada de senha ou chave no Obsidian.
- Não inventar cardápio: sabores novos só os que o vendedor digitar.
- Preservar layout, fotos, senha, regra do Completo, foto ampliada, comanda e as conferências que já passam.
- Ids dos sabores existentes não mudam.
- O site nunca diz que o pedido foi enviado; diz "registrado" e "falta enviar a mensagem".

## Review Focus

1. Carrinho guardado com sabor que esgotou ou sumiu: não pode sumir em silêncio nem quebrar a página.
2. Mesma tentativa enviada duas vezes (toque duplo, tentar de novo): um pedido só.
3. Preço mudado entre a tela e o servidor: recusa com o total novo, sem gravar.
4. Falha de rede depois de abrir a aba do WhatsApp em branco: a aba fecha e o "Enviar mesmo assim" funciona.
5. Função publicada com cardápio antigo: o total diverge e o cliente vê "os preços mudaram", não um pedido errado.

---

### Task 1: Sabores esgotáveis e as mudanças de sabores (regras)

**Files:** `catalog/menu.ts`, `extras.ts`, `selection.ts`, `catalogChanges.ts` (+test), `cart/cart.ts` (+test), `choiceDraft.ts`.

**Interfaces — produces:**
- `Flavor.available?: boolean`; `Product.flavorsFrom?: ToppingGroupId` (Barca: `'syrup'`);
- `ChoiceGroup.unavailable?: readonly string[]`;
- `FlavorEntry = { id?: string; name: string; available?: boolean }`;
- `ProductChange.flavors?: FlavorEntry[]`;
- `ChoiceGroupEntry = { id?: string; label: string; options: { name: string; available?: boolean }[] }`;
- `ItemChange.groups?: ChoiceGroupEntry[]` (troca todas as escolhas sem preço; `flavors` antigo continua lido);
- `chooseFlavor(product, selection, id, options?: AddOptions)`;
- `missingChoices(product, selection, options?: AddOptions)`;
- `normalizeChoices` recusa opção esgotada (menos com `ignoreStock`);
- `cartItemProblem` inclui sabor e opção esgotados.

- [ ] Testes (falhar antes):
  - mudança de sabores do Batido (renomear, novo com id `novo-<slug>`, esgotar);
  - Barca segue as caldas (esgotar a calda esgota a cobertura);
  - item com 2 escolhas pela mudança `groups`, com opção esgotada;
  - `flavors` antigo continua valendo;
  - sabor esgotado não é escolhido no personalizador, mas o carrinho guardado mantém e marca;
  - opção esgotada recusada em `addExtraItem` e mantida e marcada ao reler.
- [ ] Implementar; `npx vitest run` → tudo passa; tsc limpo.
- [ ] Commit "Sabores esgotáveis e mudanças de sabores (regras)".

### Task 2: Telas — sabor esgotado e o toque do vendedor

**Files:** `milkshake-configurator/FlavorStep.tsx`, `catalog/ExtraOptionsDialog.tsx`, `seller/SellerAccess.tsx`.

- [ ] Sabor esgotado desligado com "Esgotado" (personalizador e janela de escolha); pílula "Disponível/Esgotado" em cada sabor do personalizador no modo vendedor (Barca: grava na calda).
- [ ] Sonda no navegador; tsc e lint.
- [ ] Commit "Telas: sabor esgotado e esgotar sabor em 1 toque".

### Task 3: Gerenciador de sabores no formulário e Duplicar com todas as escolhas

**Files:** `seller/FlavorsEditor.tsx` (novo), `seller/flavorsForm.ts` (+test), `SellerItemFormModal.tsx`.

- [ ] Testes de `readChoiceGroups(rows)` e `readFlavors(rows)`: nome vazio, repetido, grupo sem opção, limites.
- [ ] Editor no item (escolhas e opções) e no Batido e Milk-shake (sabores); Duplicar copia todas as escolhas; aviso na Barca.
- [ ] Commit "Gerenciador de sabores no modo vendedor".

### Task 4: Limpeza das fotos do aparelho

**Files:** `services/sellerCatalogStore.ts` (+test), `seller/sellerBackend.ts`, `seller/SellerModeProvider.tsx`.

- [ ] Teste: `pruneUnusedPhotos(now)` apaga só as sem uso e com mais de 1 hora; devolve as referências apagadas.
- [ ] Revogar os endereços temporários apagados; chamar depois de gravar e de restaurar.
- [ ] Commit "Limpeza das fotos que o vendedor não usa mais".

### Task 5: A função do pedido (regras puras)

**Files:** `catalog/catalogState.ts` (novo, sem React; `catalogStore.ts` reexporta), `server/orderServer.ts` (+test), `orders/orderMessage.ts` (linha de não registrado).

**Interfaces — produces:**
- `OrderRequest = { attemptId; cart: string; customer: CustomerDraft; payment: PaymentDraft; expectedTotalCents }`;
- `OrderResponse = { ok: true; code; message; totalCents; whatsapp; antecipado } | { ok: false; reason; detail?; totalCents? }`;
- `OrderDeps = { readChanges(); findOrder(attemptId); insertOrder(row); saveMessage(id, message); now() }`;
- `handleOrder(raw, deps)`;
- `buildOrderMessage({ ..., naoRegistrado? })`.

- [ ] Testes:
  - pedido certo (linha a linha do código e totais);
  - repetido (mesmo código, 1 gravação);
  - total adulterado (`total-mudou` com o total certo, sem gravar);
  - esgotado;
  - loja fechada (bloquear recusa; antecipado marca);
  - cliente e pagamento inválidos;
  - carrinho com item que não existe;
  - lixo na entrada.
- [ ] Commit "Função do pedido: regras e testes".

### Task 6: SQL, invólucro Deno e o arquivo da função

**Files:** `supabase/migrations/20261117120000_pedidos.sql`, `supabase/functions-src/pedido.ts`, `vite.pedido.config.ts`, `package.json` (`build:pedido`), `supabase/functions/pedido/index.ts` (gerado), `tests/server/pedido-bundle.mjs` (`check:pedido-funcao`).

- [ ] Arquivo gerado roda no Node com `Deno` de mentira e um PostgREST na memória: OPTIONS (CORS), POST certo (ADS-0001), repetido, recusa.
- [ ] Commit "Função pedido para o Supabase (SQL, Deno e arquivo para colar)".

### Task 7: O site registra o pedido

**Files:** `orders/orderService.ts` (+test), `checkout/CheckoutPanel.tsx`, `seller/sellerBackend.ts` (`refreshCatalogNow`).

- [ ] Testes de `submitOrder` com `fetch` de mentira: sucesso, recusa, falha de rede e tempo esgotado.
- [ ] Carrinho:
  - "Registrando o pedido…";
  - código registrado;
  - recusa com motivo e total novo;
  - falha com "Tentar de novo" e "Enviar mesmo assim pelo WhatsApp";
  - aba em branco aberta no toque e fechada na falha.
- [ ] Commit "O site registra o pedido antes do WhatsApp".

### Task 8: Conferências no navegador

**Files:** `tests/browser/fake-supabase.mjs`, `tests/browser/check-pedido.mjs` (`check:pedido`), ajustes em `check-vendedor.mjs` e `check-operacao.mjs`.

- [ ] `check:pedido` (segundo site na porta 5175 ligado ao Supabase de mentira):
  - registrado ADS-0001 com a comanda do servidor;
  - repetido, o mesmo código;
  - pedido mudado vira ADS-0002;
  - preço mudado no banco → "os preços mudaram";
  - servidor fora → "Enviar mesmo assim" com o aviso;
  - loja fechada com bloqueio.
- [ ] Gerenciador de sabores no `check:vendedor` / `check:operacao`.
- [ ] Rodar todas as conferências.
- [ ] Commit "Conferências dos sabores e do pedido no Supabase".

### Task 9: Documentação e fechamento

- [ ] `docs/supabase.md` (SQL novo, função, JWT, onde ver os pedidos, `build:pedido`); Obsidian; lint, testes e build; servidor no ar.
- [ ] Commit "Documentação dos sabores e dos pedidos no Supabase".
