import type { CategorySlug } from './categories.ts'
import { PRODUCTS } from './menu.ts'

/** Menor preço da categoria: o "a partir de" dos cartões. */
export function startingPriceCents(slug: CategorySlug): number {
  return Math.min(...PRODUCTS[slug].sizes.map((size) => size.priceCents))
}
