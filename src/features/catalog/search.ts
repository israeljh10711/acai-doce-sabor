/**
 * Busca do cardápio (pedido de 2026-11-15): os 4 produtos principais e os itens das 5 gavetas.
 *
 * - Ignora acentos e maiúsculas: "acai" acha "Açaí", "picole" acha "Picolé".
 * - Cada item tem os seus textos de busca: nome, descrição, palavras-chave (com os sinônimos do
 *   pedido: "dindin", "refri", "cascão"...), sabores e, nos produtos principais, tamanhos e
 *   ingredientes. Um item aparece quando a frase digitada começa uma palavra de algum desses
 *   textos ("refri" acha "refrigerante", "casquinha" acha "casquinhas").
 * - Várias palavras sem número também valem soltas, cada uma em qualquer texto do item
 *   ("sorvete chocolate"). Com número, só a frase inteira: "1 litro" não acha "1,5 litro" nem
 *   "2 litros + 1 cobertura".
 */
import { foldText } from '../../utils/text.ts'
import { CATEGORIES, type CategorySlug } from './categories.ts'
import { DRAWERS, type DrawerId, EXTRA_ITEMS, type ExtraItem, choiceGroupsOf, drawerById } from './extras.ts'
import { PRODUCTS, toppingsOf } from './menu.ts'

/** Texto pronto para comparar: sem acentos, minúsculo, só letras, números e o ponto de "1.5". */
export function normalizeSearch(text: string): string {
  return foldText(text)
    .replace(/['’`´]/g, '')
    .replace(/(\d)[.,](?=\d)/g, '$1.')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\.(?!\d)|(?<!\d)\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A frase (já normalizada) aparece no começo de uma palavra de algum texto do item? */
export function matchesQuery(fields: readonly string[], query: string): boolean {
  if (!query) return true
  const padded = fields.map((field) => ` ${field}`)
  if (padded.some((field) => field.includes(` ${query}`))) return true
  const words = query.split(' ')
  if (words.length < 2 || words.some((word) => /\d/.test(word))) return false
  return words.every((word) => padded.some((field) => field.includes(` ${word}`)))
}

const fieldsOf = (texts: readonly string[]) => texts.map(normalizeSearch).filter(Boolean)

const MAIN_FIELDS: ReadonlyMap<CategorySlug, readonly string[]> = new Map(
  CATEGORIES.map((category) => {
    const product = PRODUCTS[category.slug]
    return [
      category.slug,
      fieldsOf([
        category.name,
        category.tagline,
        category.summary,
        ...category.keywords,
        ...product.sizes.map((size) => size.name),
        ...product.flavors.map((flavor) => flavor.name),
        ...product.groups.flatMap((group) => toppingsOf(product, group).map((topping) => topping.name)),
      ]),
    ] as const
  }),
)

const EXTRA_FIELDS: ReadonlyMap<string, readonly string[]> = new Map(
  EXTRA_ITEMS.map((item) => [
    item.id,
    fieldsOf([
      item.name,
      item.description,
      ...item.keywords,
      ...drawerById(item.drawer).keywords,
      ...choiceGroupsOf(item).flatMap((group) => group.options),
    ]),
  ]),
)

export type SearchResult = {
  /** A busca normalizada. Vazia: mostra tudo. */
  query: string
  /** Produtos principais encontrados, na ordem da vitrine. */
  main: readonly CategorySlug[]
  /** Itens encontrados de cada gaveta (só as gavetas com resultado), na ordem do cardápio. */
  drawers: ReadonlyMap<DrawerId, readonly ExtraItem[]>
  total: number
}

export function searchMenu(rawQuery: string): SearchResult {
  const query = normalizeSearch(rawQuery)
  const main = CATEGORIES.map((category) => category.slug).filter((slug) => matchesQuery(MAIN_FIELDS.get(slug)!, query))
  const drawers = new Map<DrawerId, readonly ExtraItem[]>()
  for (const drawer of DRAWERS) {
    const items = EXTRA_ITEMS.filter((item) => item.drawer === drawer.id && matchesQuery(EXTRA_FIELDS.get(item.id)!, query))
    if (items.length > 0) drawers.set(drawer.id, items)
  }
  const total = main.length + [...drawers.values()].reduce((sum, items) => sum + items.length, 0)
  return { query, main, drawers, total }
}
