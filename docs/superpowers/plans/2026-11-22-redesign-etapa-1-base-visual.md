# Etapa 1 — Base visual, topo e rodapé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a base visual do site inteiro (cores, fontes, botão principal) pela direção "Tropical Editorial Premium" e redesenhar o topo e o rodapé, sem mudar nenhuma lógica.

**Architecture:** Os tokens do Tailwind 4 (`@theme` em `src/index.css`) mudam de valor. A escala `gold-*` vira `orchid-*`, uma troca mecânica dos nomes de classe. O utilitário `btn-gold` vira `btn-primary`. O topo e o rodapé são reescritos com os mesmos links, textos, marcadores `data-*` e comportamentos.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Vite 8, `@fontsource-variable/nunito`, motion/react.

**Spec:** `docs/superpowers/specs/2026-11-22-redesign-tropical-premium-design.md`

## Global Constraints

- Todo texto visível em português do Brasil.
- Contraste AA: `npm run check:contrast` com 0 abaixo do AA.
- Nenhuma mudança de lógica, rota, banco ou função `pedido`. `npm run build:pedido` sai igual.
- Os marcadores `data-*` existentes ficam (`data-store-badge`, `data-store-badge="strip"`, `data-footer-orders`, `data-seller-access`...).
- As conferências antigas do navegador rodam só no site de demonstração (5178), nunca na 5173.
- Ramo `redesign/tropical-premium`. Nada vai para `main` nesta etapa.

## Review Focus

- **Botão principal sobre o roxo** (destaque, cartão do Açaí Oca): o texto branco tem de continuar legível. O contraste é conferido pelo `check:contrast`.
- **Seleção** (sabor, tamanho, forma de pagamento): com o orquídea no lugar do amarelo, a opção marcada tem de continuar visível no branco (borda ≥ 3:1 e fundo lilás).
- **Topo em 320 px:** logo, situação da loja, "Cardápio" e "Carrinho" com contagem cabem sem rolagem lateral (`check:estouro`).
- **Modo Vendedor:** a faixa do vendedor fica acima do topo novo, sem sobreposição (`check-vendedor` e `check-operacao` no site de demonstração).
- **Fonte:** sem flash de fonte invisível. A Nunito entra com `font-display: swap` (padrão do fontsource), e a Montserrat sai do pacote.

---

### Task 1: Tokens, fontes e troca de nomes

**Files:**
- Modify: `src/index.css` (comentário de identidade, `@theme`, `body`)
- Modify: `src/main.tsx` (importa `@fontsource-variable/nunito` no lugar da Montserrat)
- Modify: `package.json`, `package-lock.json` (+ `@fontsource-variable/nunito`, − `@fontsource-variable/montserrat`)
- Modify: todos os arquivos de `src/` com `gold-` (39), troca mecânica para `orchid-`
- Modify: `tests/browser/check-offers.mjs:124` (`.bg-gold-400` → `.bg-orchid-400`)
- Modify: `tests/browser/check-pages.mjs:51` (`'Montserrat Variable'` → `'Nunito Variable'`)

**Interfaces:**
- Produces: tokens `orchid-100 #F6E6F7`, `orchid-300 #E29BE8`, `orchid-400 #CB71D0`, `orchid-500 #BF5DC4`, `orchid-600 #A045A6`, `orchid-700 #86338C`; `acai-950 #220A24`, `acai-900 #2E0F31`, `acai-800 #371336`, `acai-700 #4A1B4B`, `acai-600 #6A2C6B`, `acai-200 #EAD7EC`, `acai-100 #F5EAF6`, `acai-50 #FBF5FB`; `ink #28152D`, `ink-soft #6E5F72`, `line #ECDDED`, `leaf-600 #1A6D50`, `leaf-500 #21865C`, `canvas #FFFAFC`; `--font-display: 'Nunito Variable'`.

- [ ] **Step 1:** Instalar a fonte: `npm install @fontsource-variable/nunito` e `npm uninstall @fontsource-variable/montserrat`.
- [ ] **Step 2:** Trocar `gold-` por `orchid-` em `src/` e nas duas conferências. Conferir com `grep -rn "gold-" src tests`: só pode sobrar o histórico em comentários.
- [ ] **Step 3:** Escrever os valores novos no `@theme`, o `body` com o fundo `canvas` e o comentário de identidade com os contrastes do spec.
- [ ] **Step 4:** Rodar `npx tsc -b --noEmit`, `npm run lint` e `npm test`. Esperado: sem erros e 750/750.

### Task 2: Botão principal

**Files:**
- Modify: `src/index.css` (`@utility btn-gold` → `@utility btn-primary`)
- Modify: as 28 chamadas de `btn-gold` em `src/`, mais `tests/browser/check-vendedor.mjs:146`

- [ ] **Step 1:** Escrever o `btn-primary`:
  - fundo `orchid-600` e texto branco, sombra `0 6px 16px -8px` berinjela;
  - ao passar, `orchid-700`;
  - ao apertar, `scale(0.98)`;
  - transições de 150 a 200 ms, com `prefers-reduced-motion` sem o movimento.
- [ ] **Step 2:** Trocar o nome nas chamadas e na conferência.
- [ ] **Step 3:** Rodar `npm test`, `npm run build` e `node tests/browser/check-estouro.mjs`. Esperado: tudo passa.

### Task 3: Topo

**Files:**
- Modify: `src/components/layout/SiteHeader.tsx`
- Modify: `src/features/store-hours/StoreHeaderBadge.tsx` (versão clara)

**Conteúdo do topo:**
- fundo `canvas` com linha `line` embaixo;
- logo e nome da loja em Nunito 800, caixa normal, berinjela (no celular, o nome continua só para leitores de tela, como hoje);
- selo da situação em pílula lilás com a bolinha verde ou vermelha;
- "Cardápio" em berinjela, com a página atual marcada por um sublinhado orquídea;
- "Carrinho" como `btn-primary`, com a contagem numa bolinha branca de texto orquídea escura;
- foco com contorno `acai-800`;
- a linha fina do celular (`data-store-badge="strip"`) continua, clara.

- [ ] **Step 1:** Reescrever, mantendo os mesmos links, textos, `aria-label="Navegação principal"` e `data-*`.
- [ ] **Step 2:** Rodar `node tests/browser/check-estouro.mjs` e conferir o topo em 320, 360, 390, 768, 1024 e 1440 px.

### Task 4: Rodapé

**Files:**
- Modify: `src/components/layout/SiteFooter.tsx`

**Conteúdo do rodapé:**
- fundo berinjela com um degradê discreto até `acai-950`;
- a palavra "Açaí" gigante ao fundo, decorativa (`aria-hidden`, branco a 5%, cortada pela borda);
- logo, nome em Nunito, endereço e horário;
- links em três grupos:
  - "Pedir": Cardápio, Carrinho, Meus pedidos;
  - "Fale com a loja": WhatsApp, Instagram;
  - "Sobre": Créditos das fotos;
- links em branco/85, com `orchid-300` ao passar o ponteiro;
- © ano e nome.

- [ ] **Step 1:** Reescrever, mantendo todos os links, `data-footer-orders`, "(abre em nova aba)" e `aria-label="Rodapé"`.
- [ ] **Step 2:** Rodar `node tests/browser/check-estouro.mjs`. Esperado: passa.

### Task 5: Conferência completa e prévia

- [ ] **Step 1:** Rodar `npm test`, `npm run lint`, `npm run build` e `npm run build:pedido`. Esperado: tudo passa, e `supabase/functions/pedido/index.ts` sem mudança.
- [ ] **Step 2:** Rodar `check:estouro`, `check:contrast` e as conferências do navegador no site de demonstração (5178): pages, navigation, menu, configurator, completo, e2e, lightbox, offers, vendedor, operacao. Também `check:acompanhamento`, `check:pedidos-demo`, `check:painel`, `check:compra-rapida`, `check:modalidades`, `check:catalogo-vendedor` e `check:pedido`, que sobem o próprio site.
- [ ] **Step 3:** Tirar as fotos "depois" nas 5 larguras e comparar com as de antes e com a referência.
- [ ] **Step 4:** Fazer o commit no ramo `redesign/tropical-premium`, enviar o ramo, achar o endereço da prévia da Vercel e conferir nela.
