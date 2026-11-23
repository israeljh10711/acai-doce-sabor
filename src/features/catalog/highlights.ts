/**
 * Faixa "Mais pedidos & ofertas do dia" (pedido de 2026-11-16): os 5 carros-chefes do catálogo,
 * logo no início do cardápio. Nome, preço e preço riscado vêm do próprio item.
 */
import { type Category, findCategoryBySlug } from './categories.ts'
import { type ExtraItem, getExtraItem } from './extras.ts'
import type { SearchResult } from './search.ts'

/**
 * Os carros-chefes da loja (pedido de 2026-11-23): vão na frente da faixa, antes dos potes, da
 * barca e dos combos. Continuam também nos cartões de cada categoria, mais abaixo.
 */
export const FLAGSHIP_SLUGS = ['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'] as const

/** Os carros-chefes que existem no cardápio (o vendedor pode ter arquivado algum) ou, na busca, só os encontrados. */
export function highlightProducts(result: SearchResult): readonly Category[] {
  const found = result.query === '' ? null : new Set<string>(result.main)
  return FLAGSHIP_SLUGS.flatMap((slug) => {
    const category = findCategoryBySlug(slug)
    return category && (!found || found.has(slug)) ? [category] : []
  })
}

export const HIGHLIGHT_IDS = [
  'pote-de-acai-1-litro',
  'barca-de-acai',
  'kit-completo-casquinha',
  'combo-1-litro',
  'pote-de-acai-2-litros',
] as const

/** Os 5 destaques (os que o vendedor não excluiu) ou, na busca, só os encontrados. */
export function highlightItems(result: SearchResult): readonly ExtraItem[] {
  const highlights = HIGHLIGHT_IDS.flatMap((id) => {
    const item = getExtraItem(id)
    return item ? [item] : []
  })
  if (result.query === '') return highlights
  const found = new Set([...result.drawers.values()].flat().map((item) => item.id))
  return highlights.filter((item) => found.has(item.id))
}
