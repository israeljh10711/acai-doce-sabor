# Três modalidades e GPS na entrega — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** O carrinho oferece Entrega (com GPS opcional), Retirar e Comer no Local, e a modalidade e o GPS chegam iguais à comanda do WhatsApp, à função `pedido` e à tabela `orders`.

**Architecture:** As regras ficam em módulos puros (`delivery.ts`, `gps.ts`, `orderMessage.ts`, `orderServer.ts`) usados pelo carrinho e pela função; a tela (`CheckoutPanel.tsx` e o novo `GpsLocation.tsx`) só mostra e chama essas regras. O banco recebe uma migração que estende as restrições existentes e acrescenta três colunas.

**Tech Stack:** React 19, TypeScript 6, Tailwind 4, motion (`m`, `AnimatePresence`), Vitest 5 (ambiente node), conferências no Edge sem janela (`tests/browser/lib.mjs`), Supabase (REST + Edge Function gerada por `vite.pedido.config.ts`).

**Spec:** `docs/superpowers/specs/2026-11-20-modalidades-e-gps-design.md`

## Global Constraints

- Valores da modalidade em todo lugar: `'entrega' | 'retirada' | 'local'` (tipo `DeliveryType` em `src/features/checkout/delivery.ts`).
- Textos fixos do pedido, exatamente: "Receber em casa", "Pegar na loja e levar", "Consumir na sorveteria", "📍 Usar minha localização atual", "Buscando sua localização...", "✅ Localização GPS anexada ao pedido", "Conferir pino no mapa", "Remover GPS", "Não foi possível obter sua localização automaticamente. Você pode preencher seu endereço manualmente abaixo.", "🛍️ Retirada no Balcão — Açaí Doce Sabor", "Faça seu pedido e retire diretamente na nossa loja.", "🍨 Consumo no Local — Vamos deixar tudo pronto!", "Assim que você enviar o pedido, já começamos a preparar para você só chegar e aproveitar.", "🗺️ Ver localização da sorveteria no Google Maps".
- Comanda: `• *Modalidade:* 🛵 Entrega em Domicílio` / `• *Modalidade:* 🛍️ Retirar no Local (Levar para casa)` / `• *Modalidade:* 🍨 COMER NO LOCAL (Deixar pronto para chegada)`; `• *Local de retirada:* …`; `• *Local:* …`; `• *Localização GPS:* https://www.google.com/maps?q=LAT,LNG`; `🛍️ *Retirada na loja:* Grátis (R$ 0,00)`; `🍨 *Consumo no local:* Grátis (R$ 0,00)`.
- Link do GPS: `https://www.google.com/maps?q=${lat},${lng}`; coordenadas com 6 casas.
- Endereço da loja só de `settings.contact`; links externos com `target="_blank" rel="noopener noreferrer"`.
- Nenhuma dependência nova. Nenhum `any`, nenhuma regra de lint desligada.
- GPS nunca guardado no `sessionStorage`, nunca pedido sem toque, nunca registrado em log.

## Review Focus

- Cliente troca Entrega → Retirar com bairro pago escolhido: o total cai para o subtotal na hora, e a comanda e a linha do banco saem com R$ 0,00 (Task 1 e Task 4).
- Resposta do Nominatim chega depois de "Remover GPS" ou de uma nova captura: é ignorada e não preenche nada (Task 2, `GpsLocation` usa o número da captura; teste no navegador da Task 5).
- Cliente já escreveu a rua e o GPS sugere outra: a rua escrita fica (Task 2, `addressPatch`).
- Pedido adulterado com `kind: 'local'` e GPS, ou latitude 200: a linha do banco sai sem GPS (Task 4).
- Página aberta por http na rede (sem contexto seguro): a mensagem amigável aparece e o pedido continua (Task 2, `locate`).

---

### Task 1: Modalidade `local` e GPS no rascunho do cliente

**Files:**
- Create: `src/features/checkout/gps.ts`
- Modify: `src/features/checkout/delivery.ts`, `src/features/store/storeSettings.ts`
- Test: `src/features/checkout/delivery.test.ts`, `src/features/checkout/gps.test.ts`

**Interfaces:**
- Produces (gps.ts): `type GpsPoint = { lat: number; lng: number }`; `parseGpsPoint(raw: unknown): GpsPoint | null` (finitos, intervalos, recusa (0,0), arredonda a 6 casas); `gpsMapsUrl(point: GpsPoint): string`.
- Produces (delivery.ts): `type DeliveryType = 'entrega' | 'retirada' | 'local'`; `CustomerDraft.kind: DeliveryType | null`, `CustomerDraft.gps: GpsPoint | null`; `DeliveryFee` ganha `{ kind: 'local' }`; `Fulfillment` = `{ kind: 'retirada' } | { kind: 'local' } | { kind: 'entrega'; street; number; district; reference; gps: GpsPoint | null }`; `draftForStorage(draft): CustomerDraft` (gps null); problema de `kind`: "Escolha entrega, retirada ou comer no local.".
- Produces (storeSettings.ts): `storePlaceText(contact: StoreContact): string` → "Rua Francisco Tota, 12 — Teixeira, PB".

- [x] Testes: `local` grátis sem endereço; GPS mantido só na entrega; `parseCustomerDraft` aceita `local` e GPS válido e descarta GPS inválido; `parseGpsPoint` (finito, intervalos, (0,0), strings, arredondamento); `gpsMapsUrl`; `storePlaceText`; `draftForStorage` apaga o GPS.
- [x] Rodar e ver falhar; implementar; rodar e ver passar; ajustar os testes antigos que mudaram de texto.

### Task 2: Captura e endereço sugerido

**Files:**
- Modify: `src/features/checkout/gps.ts`
- Test: `src/features/checkout/gps.test.ts`

**Interfaces:**
- Produces: `type LocateResult = { ok: true; point: GpsPoint } | { ok: false; why: 'sem-suporte' | 'inseguro' | 'negado' | 'indisponivel' | 'tempo' }`; `locate(geo: Pick<Geolocation, 'getCurrentPosition'> | undefined, secure: boolean): Promise<LocateResult>` com `{ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }`; `GPS_ERROR_TEXT`; `type AddressGuess = { street: string | null; number: string | null; district: string | null }`; `nominatimUrl(point)`; `parseNominatim(body: unknown): AddressGuess | null`; `reverseGeocode(point, fetchImpl, timeoutMs = 6000): Promise<AddressGuess | null>` (nunca lança); `addressPatch(draft: CustomerDraft, guess: AddressGuess, zones: readonly DeliveryZone[]): Partial<CustomerDraft>`.

- [x] Testes com geolocalização falsa: sucesso, negado (code 1), indisponível (2), tempo (3), sem API, sem contexto seguro, posição com coordenada inválida. Nominatim falso: resposta boa, HTTP 500, rede caída, tempo, JSON sem endereço. `addressPatch`: preenche só vazio, escolhe bairro da lista por nome sem acento, não escolhe sem bairro igual, preenche o bairro escrito sem lista.
- [x] Ver falhar; implementar; ver passar.

### Task 3: Comanda das três modalidades

**Files:**
- Modify: `src/features/orders/orderMessage.ts`
- Test: `src/features/orders/orders.test.ts`, `src/features/cart/cartCompleto.test.ts` (se o texto mudar)

**Interfaces:**
- Consumes: `Fulfillment`, `DeliveryFee`, `gpsMapsUrl`, `storePlaceText`, `getStoreSettings()` (catalogState).

- [x] Testes: linhas exatas das três modalidades; GPS só na entrega com GPS; retirada e local sem endereço nem GPS; endereço da loja vindo de "Horários e Contato" mudado; link do WhatsApp com emojis, acentos e quebras de linha voltando iguais e codificados uma vez só, para 5583996999980.
- [x] Ver falhar; implementar; ver passar.

### Task 4: Banco e função `pedido`

**Files:**
- Create: `supabase/migrations/20261120120000_modalidades_gps.sql`
- Modify: `src/server/orderServer.ts`, `supabase/functions/pedido/index.ts` (gerado por `npm run build:pedido`)
- Test: `src/server/orderServer.test.ts`, `tests/browser/check-pedido.mjs`

**Interfaces:**
- Produces: `OrderRow.fulfillment: DeliveryType`, `OrderRow.delivery_fee` com `'local'`, `customer_lat: number | null`, `customer_lng: number | null`, `maps_url: string | null`.

- [x] Testes: linha de cada modalidade; GPS gravado com o link; GPS adulterado em `local`/`retirada` vira nulo; latitude inválida vira nula; `local` com bairro pago enviado junto sai com frete 0; GPS diferente é outra tentativa.
- [x] Migração: estender `fulfillment` e `delivery_fee`, colunas `if not exists`, restrições de coerência, sem apagar nada, numa transação.
- [x] `npm run build:pedido`; `check:pedido` com um pedido "Comer no Local" e uma entrega com GPS gravados no Supabase de mentira.

### Task 5: Carrinho

**Files:**
- Create: `src/features/checkout/GpsLocation.tsx`, `tests/browser/check-modalidades.mjs`
- Modify: `src/features/checkout/CheckoutPanel.tsx`, `tests/browser/check-operacao.mjs`, `package.json` (script `check:modalidades`)

- [x] Três cartões (3 lado a lado a partir de 360 px, um por linha abaixo), com os ícones do site; entrega com GPS + campos; cartões de Retirar e Comer no Local com o endereço e o link; resumo com "Retirada na loja" / "Consumo no local".
- [x] `GpsLocation`: estados inicial, carregando (desativado, `aria-busy`), sucesso (selo, link, remover), erro (mensagem amigável); número da captura para ignorar respostas velhas.
- [x] Conferência no navegador (1280, 390 e 320 px): seleção, campos, cartões, links, frete e total, GPS com geolocalização e Nominatim falsos, remover, negado, comanda das três modalidades, sem rolagem lateral.

### Task 6: Documentação e validação final

- [x] `docs/supabase.md` (passo novo, colunas, regras, pedidos antigos, ordem de publicação); notas do Obsidian.
- [x] `npm test`, `npm run lint`, `npm run build`, conferências no navegador; servidor de desenvolvimento ativo.
