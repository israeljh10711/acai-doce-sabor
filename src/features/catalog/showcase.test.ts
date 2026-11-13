import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './categories.ts'
import { PRODUCTS } from './menu.ts'
import { EMPTY_SELECTION, addTopping, chooseFlavor, chooseSize, missingChoices } from './selection.ts'
import { SHOWCASE, startingPriceCents } from './showcase.ts'

describe('vitrine', () => {
  it('tem uma montagem para cada categoria, e cada uma é um pedido válido', () => {
    for (const category of CATEGORIES) {
      const pick = SHOWCASE[category.slug]
      const product = PRODUCTS[category.slug]
      expect(pick.slug).toBe(category.slug)

      let selection = chooseSize(product, EMPTY_SELECTION, pick.sizeId!).selection
      if (pick.flavorId) selection = chooseFlavor(product, selection, pick.flavorId)
      for (const [id, quantity] of Object.entries(pick.toppings)) {
        for (let unit = 0; unit < quantity; unit++) selection = addTopping(product, selection, id)
      }
      // As regras aceitaram tudo: nada ficou de fora.
      expect(selection.toppings, category.slug).toEqual(pick.toppings)
      expect(missingChoices(product, selection), category.slug).toEqual([])
    }
  })

  it('mostra o menor preço real de cada categoria', () => {
    expect(startingPriceCents('acai-oca')).toBe(1000)
    expect(startingPriceCents('acai-tradicional')).toBe(600)
    expect(startingPriceCents('acai-batido')).toBe(1000)
    expect(startingPriceCents('milk-shake')).toBe(1000)
  })
})
