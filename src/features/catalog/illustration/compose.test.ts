import { describe, expect, it } from 'vitest'
import { PRODUCTS, TOPPINGS } from '../menu.ts'
import { type IllustrationInput, composeIllustration } from './compose.ts'
import {
  ACAI_COLORS,
  FLAVOR_COLORS,
  LAYER_ORDER,
  SHAKE_NEUTRAL,
  TOPPING_LOOKS,
  shapeFor,
} from './looks.ts'

const acai = (sizeId: string | null, toppings: Record<string, number> = {}): IllustrationInput => ({
  slug: 'acai-tradicional',
  sizeId,
  flavorId: null,
  toppings,
})

describe('composeIllustration', () => {
  it('sem tamanho, mostra o recipiente vazio do primeiro tamanho, sem base e sem ingredientes', () => {
    const result = composeIllustration(acai(null, { granola: 1 }))

    expect(result.empty).toBe(true)
    expect(result.base).toBeNull()
    expect(result.layers).toEqual([])
    expect(result.shape).toEqual(shapeFor('acai-tradicional', 'pote-150'))
  })

  it('mostra só os ingredientes escolhidos', () => {
    const result = composeIllustration(acai('copo-500', { granola: 2, banana: 1, 'kit-kat': 1 }))

    expect(result.empty).toBe(false)
    expect(result.layers.map((layer) => layer.toppingId).sort()).toEqual(['banana', 'granola', 'kit-kat'])
    expect(result.layers.find((layer) => layer.toppingId === 'granola')?.quantity).toBe(2)
  })

  it('ignora ingredientes desconhecidos ou com quantidade zero', () => {
    const result = composeIllustration(acai('copo-500', { pizza: 1, granola: 0, banana: 1 }))

    expect(result.layers.map((layer) => layer.toppingId)).toEqual(['banana'])
  })

  it('empilha as camadas de baixo para cima, e na ordem do cardápio dentro do mesmo tipo', () => {
    const result = composeIllustration(
      acai('isopor-gg', {
        cereja: 1,
        banana: 1,
        'calda-chocolate': 1,
        marshmallow: 1,
        granola: 1,
        'leite-em-po': 1,
        'creme-de-avela': 1,
      }),
    )
    const kinds = result.layers.map((layer) => LAYER_ORDER.indexOf(layer.look.kind))

    expect(kinds).toEqual([...kinds].sort((a, b) => a - b))
    expect(result.layers.map((layer) => layer.toppingId)).toEqual([
      'creme-de-avela',
      'calda-chocolate',
      'leite-em-po',
      'granola',
      'marshmallow',
      'banana',
      'cereja',
    ])
  })

  it('usa a cor do açaí nos açaís', () => {
    expect(composeIllustration(acai('pote-200')).base).toEqual(ACAI_COLORS)
    expect(composeIllustration({ ...acai('pote-200'), slug: 'acai-oca' }).base).toEqual(ACAI_COLORS)
  })

  it('pinta o milk-shake com a cor do sabor, e com uma cor neutra antes do sabor', () => {
    const shake = (flavorId: string | null): IllustrationInput => ({
      slug: 'milk-shake',
      sizeId: '500-ml',
      flavorId,
      toppings: {},
    })

    expect(composeIllustration(shake('morango')).base).toEqual(FLAVOR_COLORS.morango)
    expect(composeIllustration(shake(null)).base).toEqual(SHAKE_NEUTRAL)
    expect(composeIllustration(shake('pizza')).base).toEqual(SHAKE_NEUTRAL)
    expect(composeIllustration(shake('morango')).shape.kind).toBe('shake')
  })

  it('tem aparência para todo ingrediente, forma para todo tamanho e cor para todo sabor', () => {
    for (const topping of TOPPINGS) expect(TOPPING_LOOKS[topping.id], topping.id).toBeDefined()
    for (const product of Object.values(PRODUCTS)) {
      for (const size of product.sizes) expect(shapeFor(product.slug, size.id), size.id).toBeDefined()
      for (const flavor of product.flavors) expect(FLAVOR_COLORS[flavor.id], flavor.id).toBeDefined()
    }
  })

  it('dá sempre o mesmo resultado para a mesma escolha', () => {
    const input = acai('copo-400', { granola: 1, kiwi: 1, cereja: 2 })

    expect(composeIllustration(input)).toEqual(composeIllustration(input))
  })
})
