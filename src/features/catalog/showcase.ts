/**
 * Montagens de exemplo, ilustradas nos cartões das categorias.
 * São montadas pelas mesmas regras do personalizador: um item que as regras
 * recusassem não apareceria, e o teste acusaria.
 */
import type { CategorySlug } from './categories.ts'
import type { IllustrationInput } from './illustration/compose.ts'
import { PRODUCTS } from './menu.ts'
import { EMPTY_SELECTION, addTopping, chooseFlavor, chooseSize } from './selection.ts'

type ShowcasePick = {
  sizeId: string
  flavorId: string | null
  toppings: string[]
  title: string
}

export const SHOWCASE_PICKS: Readonly<Record<CategorySlug, ShowcasePick>> = {
  'acai-oca': {
    sizeId: 'isopor-g',
    flavorId: null,
    toppings: ['amendoim', 'chocoball', 'banana', 'morango', 'calda-chocolate'],
    title:
      'Ilustração de açaí Oca no isopor G, com amendoim, chocoball, banana, morango e cobertura de chocolate',
  },
  'acai-tradicional': {
    sizeId: 'copo-500',
    flavorId: null,
    toppings: ['granola', 'banana', 'morango', 'calda-leite-condensado', 'creme-de-ninho'],
    title:
      'Ilustração de açaí Tradicional no copo de 500 ml, com granola, banana, morango, cobertura de leite condensado e creme de ninho',
  },
  'milk-shake': {
    sizeId: '500-ml',
    flavorId: 'morango',
    toppings: ['calda-chocolate', 'cereja'],
    title: 'Ilustração de milk-shake de morango de 500 ml, com cobertura de chocolate e cereja',
  },
}

export function showcaseOf(slug: CategorySlug): IllustrationInput & { title: string } {
  const product = PRODUCTS[slug]
  const pick = SHOWCASE_PICKS[slug]

  let selection = chooseSize(product, EMPTY_SELECTION, pick.sizeId).selection
  if (pick.flavorId) selection = chooseFlavor(product, selection, pick.flavorId)
  for (const id of pick.toppings) selection = addTopping(product, selection, id)

  return {
    slug,
    sizeId: selection.sizeId,
    flavorId: selection.flavorId,
    toppings: selection.toppings,
    title: pick.title,
  }
}
