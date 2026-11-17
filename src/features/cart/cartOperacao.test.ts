import { afterEach, describe, expect, it } from 'vitest'
import { NO_CHANGES } from '../catalog/catalogChanges.ts'
import { setCatalogChanges } from '../catalog/catalogStore.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, addTopping, chooseSize } from '../catalog/selection.ts'
import { EMPTY_CART, MAX_NOTE_LENGTH, addExtraItem, addItem, cartItemProblem, parseCart, serializeCart, setNote } from './cart.ts'

afterEach(() => setCatalogChanges(NO_CHANGES))

const tradicional = PRODUCTS['acai-tradicional']
const tradicionalCom = (...ids: string[]) =>
  ids.reduce((selection, id) => addTopping(tradicional, selection, id), chooseSize(tradicional, EMPTY_SELECTION, 'pote-150').selection)

describe('observação do item no carrinho (2A, pedido de 2026-11-17)', () => {
  it('grava a observação no item certo e ela volta igual ao reler o carrinho', () => {
    const first = addExtraItem(EMPTY_CART, 'agua-mineral-500-ml', {})
    const second = addItem(first.cart, 'acai-tradicional', tradicionalCom('granola'))
    const cart = setNote(second.cart, second.item!.id, '  pouco   gelo ')
    expect(cart.items.map((item) => item.note)).toEqual([undefined, 'pouco gelo'])
    expect(parseCart(serializeCart(cart)).items.map((item) => item.note)).toEqual([undefined, 'pouco gelo'])
  })

  it('corta em 140 caracteres e apaga quando fica vazia', () => {
    const { cart, item } = addExtraItem(EMPTY_CART, 'agua-mineral-500-ml', {})
    const long = setNote(cart, item!.id, 'x'.repeat(200))
    expect(long.items[0].note).toHaveLength(MAX_NOTE_LENGTH)
    const cleared = setNote(long, item!.id, '   ')
    expect(cleared.items[0].note).toBeUndefined()
    expect('note' in cleared.items[0]).toBe(false)
    expect(setNote(cart, 'nao-existe', 'oi')).toBe(cart)
  })
})

describe('esgotado com o cliente no carrinho (pedido de 2026-11-17)', () => {
  it('item das seções esgotado continua no carrinho, marcado, também ao reler', () => {
    const { cart } = addExtraItem(EMPTY_CART, 'jujuba', {})
    expect(cartItemProblem(cart.items[0])).toBeNull()
    setCatalogChanges({ ...NO_CHANGES, items: { jujuba: { available: false } } })
    expect(cartItemProblem(cart.items[0])).toEqual({ kind: 'item' })
    const reread = parseCart(serializeCart(cart))
    expect(reread.items).toHaveLength(1)
    expect(cartItemProblem(reread.items[0])).toEqual({ kind: 'item' })
  })

  it('complemento esgotado continua na montagem, com o nome, também ao reler', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-tradicional', tradicionalCom('granola', 'pacoca'))
    expect(cartItemProblem(cart.items[0])).toBeNull()
    setCatalogChanges({ ...NO_CHANGES, toppings: { granola: { available: false } } })
    expect(cartItemProblem(cart.items[0])).toEqual({ kind: 'toppings', names: ['Granola'] })
    const [again] = parseCart(serializeCart(cart)).items
    expect(again.kind === 'product' && again.selection.toppings.granola).toBe(1)
    expect(cartItemProblem(again)).toEqual({ kind: 'toppings', names: ['Granola'] })
  })

  it('produto esgotado marca a linha', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-tradicional', tradicionalCom())
    setCatalogChanges({ ...NO_CHANGES, products: { 'acai-tradicional': { available: false } } })
    expect(cartItemProblem(cart.items[0])).toEqual({ kind: 'item' })
  })

  it('esgotado continua sem entrar no carrinho de novo', () => {
    setCatalogChanges({ ...NO_CHANGES, items: { jujuba: { available: false } } })
    expect(addExtraItem(EMPTY_CART, 'jujuba', {}).item).toBeNull()
    setCatalogChanges({ ...NO_CHANGES, toppings: { granola: { available: false } } })
    expect(tradicionalCom('granola').toppings.granola).toBeUndefined()
  })
})
