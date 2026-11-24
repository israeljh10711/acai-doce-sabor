import { describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, cartCount, parseCart, serializeCart } from './cart.ts'
import { repeatOrder } from './repeatOrder.ts'

const extra = { kind: 'extra', id: 'linha', itemId: 'picole-gourmet', choices: [['sabor', 'Nutella']], quantity: 2, note: 'Bem gelado' }
const product = { kind: 'product', id: 'linha', slug: 'acai-oca', sizeId: 'copo-500', toppings: [['granola', 1]], quantity: 1, note: 'Para Ana' }
const snapshot = (...items: unknown[]) => JSON.stringify({ v: 2, items })

describe('pedir de novo', () => {
  it('mantém o carrinho, os lotes, sabores, complementos, quantidades e observações com novos IDs', () => {
    const original = addExtraItem(EMPTY_CART, 'agua-mineral-500-ml', {}, 'linha').cart
    const result = repeatOrder(original, [snapshot(extra), snapshot(product)])
    expect(result.quantity).toBe(3)
    expect(result.skipped).toBe(false)
    expect(result.cart.items[0]).toBe(original.items[0])
    expect(result.cart.items[1]).toMatchObject({ choices: { sabor: 'Nutella' }, quantity: 2, note: 'Bem gelado' })
    expect(result.cart.items[2]).toMatchObject({ selection: { sizeId: 'copo-500', toppings: { granola: 1 } }, note: 'Para Ana' })
    expect(new Set(result.cart.items.map(item => item.id)).size).toBe(3)
    expect(cartCount(parseCart(serializeCart(result.cart)))).toBe(4)
  })

  it('sinaliza escolhas que saíram e preserva os demais itens', () => {
    const invalid = { ...product, toppings: [['ingrediente-antigo', 1]] }
    const result = repeatOrder(EMPTY_CART, [snapshot(invalid), snapshot(extra), 'invalid'])
    expect(result.quantity).toBe(2)
    expect(result.skipped).toBe(true)
    expect(result.cart.items).toHaveLength(1)
    expect(repeatOrder(result.cart, [snapshot(invalid)]).cart).toBe(result.cart)
  })
})
