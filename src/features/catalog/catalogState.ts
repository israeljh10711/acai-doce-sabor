/**
 * O cardápio em uso, sem React. O site usa por `catalogStore.ts` (que junta os ganchos do React); a
 * função do pedido no servidor usa direto, para conferir os preços com as mesmas regras.
 *
 * Desde o cardápio dinâmico (2026-11-21), o cardápio vem dos **registros do banco**
 * (`setCatalogRecords`): no Supabase, `catalogo_publico()`; na demonstração, os registros do
 * aparelho. As **Configurações da loja** continuam vindo das mudanças (`catalog_changes`,
 * `settings/loja`). Sem registros (antes da primeira leitura, nos testes antigos e na função do
 * pedido até a Parte 3), vale o cardápio do código com as mudanças antigas por cima.
 *
 * Ao trocar, os dados que todo o código importa (`EXTRA_ITEMS`, `TOPPINGS`, `PRODUCTS`,
 * `CATEGORIES`, `DRAWERS`, `TOPPING_GROUPS`) são substituídos (ligações vivas de ES modules) e quem
 * ouve é avisado.
 */
import { BASE_CATEGORIES, setCategories } from './categories.ts'
import { type CatalogChanges, type CatalogData, NO_CHANGES, STORE_SETTINGS_ID, applyChanges } from './catalogChanges.ts'
import { type StoreSettings, type StoreSettingsChange, resolveStoreSettings } from '../store/storeSettings.ts'
import { BASE_MONTE_TITLE, setMonteTitle } from './catalogNav.ts'
import { BASE_DRAWERS, BASE_EXTRA_ITEMS, setDrawers, setExtraItems } from './extras.ts'
import { BASE_PRODUCTS, BASE_TOPPING_GROUPS, BASE_TOPPINGS, setProducts, setToppingGroups, setToppings } from './menu.ts'
import type { CatalogRecords } from './records.ts'
import { type LiveOffer, recordsToCatalog } from './recordsAdapter.ts'

const BASE: CatalogData = {
  items: BASE_EXTRA_ITEMS,
  toppings: BASE_TOPPINGS,
  products: BASE_PRODUCTS,
  categories: BASE_CATEGORIES,
  drawers: BASE_DRAWERS,
  groupTitles: {},
}

/** Situação da leitura do cardápio: o site só mostra o cardápio com `ready`. */
export type CatalogStatus = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string }

let changes: CatalogChanges = NO_CHANGES
let records: CatalogRecords | null = null
let status: CatalogStatus = { state: 'ready' }
let offers: readonly LiveOffer[] = []
/** Hora fixa das ofertas (a função do pedido usa a hora dela); `null`: a hora de agora. */
let clock: number | null = null
/** Fotos guardadas no aparelho (`idb:<id>`) e o endereço temporário (`blob:`) de cada uma. */
let photoUrls: Readonly<Record<string, string>> = {}
let version = 0
const listeners = new Set<() => void>()

/**
 * Troca `idb:<id>` pelo endereço da foto já carregada. Enquanto ela não carrega, a mudança fica
 * sem a foto (aparece a do código, ou nenhuma no item novo).
 */
function withPhotos(source: CatalogChanges): CatalogChanges {
  const resolve = <T extends { image?: string }>(entries: Readonly<Record<string, T>>): Record<string, T> =>
    Object.fromEntries(
      Object.entries(entries).map(([id, change]) => {
        if (!change.image?.startsWith('idb:')) return [id, change]
        const url = photoUrls[change.image]
        const next = { ...change }
        if (url) next.image = url
        else delete next.image
        return [id, next]
      }),
    )
  return {
    items: resolve(source.items),
    products: resolve(source.products),
    toppings: resolve(source.toppings),
    sections: source.sections,
    settings: source.settings,
  }
}

/** Fotos do aparelho (`idb:`) nos registros da demonstração: o endereço carregado, ou nenhuma. */
function photoOf(image: string): string {
  if (!image.startsWith('idb:')) return image
  return photoUrls[image] ?? ''
}

function fromRecords(source: CatalogRecords): CatalogData & { groups: typeof BASE_TOPPING_GROUPS; offers: readonly LiveOffer[] } {
  const data = recordsToCatalog(source, { now: clock ?? Date.now() })
  const hasLocal = (image: string | undefined) => image?.startsWith('idb:') === true
  return {
    ...data,
    groups: data.groups as typeof BASE_TOPPING_GROUPS,
    items: data.items.map((item) => (hasLocal(item.image) ? { ...item, image: photoOf(item.image) } : item)),
    toppings: data.toppings.map((topping) => {
      if (!hasLocal(topping.image)) return topping
      const image = photoOf(topping.image!)
      const { image: _old, ...rest } = topping
      void _old
      return image ? { ...rest, image } : rest
    }),
    categories: data.categories.map((category) => {
      if (!hasLocal(category.photo)) return category
      const photo = photoOf(category.photo!)
      const { photo: _old, ...rest } = category
      void _old
      return photo ? { ...rest, photo } : rest
    }),
  }
}

function publish() {
  const data = records ? fromRecords(records) : { ...applyChanges(BASE, withPhotos(changes)), groups: BASE_TOPPING_GROUPS, offers: [] }
  setToppingGroups(data.groups)
  setExtraItems(data.items)
  setToppings(data.toppings)
  setProducts(data.products)
  setCategories(data.categories)
  setDrawers(data.drawers)
  setMonteTitle(data.groupTitles.monte ?? BASE_MONTE_TITLE)
  offers = data.offers
  version += 1
  for (const listener of listeners) listener()
}

/** As mudanças em uso (as guardadas, com `idb:` nas fotos do aparelho). */
export function getCatalogChanges(): CatalogChanges {
  return changes
}

/**
 * Troca as mudanças guardadas. Com registros do banco em uso, só as Configurações da loja valem;
 * sem eles, as mudanças antigas valem também para o cardápio (o caminho de antes).
 */
export function setCatalogChanges(next: CatalogChanges): void {
  changes = next
  publish()
}

/** O cardápio do banco em uso (`null` antes da primeira leitura). */
export function getCatalogRecords(): CatalogRecords | null {
  return records
}

/** Aplica o cardápio do banco em todo o site e avisa a tela. */
export function setCatalogRecords(next: CatalogRecords | null): void {
  records = next
  if (next) status = { state: 'ready' }
  publish()
}

/**
 * O cardápio da função do pedido (2026-11-21): as configurações (catalog_changes), os registros do
 * banco e a hora do servidor, aplicados juntos (uma publicação só).
 */
export function setCatalogSnapshot(nextChanges: CatalogChanges, nextRecords: CatalogRecords, now: number): void {
  changes = nextChanges
  records = nextRecords
  clock = now
  status = { state: 'ready' }
  publish()
}

/** Calcula de novo com a hora de agora (ofertas que começam ou acabam). */
export function refreshCatalogClock(): void {
  if (records) publish()
}

export function getCatalogStatus(): CatalogStatus {
  return status
}

/** Muda a situação da leitura (carregando ou erro) e avisa a tela. */
export function setCatalogStatus(next: CatalogStatus): void {
  if (JSON.stringify(next) === JSON.stringify(status)) return
  status = next
  version += 1
  for (const listener of listeners) listener()
}

/** Ofertas valendo agora (do banco), na ordem do vendedor. */
export function getLiveOffers(): readonly LiveOffer[] {
  return offers
}

/** Endereços das fotos guardadas no aparelho, quando terminam de carregar. */
export function setPhotoUrls(next: Readonly<Record<string, string>>): void {
  photoUrls = next
  publish()
}

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function catalogVersion(): number {
  return version
}

let settingsCache: { source: StoreSettingsChange | undefined; value: StoreSettings } | null = null

/**
 * Configurações da loja em uso (pedido de 2026-11-17): o padrão com o que o vendedor mudou por
 * cima. A mesma referência enquanto a mudança guardada não muda (para `useSyncExternalStore`).
 */
export function getStoreSettings(): StoreSettings {
  const source = changes.settings[STORE_SETTINGS_ID]
  if (!settingsCache || settingsCache.source !== source) settingsCache = { source, value: resolveStoreSettings(source) }
  return settingsCache.value
}
