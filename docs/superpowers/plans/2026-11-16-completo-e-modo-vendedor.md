# Completo e modo vendedor: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o botão "Completo" nos 4 açaís montáveis e o modo vendedor (editar, cadastrar, esgotar, com foto da galeria), gravando no Supabase quando houver chaves e no aparelho enquanto não houver.

**Architecture:**
- **Completo:** um modo da `Selection` (`complete`), com as regras em `selection.ts`; a interface, o carrinho e a mensagem só leem essas regras.
- **Modo vendedor:** uma camada de mudanças sobre o cardápio do código, aplicada por `catalogStore.ts`, que reatribui os dados exportados (ligações vivas de ES modules) e avisa a interface por contexto. Duas gravações com a mesma interface: local (localStorage e IndexedDB) e Supabase (REST com `fetch`).

**Tech Stack:** React 19, TypeScript 6, Tailwind 4, motion, React Router, Vitest (ambiente `node`), conferências em Edge via CDP. Nenhum pacote novo.

**Spec:** `docs/superpowers/specs/2026-11-16-completo-e-modo-vendedor-design.md`

## Global Constraints

- **Dependências:** nenhuma nova (nem `@supabase/supabase-js`).
- **Chaves e senhas:**
  - no código e no `.env.local`, só a chave pública (anon ou publishable), nunca a `service_role`;
  - a senha não aparece em docs, notas, testes de navegador escritos em arquivo nem no Obsidian (a senha inicial local fica só no código da sessão local, como hash de comparação).
- **Textos fixos (do pedido):**
  - "Quer rechear tudo de uma vez?";
  - "Toque em Completo para marcar tudo e depois tire o que não quiser.";
  - "Modo Completo ativado! Se não quiser algum item (ex.: Farinha Láctea), basta tocar nele ou no botão - para tirar.";
  - "Completo", "Completo aplicado", "Marcar tudo novamente", "Limpar";
  - "Montagem: COMPLETO (todos os acompanhamentos)" e "Montagem: COMPLETO (SEM: …)";
  - "Senha para vendedor", "Acesso do Vendedor / Dono", "Senha incorreta. Tente novamente.";
  - "Modo Vendedor Ativo", "Sair", "Alterar senha", "Backup / Restaurar", "Sair do Modo Vendedor";
  - "Editar", "+ Adicionar produto", "+ Adicionar complemento", "Esgotado", "Disponível", "Excluir item", "Restaurar original".
- **Grupos do Completo:** `dry`, `fruit`, `syrup`. Fora dele: `paid` e `batido`. Produtos com Completo: `acai-oca`, `acai-tradicional`, `pote-de-acai-1-litro`, `barca-de-acai`.
- **Fotos do vendedor:** até 800 px no lado maior, WebP com qualidade 0,82 (JPEG 0,82 quando o navegador não gera WebP).
- **Chaves de armazenamento:** `acai_doce_sabor_seller_catalog_v1` (localStorage) e `acai_doce_sabor_seller_images` (IndexedDB).
- **Variáveis:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SELLER_EMAIL`.
- **Carga sob demanda:** o código do vendedor (telas, formulários, gravação) fica fora do pacote principal.

## Review Focus

1. **Carrinho antigo:** um item salvo antes do Completo (sem `complete`) continua igual, com a mesma cota.
2. **Tamanho trocado depois do Completo:** nada sai da montagem e o preço vira o do novo tamanho.
3. **Item ou complemento excluído ou esgotado:** sai do carrinho na revalidação, e o Completo não o marca.
4. **Supabase fora do ar ou com chave errada:** o site continua com o cardápio do código (e a última leitura guardada), sem erro na tela do cliente.
5. **Foto grande do celular (12 MP):** é reduzida antes de gravar, sem travar, e não passa de 800 px.

---

### Task 1: Regras do Completo

**Files:**
- Modify: `src/features/catalog/menu.ts`: `Product.completo?: true` nos 4 produtos; `Topping.available?: boolean`.
- Modify: `src/features/catalog/selection.ts`.
- Test: `src/features/catalog/completo.test.ts`.

**Interfaces (produz):**
- `Selection.complete?: boolean`
- `COMPLETE_GROUPS: readonly ToppingGroupId[]`
- `completeToppings(product): readonly Topping[]`: oferecidos pelo produto nos grupos do Completo, sem os esgotados.
- `applyComplete(product, selection): Selection`
- `clearToppings(selection): Selection`
- `settleComplete(product, selection): Selection`: desliga `complete` quando nenhum item do Completo sobra.
- `completeOmitted(product, selection): readonly Topping[]`
- `isCompleteFull(product, selection): boolean`
- `addBlocker` no Completo: grupos do Completo com no máximo 1, sem `free-limit` nem `group-limit`.
- `chooseSize` no Completo: não tira nada.
- `priceOf` no Completo: ignora o preço dos grupos do Completo.

- [ ] **Step 1: Testes que falham** (`completo.test.ts`):
  - Barca: 16 itens (13 adicionais e 3 frutas), nenhuma calda, sem cereja nem Kit Kat, preço 3000, falta a cobertura.
  - Oca pote 200 ml: 24 itens, total 1000.
  - Granola duas vezes: bloqueada (`item-max`). Kit Kat: soma 400.
  - Tirar a Farinha láctea: `completeOmitted` devolve [Farinha láctea], preço igual, os outros 23 continuam.
  - Trocar de tamanho no Completo: nada sai.
  - `clearToppings`: sem itens, `complete` falso, tamanho mantido.
  - Tirar tudo: `settleComplete` desliga.
  - Fora do Completo, a 3ª unidade grátis do pote de 200 ml continua bloqueada.
  - Esgotado (`available: false`): fica fora de `completeToppings`.
- [ ] **Step 2:** `npx vitest run src/features/catalog/completo.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** o mesmo comando, mais `npx vitest run` e `npx tsc -b`. Esperado: PASS.
- [ ] **Step 5:** Commit.

### Task 2: Completo no personalizador

**Files:**
- Modify: `configurator.ts` (ações `complete` e `clear`) e `messages.ts` (anúncios).
- Create: `src/features/configurator-core/CompleteBar.tsx`.
- Modify: `ToppingStep.tsx` (dicas de cota no Completo) e `OrderSummary.tsx` / `PreviewPanel.tsx` ("N itens selecionados" e a linha da Montagem).
- Test: `configurator.test.ts` e `messages.test.ts`.

- [ ] Testes do reducer: `complete` marca, `remove` com `settleComplete`, `clear` zera; anúncios "Completo aplicado: N itens marcados." e "Seleção limpa.".
- [ ] Implementar a barra só nos produtos com `completo`, acima do primeiro grupo de ingredientes. Botões com pelo menos 44 px de altura.
- [ ] `npx tsc -b; npx eslint .; npx vitest run`. Esperado: sem erros. Sonda no navegador da Barca.
- [ ] Commit.

### Task 3: Completo no carrinho, na confirmação e no WhatsApp

**Files:**
- Modify: `src/features/cart/cart.ts` (guardar e revalidar `complete`; `summarizeSelection` passa a ter `completo: { omitted: string[] } | null`), `confirmSummary.ts` (linha "Montagem"), `orderMessage.ts` ("• Montagem: …") e `CartPage.tsx`.
- Test: `cart.test.ts` e `orders.test.ts`.

- [ ] **Testes:**
  - o carrinho guarda e relê `complete`;
  - um item salvo sem `complete` continua igual;
  - a mensagem tem "• Montagem: COMPLETO (todos os acompanhamentos)" ou "• Montagem: COMPLETO (SEM: Farinha láctea)" antes das listas, e a Farinha láctea não aparece nelas.
- [ ] Implementar, rodar e fazer o commit.

### Task 4: Camada de mudanças do cardápio

**Files:**
- Create: `src/features/catalog/catalogChanges.ts` (tipos e `applyChanges`, puro).
- Create: `src/features/catalog/catalogStore.ts` (estado atual, `setChanges`, `subscribe`, versão).
- Create: `src/features/catalog/CatalogVersion.tsx` (contexto e `useCatalogVersion`).
- Modify:
  - `extras.ts`, `menu.ts` e `categories.ts`: dados como `export let` e funções de reatribuição;
  - `search.ts`, `highlights.ts` e `offerNotifications.ts`: tirar os cálculos feitos ao carregar o módulo;
  - componentes de página: `useCatalogVersion`.
- Test: `catalogChanges.test.ts`.

**Interfaces (produz):**
- `type CatalogChanges = { items: Record<string, ItemChange>; products: Record<string, ProductChange>; toppings: Record<string, ToppingChange> }`
- `ItemChange = Partial<{ name; description; priceCents; originalPriceCents: number | null; image; flavors: string[]; available; drawer; deleted }> & { new?: NewItemBase }`
- `applyChanges(base, changes)`: devolve itens, produtos e complementos novos, sem alterar a base.
- `setCatalogChanges(changes)`: aplica e avisa.
- `catalogVersion()`
- `BASE_*`: o cardápio original.

- [ ] **Testes:**
  - editar o preço e o nome de um item;
  - criar um item (com sabores vira `flavor_modal`; sem sabores, `direct_confirm`);
  - excluir e restaurar;
  - esgotar;
  - mudar o preço do tamanho do Oca;
  - o preço do Pote 1 L também muda o tamanho do personalizador;
  - complemento novo em `dry` entra no Completo; esgotado não entra; excluído some de `toppingsOf`;
  - busca e contagens da navegação seguem as mudanças;
  - o carrinho tira o item excluído e o esgotado.
- [ ] Implementar, rodar e fazer o commit.

### Task 5: Gravação local e sessão do vendedor

**Files:**
- Create: `src/services/sellerCatalogStore.ts` (interface `CatalogBackend` e `createLocalBackend(deps)` com localStorage, IndexedDB e senha em hash SHA-256).
- Create: `src/features/seller/SellerModeContext.tsx` (sessão, `active`, `backendKind`, ações).
- Test: `src/services/sellerCatalogStore.test.ts`, com armazenamento falso.

**Interfaces (produz):**
- `CatalogBackend = { kind: 'local' | 'supabase'; load(): Promise<CatalogChanges>; saveItem/saveProduct/saveTopping(id, change | null); uploadPhoto(blob): Promise<string>; signIn(password): Promise<boolean>; signOut(); changePassword(next): Promise<boolean>; isSignedIn(): boolean; exportBackup(): Promise<string>; importBackup(json): Promise<void> }`

- [ ] **Testes:**
  - a senha inicial entra e uma errada não;
  - trocar a senha;
  - gravar, ler e restaurar;
  - a foto é guardada e volta como URL;
  - backup e restauração ida e volta.
- [ ] Implementar, rodar e fazer o commit.

### Task 6: Acesso, senha e barra do vendedor

**Files:**
- Create em `src/features/seller/`: `SellerAccessButton.tsx` (rodapé da barra lateral e do menu do celular), `SellerAuthModal.tsx`, `SellerBar.tsx` (topo do `AppLayout`), `ChangePasswordModal.tsx` e `BackupModal.tsx`, todos carregados sob demanda.

- [ ] Implementar e conferir na sonda: senha errada mostra o aviso; a certa abre a barra; "Sair" fecha.
- [ ] Commit.

### Task 7: Editar e adicionar (formulário e foto)

**Files:**
- Create: `src/features/seller/SellerItemFormModal.tsx` (produto do catálogo, produto principal e complemento) e `src/features/seller/photo.ts` (`compressPhoto(file)` com `<canvas>`).
- Create: `SellerEditButton.tsx` e `SellerAddButton.tsx`.
- Modify: os cartões do catálogo e dos destaques, `MenuShowcase.tsx` e `ToppingStep.tsx` (botões e "Esgotado"), `CatalogSections.tsx` ("+ Adicionar produto") e `ToppingStep.tsx` ("+ Adicionar complemento").

- [ ] Implementar e conferir na sonda:
  - cadastrar "Picolé trufado" (foto, R$ 3,00, descrição);
  - editar um preço e ver no carrinho;
  - esgotar um item e ver o botão desligado.
- [ ] Commit.

### Task 8: Supabase

**Files:**
- Create: `src/services/supabaseRest.ts` (leitura pública; login, renovação, gravação, envio de foto e troca de senha).
- Create: `createSupabaseBackend` em `sellerCatalogStore.ts`, `supabase/setup.sql`, `.env.example` e `docs/supabase.md` (passo a passo para o responsável).
- Modify: `catalogStore`: leitura ao abrir, ao voltar para a aba e a cada 60 s, com cópia guardada.
- Test: `src/services/supabaseRest.test.ts`, com `fetch` falso (cabeçalhos, corpo, renovação do token e erros).

- [ ] Implementar, rodar e fazer o commit. Não dá para testar num projeto de verdade sem as chaves; dizer isso no fim.

### Task 9: Conferências e fechamento

- [ ] Novo `tests/browser/check-completo.mjs`: Barca, Pote 1 L e Oca; tirar a Farinha láctea; confirmação, carrinho e WhatsApp sem ela; Limpar.
- [ ] Novo `tests/browser/check-vendedor.mjs`, no modo local:
  - senha errada e certa;
  - cadastro do Picolé trufado com foto;
  - complemento novo no Completo;
  - preço editado no carrinho e no WhatsApp;
  - esgotado;
  - backup e restauração;
  - sair.
- [ ] As conferências antigas continuam passando.
- [ ] `npm run lint`, `npm test`, `npm run build`, commit, Obsidian e servidor no ar. Dizer onde colar a URL e a chave.
