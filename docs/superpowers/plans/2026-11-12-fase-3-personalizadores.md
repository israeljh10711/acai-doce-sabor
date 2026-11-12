# Fase 3 — Personalizadores: plano de implementação

> **Para quem executa:** use superpowers:executing-plans (execução nativa nesta sessão, escolhida pelo proprietário com "siga direto"). Passos com `- [ ]`.

**Objetivo:** os três personalizadores funcionando, com prévia ilustrada animada que mostra só o que foi escolhido, preço em tempo real e as ilustrações dos produtos na página inicial.

**Arquitetura:** as regras já existem em `src/features/catalog/selection.ts`. Uma função pura monta as camadas da ilustração; um componente SVG as desenha com `motion`. A tela é um único personalizador guiado pelos dados do produto (grupos, sabores), em `src/features/configurator-core/`; o passo de sabor fica em `milkshake-configurator/`.

**Tecnologia:** React 19.3, TypeScript 6, Tailwind 4, `motion` 14.12 (Framer Motion), Vitest 5.

**Desenho:** `docs/superpowers/specs/2026-11-12-fase-3-personalizadores-design.md`

## Restrições gerais

- Aviso legal, texto exato, junto de toda ilustração: `ILLUSTRATIVE_NOTICE` de `src/features/catalog/notices.ts`.
- Aviso do milk-shake, texto exato: `FLAVOR_AVAILABILITY_NOTICE`, no passo de sabor.
- Sem botão "Adicionar ao carrinho" (o carrinho é da Fase 5).
- Alvos de toque com 44 px ou mais; contraste AA; foco visível; `prefers-reduced-motion` respeitado (`MotionConfig reducedMotion="user"`).
- Larguras conferidas: 320, 360, 390, 768, 1024 e 1280 px, sem rolagem lateral.
- Nenhum item, preço ou sabor fora de `menu.ts`.

## Pontos de atenção na revisão

1. Trocar para um tamanho menor com o limite cheio: os adicionais excedentes saem e o cliente é avisado (texto visível e anunciado).
2. Tocar rápido várias vezes no +: nunca passa do limite gratuito nem de 10 unidades pagas.
3. Milk-shake sem sabor escolhido: o resumo diz o que falta; a prévia mostra o copo com a cor neutra.
4. Tela de 320 px com a prévia fixa e a barra do total: as opções continuam alcançáveis e nada fica coberto.
5. Leitor de tela: cada mudança anunciada; botões − e + com nome do item; motivo do + desabilitado legível.

Cada ponto tem teste na tarefa dona: 1 e 2 em `messages.test.ts` e `check-configurator.mjs`; 3 em `compose.test.ts` e `check-configurator.mjs`; 4 em `check-pages.mjs` (320 px) e foto; 5 em `check-configurator.mjs`.

---

### Tarefa 1: Composição da ilustração (lógica pura)

**Arquivos:** criar `src/features/catalog/illustration/compose.ts`, `scatter.ts` e os testes `compose.test.ts`, `scatter.test.ts`. Usa `looks.ts` (já existe).

**Interfaces produzidas:**
- `composeIllustration(input: IllustrationInput): Illustration`
  - `IllustrationInput = { slug: CategorySlug; sizeId: string | null; flavorId: string | null; toppings: Readonly<Record<string, number>> }`
  - `Illustration = { shape: ContainerShape; empty: boolean; base: BaseColors | null; layers: ToppingLayer[] }`
  - `ToppingLayer = { toppingId: string; look: ToppingLook; quantity: number }`
- `scatter(seed: string, count: number, area: { cx: number; cy: number; rx: number; ry: number }): { x: number; y: number; r: number }[]` (r = rotação em graus)

**Testes:**
- [ ] sem tamanho: `empty: true`, `base: null`, `layers: []`, `shape` igual ao do primeiro tamanho do produto
- [ ] só os ingredientes escolhidos viram camadas; ids desconhecidos são ignorados
- [ ] ordem das camadas segue `LAYER_ORDER`; empate segue a ordem do cardápio
- [ ] milk-shake: `base` = `FLAVOR_COLORS[flavorId]`; sem sabor, `SHAKE_NEUTRAL`; açaí usa `ACAI_COLORS`
- [ ] todo ingrediente de `TOPPINGS` tem aparência e todo tamanho de todo produto tem forma
- [ ] mesma entrada, mesma saída (`toEqual` entre duas chamadas)
- [ ] `scatter`: mesma semente dá os mesmos pontos; `count` pontos; todos dentro da elipse; sementes diferentes dão pontos diferentes

- [ ] Rodar `npm run test` e ver falhar; implementar; ver passar.

### Tarefa 2: Textos de aviso e de anúncio

**Arquivos:** criar `src/features/configurator-core/messages.ts` e `messages.test.ts`.

**Interfaces produzidas:**
- `blockerText(blocker: AddBlocker, limit: number): string` → `no-size`: "Escolha o tamanho primeiro"; `free-limit`: "Limite de {limit} grátis atingido"; `item-max`: "Quantidade máxima atingida"; `not-in-product`: "Indisponível neste produto"
- `addedText(product, selection, toppingId): string` → seco: "Você adicionou Granola. 2 de 3 grátis usados."; pago: "Você adicionou Kit Kat. 2 unidades, R$ 8,00."; fruta e cobertura: "Você incluiu Banana."
- `removedText(product, selection, toppingId): string` → "Você tirou Granola." (seco acrescenta "1 de 3 grátis usados.")
- `sizeText(product, sizeId, removed: RemovedTopping[]): string` → "Tamanho: Copo 500 ml, R$ 12,00." e, com remoções, "Saíram por passar do novo limite: 2 Amendoim, 1 Paçoca."
- `flavorText(product, flavorId): string` → "Sabor: Morango."

- [ ] Testes com esses textos exatos; ver falhar; implementar; ver passar.

### Tarefa 3: Ilustração em SVG com animação

**Arquivos:** instalar `motion@^14.12.0`; criar `src/features/catalog/illustration/ProductIllustration.tsx` e `parts.tsx`.

**Interfaces produzidas:** `<ProductIllustration slug sizeId flavorId toppings className? title? />` — `svg` com `viewBox="0 0 240 240"`, `role="img"` e nome acessível; cada camada é um `<g data-topping="{id}">`; a cena tem `data-size="{sizeId}"` ou `data-empty`.

- Camadas entram com `AnimatePresence` (queda curta e opacidade) e saem com opacidade; troca de tamanho refaz a cena com transição curta. `LazyMotion` com `domAnimation` e `m.*`.
- Recipientes: pote e copo translúcidos (açaí visível), isopor branco opaco, copo de milk-shake próprio. Sem tamanho: contorno tracejado vazio.

- [ ] Conferência: `npm run build` sem erro; foto em `tests/browser/screenshot.mjs` de um teste visual temporário não é necessária — a conferência visual é feita na Tarefa 5.

### Tarefa 4: Personalizador

**Arquivos:** criar em `src/features/configurator-core/`: `useConfigurator.ts`, `Configurator.tsx`, `SizeStep.tsx`, `ToppingStep.tsx`, `QuantityStepper.tsx`, `PreviewPanel.tsx`, `OrderSummary.tsx`, `MobileTotalBar.tsx`; em `src/features/milkshake-configurator/`: `FlavorStep.tsx`. Modificar `src/pages/ConfiguratorPage.tsx` e `src/index.css` (grade do personalizador).

**Interfaces:**
- `useConfigurator(product: Product)` → `{ selection, price, freeLimit, freeUsed, missing, announcement, blocker(id), chooseSize(id), chooseFlavor(id), add(id), remove(id) }`
- Passos numerados: açaí 1 Tamanho, 2 Adicionais, 3 Frutas, 4 Coberturas, 5 Adicionais pagos; milk-shake 1 Tamanho, 2 Sabor, 3 Coberturas, 4 Adicionais pagos (os dois últimos "opcional").
- Tamanho e sabor: `input type="radio"` estilizados como cartões. Seco e pago: `QuantityStepper` com botões "Adicionar {nome}" e "Tirar {nome}". Fruta e cobertura: botão com `aria-pressed`.
- Grade: celular uma coluna, prévia fixa no topo; 1024 px duas colunas (prévia | passos); 1280 px três colunas (tamanho | prévia | ingredientes e resumo).
- Barra fixa do total abaixo de 1024 px, com link "Ver resumo" para `#resumo`.
- Região `aria-live="polite"` com o último anúncio.

- [ ] `npm run lint`, `npm run test` e `npm run build` sem erro.

### Tarefa 5: Ilustrações na página inicial e conferência no navegador

**Arquivos:** modificar `src/features/catalog/CategoryCards.tsx` (ilustração em cada cartão e aviso legal abaixo dos cartões); criar `tests/browser/check-configurator.mjs` e o comando `check:configurator`.

- Composições dos cartões, só com itens do cardápio: Oca, Pote 530 ml com morango, banana, leite condensado e granola; Tradicional, Copo 500 ml com leite em pó, granola, morango e calda de chocolate; Milk-shake, 500 ml de morango com calda de morango.
- `check-configurator.mjs`, em 390 e 1280 px:
  - antes do tamanho, os botões "Adicionar" estão desabilitados;
  - Tradicional, Copo 500 ml, 3x Granola: o "Adicionar Paçoca" fica desabilitado e aparece "3 de 3";
  - 2x Kit Kat: total "R$ 20,00"; Banana com `aria-pressed="true"`;
  - a prévia tem `data-topping` para granola, kit-kat e banana e para nenhum outro;
  - trocar para Pote 200 ml: granola cai para 2 e o anúncio cita a saída;
  - milk-shake: o aviso de sabores aparece; sem sabor o resumo pede o sabor; com Morango e 500 ml, total "R$ 12,00";
  - console sem erros.

- [ ] Rodar `check:pages`, `check:contrast` e `check:configurator` com o site no ar; olhar as fotos em 390 e 1280 px; corrigir o que aparecer.

### Tarefa 6: Acessibilidade, SEO, documentação e commit

- [ ] Revisão de acessibilidade (skill fixing-accessibility) e de metadados (seo-audit) nas telas novas; corrigir o que for encontrado.
- [ ] Atualizar no Obsidian: Roadmap, Tarefas, Configurador 3D, Cardápio, Testes Realizados, Problemas Conhecidos, Estrutura do Código, Registro de Alterações.
- [ ] Commit local, sem envio ao GitHub.
