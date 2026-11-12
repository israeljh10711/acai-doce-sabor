/**
 * Monta a lista do que a ilustração desenha, a partir do produto e da escolha.
 *
 * Regra do projeto: a ilustração mostra somente o que o cliente escolheu.
 * Esta função é o único lugar que decide isso, e é coberta por testes.
 */
import type { CategorySlug } from '../categories.ts'
import { PRODUCTS, TOPPINGS } from '../menu.ts'
import {
  ACAI_COLORS,
  type BaseColors,
  type ContainerShape,
  FLAVOR_COLORS,
  LAYER_ORDER,
  SHAKE_NEUTRAL,
  TOPPING_LOOKS,
  type ToppingLook,
  shapeFor,
} from './looks.ts'

export type IllustrationInput = {
  slug: CategorySlug
  sizeId: string | null
  flavorId: string | null
  toppings: Readonly<Record<string, number>>
}

export type ToppingLayer = {
  toppingId: string
  look: ToppingLook
  quantity: number
}

export type Illustration = {
  shape: ContainerShape
  /** Sem tamanho escolhido: recipiente vazio, em contorno. */
  empty: boolean
  base: BaseColors | null
  /** De baixo para cima. */
  layers: ToppingLayer[]
}

function baseFor(slug: CategorySlug, flavorId: string | null): BaseColors {
  if (slug !== 'milk-shake') return ACAI_COLORS
  return flavorId && Object.hasOwn(FLAVOR_COLORS, flavorId) ? FLAVOR_COLORS[flavorId] : SHAKE_NEUTRAL
}

export function composeIllustration(input: IllustrationInput): Illustration {
  const product = PRODUCTS[input.slug]
  const size = product.sizes.find((candidate) => candidate.id === input.sizeId)

  if (!size) {
    // Todo tamanho tem forma; os testes garantem.
    const shape = shapeFor(input.slug, product.sizes[0].id) as ContainerShape
    return { shape, empty: true, base: null, layers: [] }
  }

  const layers = TOPPINGS.filter(
    (topping) =>
      product.groups.includes(topping.group) &&
      (input.toppings[topping.id] ?? 0) > 0 &&
      Object.hasOwn(TOPPING_LOOKS, topping.id),
  )
    .map((topping) => ({
      toppingId: topping.id,
      look: TOPPING_LOOKS[topping.id],
      quantity: input.toppings[topping.id],
    }))
    // A ordenação do JavaScript é estável: dentro do mesmo tipo, fica a ordem do cardápio.
    .sort((a, b) => LAYER_ORDER.indexOf(a.look.kind) - LAYER_ORDER.indexOf(b.look.kind))

  return {
    shape: shapeFor(input.slug, size.id) as ContainerShape,
    empty: false,
    base: baseFor(input.slug, input.flavorId),
    layers,
  }
}
