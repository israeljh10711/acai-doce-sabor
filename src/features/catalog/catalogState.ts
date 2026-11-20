/**
 * O cardápio em uso, sem React (pedido de 2026-11-17): o do código com as mudanças do vendedor por
 * cima. O site usa por `catalogStore.ts` (que junta os ganchos do React); a função do pedido no
 * servidor usa direto, para conferir os preços com as mesmas regras.
 *
 * Ao trocar as mudanças, os dados que todo o código importa (`EXTRA_ITEMS`, `TOPPINGS`, `PRODUCTS`,
 * `CATEGORIES`) são substituídos (ligações vivas de ES modules) e quem ouve é avisado.
 */
import { BASE_CATEGORIES, setCategories } from './categories.ts'
import { type CatalogChanges, NO_CHANGES, STORE_SETTINGS_ID, applyChanges } from './catalogChanges.ts'
import { type StoreSettings, type StoreSettingsChange, resolveStoreSettings } from '../store/storeSettings.ts'
import { BASE_MONTE_TITLE, setMonteTitle } from './catalogNav.ts'
import { BASE_DRAWERS, BASE_EXTRA_ITEMS, setDrawers, setExtraItems } from './extras.ts'
import { BASE_PRODUCTS, BASE_TOPPINGS, setProducts, setToppings } from './menu.ts'

const BASE = {
  items: BASE_EXTRA_ITEMS,
  toppings: BASE_TOPPINGS,
  products: BASE_PRODUCTS,
  categories: BASE_CATEGORIES,
  drawers: BASE_DRAWERS,
  groupTitles: {},
}

let changes: CatalogChanges = NO_CHANGES
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

function publish() {
  const data = applyChanges(BASE, withPhotos(changes))
  setExtraItems(data.items)
  setToppings(data.toppings)
  setProducts(data.products)
  setCategories(data.categories)
  setDrawers(data.drawers)
  setMonteTitle(data.groupTitles.monte ?? BASE_MONTE_TITLE)
  version += 1
  for (const listener of listeners) listener()
}

/** As mudanças em uso (as guardadas, com `idb:` nas fotos do aparelho). */
export function getCatalogChanges(): CatalogChanges {
  return changes
}

/** Aplica as mudanças em todo o site e avisa a tela. */
export function setCatalogChanges(next: CatalogChanges): void {
  changes = next
  publish()
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
