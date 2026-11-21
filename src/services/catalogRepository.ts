/**
 * De onde vem o cardápio (cardápio dinâmico, 2026-11-21):
 * - **Supabase**: `catalogo_publico()`, conferido por `parseCatalogRecords`. Se a busca falha ou
 *   vem fora do formato, o erro sobe: o site mostra o aviso e "Tentar de novo", e nunca troca em
 *   silêncio pelo cardápio do código.
 * - **Local** (modo de demonstração, sem Supabase): os registros guardados no aparelho ou, sem
 *   eles, a semente tirada do cardápio do código.
 *
 * A tela e a função do pedido só conhecem esta interface; a conversão para o cardápio da tela fica
 * em `recordsAdapter.ts`.
 */
import { baseCatalogRecords } from '../features/catalog/baseRecords.ts'
import { type CatalogRecords, parseCatalogRecords, toRow } from '../features/catalog/records.ts'

export type CatalogRepository = {
  readonly kind: 'supabase' | 'local'
  /** O cardápio inteiro. Lança erro quando não dá para ler. */
  load(): Promise<CatalogRecords>
}

export function createSupabaseCatalogRepository(rest: { readCatalog(): Promise<unknown> }): CatalogRepository {
  return {
    kind: 'supabase',
    async load() {
      return parseCatalogRecords(await rest.readCatalog())
    },
  }
}

/** Chave dos registros do cardápio no aparelho (modo de demonstração). */
export const LOCAL_CATALOG_KEY = 'acai_doce_sabor_catalogo_v2'

/** Os registros no formato do banco (o mesmo que `catalogo_publico()` devolve). */
export function recordsToDatabase(records: CatalogRecords): Record<string, unknown> {
  return {
    revision: records.revision,
    categories: records.categories.map(toRow),
    products: records.products.map(toRow),
    variants: records.variants.map(toRow),
    choices: records.choices.map(toRow),
    choice_options: records.choiceOptions.map(toRow),
    groups: records.groups.map(toRow),
    options: records.options.map(toRow),
    product_groups: records.productGroups.map(toRow),
    offers: records.offers.map(toRow),
  }
}

export type LocalCatalogRepository = CatalogRepository & {
  readonly kind: 'local'
  /** O mesmo que `load`, na hora (o aparelho responde sem esperar). */
  loadSync(): CatalogRecords
}

export function createLocalCatalogRepository(store: Pick<Storage, 'getItem'> | null): LocalCatalogRepository {
  const loadSync = (): CatalogRecords => {
    const read = () => {
      try {
        return store?.getItem(LOCAL_CATALOG_KEY) ?? null
      } catch {
        return null
      }
    }
    const raw = read()
    // Guardado no aparelho e estragado: erro (a tela mostra), em vez de apagar o que o vendedor fez.
    return raw === null ? baseCatalogRecords() : parseCatalogRecords(JSON.parse(raw))
  }
  return {
    kind: 'local',
    loadSync,
    async load() {
      return loadSync()
    },
  }
}
