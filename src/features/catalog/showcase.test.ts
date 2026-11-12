import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './categories.ts'
import { PRODUCTS } from './menu.ts'
import { SHOWCASE_PICKS, showcaseOf } from './showcase.ts'

describe('ilustrações de vitrine', () => {
  it('existe uma para cada categoria', () => {
    for (const category of CATEGORIES) expect(showcaseOf(category.slug).title).toBeTruthy()
  })

  it('usam só tamanhos, sabores e ingredientes do cardápio, aceitos pelas regras', () => {
    for (const category of CATEGORIES) {
      const pick = SHOWCASE_PICKS[category.slug]
      const showcase = showcaseOf(category.slug)
      const product = PRODUCTS[category.slug]

      expect(showcase.sizeId).toBe(pick.sizeId)
      expect(product.sizes.some((size) => size.id === pick.sizeId)).toBe(true)
      expect(showcase.flavorId).toBe(pick.flavorId)
      // Se uma regra recusasse um item, ele não estaria na escolha final.
      expect(Object.keys(showcase.toppings)).toEqual(pick.toppings)
    }
  })

  it('o milk-shake da vitrine tem sabor', () => {
    expect(showcaseOf('milk-shake').flavorId).toBe('morango')
  })
})
