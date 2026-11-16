/**
 * O que o cabeçalho do personalizador mostra de cada produto: resumo, selos, preço riscado e o
 * endereço de volta ao cardápio. Os produtos das gavetas (Pote 1 L Montado, Barca) usam os
 * textos do item da gaveta e voltam para ela.
 */
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { findCategoryBySlug } from './categories.ts'
import { drawerById, extraForProduct } from './extras.ts'
import type { ExtraProductSlug, ProductSlug } from './menu.ts'

export type ProductInfo = {
  summary: string
  badges: readonly string[]
  /** "De R$ 33,00 por R$ 30,00", quando há preço anterior. */
  priceNote: string | null
  /** Volta ao cardápio, na gaveta do produto quando ele vem de uma. */
  menuPath: string
  /** Endereço depois de "Adicionar e continuar comprando". */
  continuePath: string
}

export function productInfo(slug: ProductSlug): ProductInfo {
  const category = findCategoryBySlug(slug)
  if (category) {
    return {
      summary: category.summary,
      badges: category.badges,
      priceNote: null,
      menuPath: paths.buildOrder,
      continuePath: paths.buildOrder,
    }
  }
  const extra = extraForProduct(slug as ExtraProductSlug)
  const menuPath = `${paths.buildOrder}#${drawerById(extra.drawer).anchor}`
  return {
    summary: extra.description,
    badges: extra.badge ? [extra.badge] : [],
    priceNote: extra.originalPriceCents
      ? `De ${formatBRL(extra.originalPriceCents)} por ${formatBRL(extra.priceCents)}`
      : null,
    menuPath,
    continuePath: menuPath,
  }
}
