import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, applyComplete, chooseFlavor, chooseSize, removeTopping } from '../catalog/selection.ts'
import { productSummary } from '../configurator-core/confirmSummary.ts'
import { buildOrderMessage } from '../orders/orderMessage.ts'
import { EMPTY_CART, addItem, describeItem, normalizeSelection, parseCart, serializeCart, summarizeSelection, unitPriceCents } from './cart.ts'

const oca = PRODUCTS['acai-oca']
const barca = PRODUCTS['barca-de-acai']
const NEWLINE = String.fromCharCode(10)
const PIX = { method: 'pix' } as const

const ocaCompleta = () => applyComplete(oca, chooseSize(oca, EMPTY_SELECTION, 'pote-200').selection)
const semFarinha = () => removeTopping(ocaCompleta(), 'farinha-lactea')

describe('Completo no carrinho, na confirmação e no WhatsApp (pedido de 2026-11-16)', () => {
  it('o carrinho guarda o Completo: 24 itens pelo preço do pote de 200 ml, e a marca volta ao reler', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-oca', ocaCompleta())
    const [item] = cart.items
    expect(item.kind === 'product' && item.selection.complete).toBe(true)
    expect(unitPriceCents(item)).toBe(1000)
    const reread = parseCart(serializeCart(cart))
    const [again] = reread.items
    expect(again.kind === 'product' && Object.keys(again.selection.toppings)).toHaveLength(24)
    expect(again.kind === 'product' && again.selection.complete).toBe(true)
    expect(unitPriceCents(again)).toBe(1000)
  })

  it('sem a marca do Completo, a revalidação aplica a cota de sempre (carrinho antigo continua igual)', () => {
    const { complete: _ignored, ...plain } = ocaCompleta()
    const normalized = normalizeSelection('acai-oca', plain)!
    expect(normalized.complete).toBeFalsy()
    expect(Object.entries(normalized.toppings).filter(([id]) => PRODUCTS['acai-oca'].groups && ['leite-em-po', 'granola', 'pacoca'].includes(id))).toHaveLength(2)
  })

  it('resumo: "COMPLETO (todos os acompanhamentos)", e os cremes sem "+ R$ 3,00"', () => {
    const summary = summarizeSelection('acai-oca', ocaCompleta())
    expect(summary.montagem).toBe('COMPLETO (todos os acompanhamentos)')
    const syrups = summary.sections.find((section) => section.group === 'syrup')!
    expect(syrups.items.find((choice) => choice.name === 'Creme de ninho')?.totalCents).toBe(0)
  })

  it('confirmação: a linha "Montagem" vem antes das outras', () => {
    expect(productSummary('acai-oca', semFarinha()).rows[0]).toEqual({ label: 'Montagem', value: 'COMPLETO (SEM: Farinha láctea)' })
  })

  it('carrinho: a descrição do item começa pela montagem', () => {
    const { item } = addItem(EMPTY_CART, 'acai-oca', semFarinha())
    if (!item) throw new Error('esperava um produto')
    expect(describeItem(item).montagem).toBe('COMPLETO (SEM: Farinha láctea)')
    // O creme de ninho entra sem custo no Completo: nada cobrado à parte.
    expect(describeItem(item).paid).toEqual([])
    expect(describeItem(item).included.find((entry) => entry.group === 'Caldas e cremes')?.items).toContain('Creme de ninho')
  })

  it('WhatsApp: "• Montagem: COMPLETO (SEM: Farinha láctea)" logo abaixo do título, e a Farinha láctea fora da lista', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-oca', semFarinha())
    const lines = buildOrderMessage(cart, PIX).split(NEWLINE)
    const title = lines.findIndex((line) => line.startsWith('*1x Açaí Oca'))
    expect(lines[title + 1]).toBe('• Montagem: COMPLETO (SEM: Farinha láctea)')
    expect(lines.some((line) => line.includes('Farinha láctea') && !line.includes('SEM'))).toBe(false)
    expect(lines.some((line) => line.includes('Creme de ninho (+'))).toBe(false)
  })

  it('WhatsApp da Barca completa com a cobertura: "COMPLETO (todos os acompanhamentos)"', () => {
    const selection = applyComplete(barca, chooseFlavor(barca, chooseSize(barca, EMPTY_SELECTION, 'barca').selection, 'calda-chocolate'))
    const message = buildOrderMessage(addItem(EMPTY_CART, 'barca-de-acai', selection).cart, PIX)
    expect(message).toContain('• Montagem: COMPLETO (todos os acompanhamentos)')
    expect(message).toContain('R$ 30,00')
  })
})
