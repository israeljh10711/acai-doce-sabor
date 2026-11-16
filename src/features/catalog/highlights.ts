/**
 * Faixa "Mais pedidos & ofertas do dia" (pedido de 2026-11-16): os 5 carros-chefes do catálogo,
 * logo no início do cardápio. Nome, preço e preço riscado vêm do próprio item.
 */
import { type ExtraItem, getExtraItem } from './extras.ts'
import type { SearchResult } from './search.ts'

export const HIGHLIGHT_IDS = [
  'pote-de-acai-1-litro',
  'barca-de-acai',
  'kit-completo-casquinha',
  'combo-1-litro',
  'pote-de-acai-2-litros',
] as const

const HIGHLIGHTS: readonly ExtraItem[] = HIGHLIGHT_IDS.map((id) => getExtraItem(id)!)

/** Os 5 destaques ou, na busca, só os encontrados. */
export function highlightItems(result: SearchResult): readonly ExtraItem[] {
  if (result.query === '') return HIGHLIGHTS
  const found = new Set([...result.drawers.values()].flat().map((item) => item.id))
  return HIGHLIGHTS.filter((item) => found.has(item.id))
}
