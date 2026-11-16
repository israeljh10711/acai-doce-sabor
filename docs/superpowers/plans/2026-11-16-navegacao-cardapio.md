# Navegação do cardápio: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar todas as categorias do cardápio à vista. No computador, uma barra lateral fixa; no celular, uma barra fixa com menu deslizante. Mais a faixa de destaques e as 5 categorias abertas, em vez das gavetas.

**Architecture:**
- O `MenuBrowser` (usado no início e na página Cardápio) troca a barra de atalhos e as gavetas pelas peças novas. Busca, fluxos de pedido, dados e foto ampliada continuam os mesmos.
- A lógica (entradas da navegação, contagens, destaques, selo de sabores e âncoras antigas) fica em módulos `.ts` com testes unitários.
- A tela é conferida no navegador.

**Tech Stack:** React 19, TypeScript, Tailwind 4, motion, React Router, Vitest (ambiente `node`), conferências em Edge via CDP (`tests/browser/lib.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-16-navegacao-cardapio-design.md`

## Global Constraints

- **Dependências:** nenhuma nova. Ícones em SVG no padrão de `src/components/ui/icons.tsx` (os novos copiados do Lucide, ISC), nunca emojis.
- **Cores:** pelos tokens `acai-800` (#4A0E36) e `gold-400` (#FACC15), nunca o hex no componente.
- **Âncoras, nesta ordem:**
  - `secao-acai-oca`, `secao-acai-tradicional`, `secao-acai-batido`, `secao-milkshake`;
  - `secao-combos`, `secao-barcas-potes`, `secao-picoles-sorvetes`, `secao-bebidas`, `secao-doces-bomboniere`.
- **Quebra de layout:** `lg` (1024 px). Área do cardápio em `mx-auto w-full max-w-7xl px-4 sm:px-6`.
- **Barra lateral:** `w-72 shrink-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto z-20`, branca, `rounded-3xl`, borda `acai-800/12`, `shadow-lg`, `p-4`.
- **Barra do celular:** `sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-acai-800/10 shadow-sm`.
- **Menu do celular:** `w-80 max-w-[85vw]`, com fundo `bg-black/50 backdrop-blur-xs`.
- **Grades:** destaques em `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3`; seções em `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`. Fotos quadradas.
- **Textos fixos:** "Navegação rápida", "Ver Ofertas & Combos", "Monte do seu jeito", "Catálogo completo", "Mais pedidos & ofertas do dia", "Pronto para pedir", "Pedir", "Recolher" / "Expandir", "Categorias", "N resultados encontrados para '…'" (singular "1 resultado encontrado para '…'"), "Limpar busca", "N sabores".
- **Contorno de destaque** na seção escolhida: dourado, 1,2 s.
- **"Reduzir movimento":** sem deslizar e sem rolagem suave.
- **Atributos dos cartões:** todo cartão tem `data-product-id`. O cartão da seção mantém `data-item`, e o da faixa usa `data-highlight` (assim `[data-item="x"]` continua achando um só).
- **Cardápio intocado:** preços, sabores, descrições e fotos (arquivos) não mudam.
- **Nenhum arquivo apagado:** `MoreOptions.tsx` é renomeado com `git mv`, e `emblems.ts` muda de papel.

## Review Focus

1. **Seção recolhida escolhida na navegação:** abre na hora e a página para no título dela, não antes. (`check:navigation`, Task 6)
2. **Escolher uma seção escondida pela busca** (pela barra lateral, pílula ou menu): a busca é limpa e a página chega à seção. (`check:navigation`)
3. **Celular:** depois do salto, o título da seção fica abaixo da barra fixa, sem ficar coberto. (`check:navigation` mede o topo do título e o fim da barra)
4. **Links antigos** (`#bebidas`, `#acai-oca`) e a volta do personalizador: levam à seção nova. (unitário em Task 2, `productInfo` em Task 1 e `check:navigation`)
5. **Teclado no menu do celular:** o foco fica dentro dele, o Esc fecha, o foco volta a "Categorias", e a notificação de oferta não aparece com o menu aberto. (`check:navigation` e `check:offers`)

---

### Task 1: Dados das seções, selo de sabores e ícones novos

**Files:**
- Modify: `src/features/catalog/extras.ts`
  - tipos `EmblemIcon` e `Drawer`;
  - os 5 itens de `DRAWERS`;
  - `drawerById` e `flavorCount`, novos.
- Modify: `src/components/ui/icons.tsx`: `Sailboat` e `GlassWater` (Lucide) e `Menu` (3 linhas).
- Modify: `src/features/catalog/productInfo.ts`: a volta ao cardápio usa a âncora nova.
- Modify: `src/features/catalog/emblems.ts`: vira o mapa de ícones dos 4 produtos.
- Test: `src/features/catalog/extras.test.ts`, `src/features/catalog/productInfo.test.ts` (novo).

**Interfaces:**
- Produces:
  - `type EmblemIcon = 'crown' | 'iceCreamBowl' | 'cupSoda' | 'iceCreamCone' | 'gift' | 'sailboat' | 'popsicle' | 'glassWater' | 'candy'`
  - `type Drawer = { id: DrawerId; title: string; navLabel: string; pillLabel: string; subtitle: string; anchor: string; icon: EmblemIcon; keywords: readonly string[] }`. Saem `shortcut`, `seal` e `defaultOpen`.
  - `drawerById(id: DrawerId): Drawer`
  - `flavorCount(item: ExtraItem): number`: opções do primeiro grupo de escolha sem `prices`; 0 quando não há.
  - `CATEGORY_ICONS: Readonly<Record<CategorySlug, EmblemIcon>>`, em `emblems.ts`: `crown`, `iceCreamBowl`, `cupSoda`, `iceCreamCone`.
  - `Sailboat`, `GlassWater`, `Menu`, em `icons.tsx`.

- [ ] **Step 1: Testes que falham**

```ts
// extras.test.ts
expect(DRAWERS.map((d) => [d.id, d.navLabel, d.pillLabel, d.anchor, d.icon])).toEqual([
  ['combos-e-ofertas', 'Combos e Ofertas', 'Combos', 'secao-combos', 'gift'],
  ['barcas-e-potes', 'Barcas e Potes Família', 'Barcas e Potes', 'secao-barcas-potes', 'sailboat'],
  ['picoles-e-sorvetes', 'Picolés e Sorvetes', 'Picolés e Sorvetes', 'secao-picoles-sorvetes', 'popsicle'],
  ['bebidas', 'Bebidas', 'Bebidas', 'secao-bebidas', 'glassWater'],
  ['doces-e-bomboniere', 'Doces e Bomboniere', 'Doces', 'secao-doces-bomboniere', 'candy'],
])
expect(DRAWERS.every((d) => d.subtitle.length > 10)).toBe(true)
const count = (id: string) => flavorCount(EXTRA_ITEMS.find((i) => i.id === id)!)
expect(['kit-completo-casquinha', 'pote-de-sorvete-2-litros-especiais', 'pote-de-sorvete-1-5-litro', 'combo-de-sorvete',
  'refrigerante-350-ml', 'acai-do-oca-pronto', 'agua-mineral-500-ml', 'pote-de-acai-1-litro'].map(count))
  .toEqual([12, 12, 6, 6, 5, 0, 0, 0])
// productInfo.test.ts
expect(productInfo('barca-de-acai').menuPath).toBe('/monte-seu-pedido#secao-barcas-potes')
expect(productInfo('pote-de-acai-1-litro').continuePath).toBe('/monte-seu-pedido#secao-combos')
expect(productInfo('acai-oca').menuPath).toBe('/monte-seu-pedido')
```

- [ ] **Step 2:** `npx vitest run src/features/catalog/extras.test.ts src/features/catalog/productInfo.test.ts`. Esperado: FAIL (`navLabel` indefinido, `flavorCount` não existe).

- [ ] **Step 3: Implementar.**
  - Subtítulos das seções, só com fatos dos itens:
    - Combos: "Kits com casquinhas, combos de sorvete e o pote de 1 litro montado."
    - Barcas: "Barca, potes de açaí e potes de sorvete de 1, 1,5 e 2 litros."
    - Picolés: "Picolés, copos de sorvete, sundae, cascão, cremosinho e coberturas."
    - Bebidas: "Refrigerante em lata e água mineral."
    - Doces: "Brownie, trufas, balas, chicletes, pipocas, salgadinho e chocolates."
  - `productInfo` usa `drawerById(extra.drawer).anchor`.
  - `MenuBrowser` e `MoreOptions` deixam de usar `shortcut`, `defaultOpen` e `drawerEmblem`. Até a Task 4, as gavetas começam todas abertas.

- [ ] **Step 4:** o mesmo comando, mais `npx tsc -b`. Esperado: PASS, sem erros.

- [ ] **Step 5:** Conferir os 3 ícones novos convertendo cada SVG para PNG com o sharp (sem quebras visíveis).

### Task 2: Entradas da navegação, destaques e âncoras antigas

**Files:**
- Create: `src/features/catalog/catalogNav.ts`, `src/features/catalog/highlights.ts`
- Test: `src/features/catalog/catalogNav.test.ts`

**Interfaces:**
- Consumes: `DRAWERS`, `drawerById`, `CATEGORY_ICONS` (Task 1); `searchMenu`, `SearchResult` (`search.ts`); `startingPriceCents` (`showcase.ts`); `PRODUCTS` (`menu.ts`).
- Produces:
  - `type NavEntry = { id: CategorySlug | DrawerId; anchor: string; group: 'monte' | 'catalogo'; label: string; shortLabel: string; icon: EmblemIcon; hint: string | null; count: number | null; available: boolean }`
  - `MAIN_ANCHORS: Readonly<Record<CategorySlug, string>>`
  - `NAV_ANCHORS: readonly string[]` (as 9 âncoras, na ordem)
  - `OFFERS_ANCHOR = 'secao-combos'`
  - `navEntries(result: SearchResult): readonly NavEntry[]`
    - `count`: itens da seção (ou os achados na busca). Nos 4 produtos é `null`.
    - `available`: a entrada está na página agora.
    - `hint` dos 4 produtos, tirado dos dados: "Especialidade da casa", "A partir de R$ 6,00", "300 ml e 500 ml", "13 sabores".
  - `LEGACY_ANCHORS: Readonly<Record<string, string>>`: id antigo (`acai-oca`, …, `milk-shake`, `combos-e-ofertas`, …, `doces-e-bomboniere`) → âncora nova.
  - `HIGHLIGHT_IDS = ['pote-de-acai-1-litro', 'barca-de-acai', 'kit-completo-casquinha', 'combo-1-litro', 'pote-de-acai-2-litros'] as const`
  - `highlightItems(result: SearchResult): readonly ExtraItem[]`: os 5, ou só os achados na busca.

- [ ] **Step 1: Testes que falham**

```ts
const all = navEntries(searchMenu(''))
expect(all.map((e) => e.anchor)).toEqual(NAV_ANCHORS)
expect(all.map((e) => [e.group, e.label, e.shortLabel, e.hint, e.count, e.available])).toEqual([
  ['monte', 'Açaí Oca', 'Açaí Oca', 'Especialidade da casa', null, true],
  ['monte', 'Açaí Tradicional', 'Tradicional', 'A partir de R$ 6,00', null, true],
  ['monte', 'Açaí Batido', 'Batido', '300 ml e 500 ml', null, true],
  ['monte', 'Milk-shake', 'Milk-shake', '13 sabores', null, true],
  ['catalogo', 'Combos e Ofertas', 'Combos', null, 5, true],
  ['catalogo', 'Barcas e Potes Família', 'Barcas e Potes', null, 11, true],
  ['catalogo', 'Picolés e Sorvetes', 'Picolés e Sorvetes', null, 12, true],
  ['catalogo', 'Bebidas', 'Bebidas', null, 2, true],
  ['catalogo', 'Doces e Bomboniere', 'Doces', null, 14, true],
])
const refri = navEntries(searchMenu('refri'))
expect(refri.map((e) => [e.count, e.available])).toEqual([[null, false], [null, false], [null, false], [null, false], [0, false], [0, false], [0, false], [1, true], [0, false]])
expect(navEntries(searchMenu('batida')).filter((e) => e.available).map((e) => e.id)).toEqual(['acai-batido'])
expect([LEGACY_ANCHORS['acai-oca'], LEGACY_ANCHORS['milk-shake'], LEGACY_ANCHORS['bebidas'], LEGACY_ANCHORS['barcas-e-potes']])
  .toEqual(['secao-acai-oca', 'secao-milkshake', 'secao-bebidas', 'secao-barcas-potes'])
expect(highlightItems(searchMenu('')).map((i) => [i.id, i.priceCents, i.originalPriceCents ?? null])).toEqual([
  ['pote-de-acai-1-litro', 3000, 3300], ['barca-de-acai', 3000, null], ['kit-completo-casquinha', 4100, null],
  ['combo-1-litro', 2399, null], ['pote-de-acai-2-litros', 3500, null],
])
expect(highlightItems(searchMenu('barca')).map((i) => i.id)).toEqual(['barca-de-acai'])
// Sinônimos citados no pedido de 2026-11-16
expect(['batida', 'dindin', 'refri', 'agua', 'casquinha', 'barca'].map((q) => searchMenu(q).total)).toEqual([1, 2, 1, 1, 6, 1])
```

- [ ] **Step 2:** `npx vitest run src/features/catalog/catalogNav.test.ts`. Esperado: FAIL (módulo não existe).
- [ ] **Step 3:** Implementar os dois módulos. O "300 ml e 500 ml" vem dos `name` de `PRODUCTS['acai-batido'].sizes`, ligados com ", " e " e ".
- [ ] **Step 4:** o mesmo comando. Esperado: PASS.

### Task 3: Enquadramento das fotos com texto ou embalagem

**Files:**
- Modify: `scripts/fotos/whatsapp.json`: `"fit": "contain"` em `combo-1-litro.jpg`, `combo-de-sorvete.jpg`, `kit-completo-casquinha-duo.jpg`, `refrigerante-350ml.jpg` e `fini-gelatinas.jpg` (`picole-gourmet.jpg` já tem).
- Regenerate: `src/features/catalog/catalogPhotos.json` com `node -e "import('./scripts/fotos/tamanhos-catalogo.mjs').then((m) => m.writeCatalogPhotoInfo(process.cwd()))"`.
- Test: `tests/assets.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
it('fotos inteiras (contain): as artes com texto e as embalagens que o quadrado cortaria', () => {
  expect(Object.entries(PHOTO_INFO).filter(([, i]) => i.fit === 'contain').map(([f]) => f).sort()).toEqual(
    ['combo-1-litro.jpg', 'combo-de-sorvete.jpg', 'fini-gelatinas.jpg', 'kit-completo-casquinha-duo.jpg', 'picole-gourmet.jpg', 'refrigerante-350ml.jpg'])
})
```

- [ ] **Step 2:** `npx vitest run tests/assets.test.ts`. Esperado: FAIL (só `picole-gourmet.jpg`).
- [ ] **Step 3:** Editar `whatsapp.json` e regerar o manifesto. Nenhuma imagem é reescrita.
- [ ] **Step 4:** o mesmo comando, mais `git status public/images`. Esperado: PASS e nenhuma imagem alterada.

### Task 4: Conteúdo aberto (destaques, seções e cartões)

**Files:**
- Create: `src/features/catalog/SectionIcon.tsx`: `SectionIcon({ icon, className }: { icon: EmblemIcon; className?: string })`, com o mapa de ícones que sai de `ItemVisual.tsx`.
- Create: `src/features/catalog/TopHighlightsStrip.tsx`: `TopHighlightsStrip({ items, level, onChoose })`.
- Rename: `MoreOptions.tsx` → `CatalogSections.tsx` (`git mv`) e reescrever.
- Modify:
  - `ItemVisual.tsx`: sai `ItemEmblem`; a foto `contain` ganha `bg-neutral-50 p-2`;
  - `MenuShowcase.tsx`: ids `MAIN_ANCHORS[slug]` e `data-flash-target`;
  - `MenuBrowser.tsx`: renderiza a faixa e as seções.

**Interfaces:**
- Consumes: Task 1 e Task 2; `ExtraVisual` com `size="fill"` e `sizes` explícito; `ZoomButton`, por dentro de `ExtraVisual zoom`.
- Produces:
  - `type SectionView = { drawer: Drawer; items: readonly ExtraItem[]; open: boolean; instant: boolean }`
  - `CatalogSections({ level, views, searching, onToggle, onChoose }: { level: 2 | 3; views: readonly SectionView[]; searching: boolean; onToggle: (id: DrawerId) => void; onChoose: (item: ExtraItem, opener: HTMLElement) => void })`
    - Cada seção é `<section id={drawer.anchor} data-section={drawer.id} aria-labelledby>`.
    - O cabeçalho tem `data-flash-target`, o ícone num círculo `acai-800` com desenho `gold-400`, o título no nível `level + 1`, o subtítulo, a contagem ("N itens" ou "N encontrados") e o botão "Recolher"/"Expandir" (`aria-expanded`, `aria-controls`).
    - A grade fica em `#${drawer.id}-itens`.
  - Cartão (`<article data-item data-product-id>`):
    - foto quadrada com a lupa;
    - selo `item.badge`;
    - selo "N sabores" quando `flavorCount > 0`;
    - nome no nível `level + 2`, descrição e preço (riscado quando há `originalPriceCents`; "a partir de" quando há preço por opção);
    - botão de ação com os mesmos textos de hoje.
  - `ItemActionButton({ item, onChoose, label? })`, exportado de `CatalogSections.tsx`. É link para o personalizador ou botão `aria-haspopup="dialog"`, e a faixa o usa com `label="Pedir"`.
  - O título "Catálogo completo" (`id="catalogo-completo-titulo"`) fica no nível `level`, no lugar de "Mais opções do cardápio".

- [ ] **Step 1:** Implementar. O "abrir sem animar" (`instant`) e o fechar durante a busca continuam como hoje (`closedInSearch`). Todas as seções começam abertas e guardam as recolhidas num `Set`.
- [ ] **Step 2:** `npx tsc -b; npx eslint src; npx vitest run`. Esperado: sem erros, todos passando.
- [ ] **Step 3:** Sonda no navegador (390 e 1280 px):
  - 5 seções abertas e 44 `[data-item]`;
  - 5 `[data-highlight]` na ordem de `HIGHLIGHT_IDS`;
  - fotos quadradas;
  - "Pedir" do Pote 2 L abre a confirmação.

### Task 5: Barra lateral, barra do celular, menu deslizante e seção marcada

**Files:**
- Create: `src/features/catalog/useScrollSpy.ts`: `useScrollSpy(anchors: readonly string[], observeKey: string): { current: string | null; pin: (anchor: string) => void }`.
  - Mesmo observador do `CategoryNav` de hoje (`rootMargin: '-35% 0px -50% 0px'`).
  - `pin` marca a âncora escolhida e ignora o observador por 1 s, para o clique em Milk-shake não marcar o Tradicional da mesma linha.
- Create: `src/features/catalog/CatalogSidebar.tsx`:
  - `CatalogSidebar({ entries, current, onGo })`;
  - `CategoryList({ entries, current, onGo })`: os 2 grupos com títulos e o separador; marca `aria-current="true"`; a contagem e a dica vêm de `NavEntry`; entrada indisponível apagada;
  - `OffersShortcut({ onGo })`: "Ver Ofertas & Combos" leva a `OFFERS_ANCHOR`;
  - a marca da seção à vista desliza com `m.span layoutId`.
- Create: `src/features/catalog/MobileCategoryDrawer.tsx`: `MobileCategoryDrawer({ open, onClose, entries, current, onGo, opener })`.
  - É um `<dialog>` com `showModal`, preso à esquerda.
  - Mostra a logo, o nome da loja, o X, `OffersShortcut` e `CategoryList`.
  - Fecha no Esc, no toque fora e ao escolher; nesse caso chama `onGo` depois de fechar.
  - Desliza pela transição de CSS (`starting:` / `transition-discrete`), que some com `motion-reduce`.
- Modify: `CategoryNav.tsx` → `CategoryNav({ entries, current, onGo })`: pílulas com ícone, `shortLabel` e contagem. A pílula marcada rola para a vista (como hoje).
- Modify: `SearchBar.tsx`.
  - `SearchBar({ value, onChange, searching, total })`: só o campo `#busca-cardapio`, o X e o anúncio para leitor de tela.
  - `SearchSummary({ query, total, onClear })`: a faixa "N resultados…" com "Limpar busca".
- Modify: `MenuBrowser.tsx`.
  - Layout: o `intro`; depois uma linha `lg:flex` com a barra lateral e a coluna principal (barra fixa, resumo da busca, faixa, vitrine, seções e aviso).
  - `goTo(anchor)`: limpa a busca que esconde o destino, abre a seção recolhida sem animar, `pin`, rola e marca `data-flash` por 1,2 s.
  - O menu do celular aberto pausa as ofertas.
- Modify: `src/hooks/useHashScroll.ts` → `useHashScroll(aliases?: Readonly<Record<string, string>>)`. `HomePage` e `BuildOrderPage` passam `LEGACY_ANCHORS`.
- Modify: `src/index.css`: `[data-flash] { outline: 2px solid var(--color-gold-400); outline-offset: 3px }`.
- Modify: `HomePage.tsx` (link do herói `#secao-acai-oca`) e as classes de espaçamento em `HomePage`/`BuildOrderPage`. No celular, a barra encosta na faixa roxa da página Cardápio.
- Modify: rolagem das âncoras (`scroll-mt-36 lg:scroll-mt-6`), ajustada à altura medida da barra.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `npx tsc -b; npx eslint .; npx vitest run`. Esperado: sem erros, todos passando.
- [ ] **Step 3:** Sonda no navegador:
  - barra lateral só em 1280 px;
  - barra fixa e pílulas só em 390 px;
  - menu abre e fecha;
  - "Bebidas" leva ao título logo abaixo da barra.

### Task 6: Conferências no navegador

**Files:**
- Create: `tests/browser/check-navigation.mjs` e o script `check:navigation` no `package.json`.
- Modify: `tests/browser/check-menu.mjs`, `check-e2e.mjs`, `check-lightbox.mjs`, `check-offers.mjs`, `check-contrast.mjs`, `check-pages.mjs` e `check-configurator.mjs`. Saem as gavetas e entram as seções; os seletores mudam de `#id-gaveta` para `[data-section]` e as âncoras novas.

- [ ] **Step 1: `check:navigation`**, em 390×844 e 1280×800, nas duas páginas. Conferir:
  - **Barra lateral (1280):**
    - 9 entradas na ordem, com contagens 5, 11, 12, 2 e 14 e as dicas;
    - rolar até Bebidas a marca;
    - clicar em Milk-shake marca Milk-shake;
    - clicar numa seção recolhida a abre e para no título, com o contorno sumindo depois de 1,2 s;
    - "Ver Ofertas & Combos" leva a Combos.
  - **Celular (390):**
    - a barra fica fixa e o título da seção para abaixo dela;
    - 9 pílulas com contagem;
    - o menu abre, o foco fica dentro, o Esc fecha e devolve o foco, o toque fora fecha, e escolher Doces fecha e rola.
  - **Faixa:** 5 cartões com fotos carregadas; "Pedir" nos três caminhos (personalizador, sabor e confirmação).
  - **Seções:** abertas, com 44 fotos quadradas; os selos "12 sabores" e "6 sabores"; os riscados R$ 33,00, R$ 6,00 e R$ 3,00.
  - **Busca:**
    - "refri" mostra "1 resultado encontrado para 'refri'", com contagens 0/0/0/1/0 e a faixa escondida;
    - "barca" mostra a faixa só com a Barca;
    - escolher uma seção escondida limpa a busca.
  - **Links antigos:** `#bebidas` leva a `#secao-bebidas`; a volta do personalizador da Barca leva a `#secao-barcas-potes`.
  - **Camadas:** nada cobre a busca nem o carrinho; o console fica sem erros.
- [ ] **Step 2:** Atualizar as conferências existentes e rodar todas: `check:images`, `menu`, `navigation`, `e2e`, `lightbox`, `configurator`, `pages`, `offers` e `contrast`. Esperado: todas passando.

### Task 7: Fechamento

- [ ] `npm run lint`, `npm test`, `npm run build`. Esperado: sem erros.
- [ ] Commit local, com a mensagem terminando em `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- [ ] Obsidian:
  - decisões D-057 em diante;
  - histórico, testes, cardápio, estrutura do código e tarefas;
  - os números das conferências executadas.
- [ ] Servidor `npm run dev -- --host` respondendo no computador e na rede.
