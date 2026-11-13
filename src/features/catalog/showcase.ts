/**
 * Montagens de exemplo da vitrine (página inicial e cardápio). São pedidos possíveis de verdade:
 * os testes conferem que cada um respeita as regras do cardápio (tamanho, limite grátis, sabor).
 * A foto de cada cartão é o compositor montando esse pedido.
 */
import type { ComposerInput } from '../photo-composer/layout.ts'
import type { CategorySlug } from './categories.ts'
import { PRODUCTS } from './menu.ts'

export const SHOWCASE: Readonly<Record<CategorySlug, ComposerInput>> = {
  // Isopor visto de cima, em setores, como a foto de referência do proprietário.
  'acai-oca': {
    slug: 'acai-oca',
    sizeId: 'isopor-gg',
    flavorId: null,
    toppings: { morango: 1, amendoim: 1, banana: 1, chocoball: 1, granola: 1, 'calda-leite-condensado': 1, 'creme-de-ninho': 1 },
  },
  'acai-tradicional': {
    slug: 'acai-tradicional',
    sizeId: 'copo-500',
    flavorId: null,
    toppings: { granola: 2, banana: 1, morango: 1, 'calda-leite-condensado': 1 },
  },
  'acai-batido': {
    slug: 'acai-batido',
    sizeId: '500-ml',
    flavorId: 'leite-condensado-pacoca',
    toppings: { 'batido-creme-de-avela': 1 },
  },
  'milk-shake': {
    slug: 'milk-shake',
    sizeId: '500-ml',
    flavorId: 'morango',
    toppings: { 'calda-chocolate': 1, cereja: 1 },
  },
}

/** Menor preço da categoria: o "a partir de" dos cartões. */
export function startingPriceCents(slug: CategorySlug): number {
  return Math.min(...PRODUCTS[slug].sizes.map((size) => size.priceCents))
}
