import { afterEach, describe, expect, it } from 'vitest'
import { isProductAvailable } from './availability.ts'
import { BASE_CATEGORIES } from './categories.ts'
import { BASE_DRAWERS, BASE_EXTRA_ITEMS } from './extras.ts'
import { NO_CHANGES, applyChanges, parseChanges } from './catalogChanges.ts'
import { setCatalogChanges } from './catalogStore.ts'
import { BASE_PRODUCTS, BASE_TOPPINGS } from './menu.ts'

afterEach(() => setCatalogChanges(NO_CHANGES))

describe('esgotado nos produtos do personalizador (pedido de 2026-11-17)', () => {
  it('os 4 produtos guardam "disponível/esgotado" na mudança do produto', () => {
    expect(parseChanges({ products: { 'acai-oca': { available: false } } }).products).toEqual({ 'acai-oca': { available: false } })
    const base = { items: BASE_EXTRA_ITEMS, toppings: BASE_TOPPINGS, products: BASE_PRODUCTS, categories: BASE_CATEGORIES, drawers: BASE_DRAWERS, groupTitles: {} }
    expect(applyChanges(base, { ...NO_CHANGES, products: { 'acai-oca': { available: false } } }).products['acai-oca'].available).toBe(false)
    expect(applyChanges(base, { ...NO_CHANGES, products: { 'acai-oca': { available: true } } }).products['acai-oca'].available).toBe(true)
  })

  it('produto esgotado pela mudança dele; os outros continuam', () => {
    setCatalogChanges({ ...NO_CHANGES, products: { 'acai-oca': { available: false } } })
    expect(isProductAvailable('acai-oca')).toBe(false)
    expect(isProductAvailable('acai-tradicional')).toBe(true)
  })

  it('Pote 1 L e Barca ficam indisponíveis quando o item da seção é esgotado', () => {
    expect(isProductAvailable('barca-de-acai')).toBe(true)
    setCatalogChanges({ ...NO_CHANGES, items: { 'barca-de-acai': { available: false } } })
    expect(isProductAvailable('barca-de-acai')).toBe(false)
    expect(isProductAvailable('pote-de-acai-1-litro')).toBe(true)
  })
})
