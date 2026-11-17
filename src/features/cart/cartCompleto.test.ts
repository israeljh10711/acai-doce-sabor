import { describe, expect, it } from 'vitest'
import { PRODUCTS, getTopping } from '../catalog/menu.ts'
import { EMPTY_SELECTION, addTopping, applyComplete, chooseFlavor, chooseSize, removeTopping } from '../catalog/selection.ts'
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
  it('o carrinho guarda o Completo: 15 itens pelo preço do pote de 200 ml, e a marca volta ao reler', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-oca', ocaCompleta())
    const [item] = cart.items
    expect(item.kind === 'product' && item.selection.complete).toBe(true)
    expect(unitPriceCents(item)).toBe(1000)
    const reread = parseCart(serializeCart(cart))
    const [again] = reread.items
    expect(again.kind === 'product' && Object.keys(again.selection.toppings)).toHaveLength(15)
    expect(again.kind === 'product' && again.selection.complete).toBe(true)
    expect(unitPriceCents(again)).toBe(1000)
  })

  it('sem a marca do Completo, a revalidação aplica a cota de sempre (carrinho antigo continua igual)', () => {
    const normalized = normalizeSelection('acai-oca', { ...ocaCompleta(), complete: undefined })!
    expect(normalized.complete).toBeFalsy()
    // O pote de 200 ml tem 2 adicionais grátis: só os 2 primeiros ficam.
    expect(Object.keys(normalized.toppings).filter((id) => getTopping(id)?.group === 'dry')).toEqual(['leite-em-po', 'granola'])
  })

  it('resumo: "COMPLETO", e o creme marcado à parte com o preço (+ R$ 3,00)', () => {
    const summary = summarizeSelection('acai-oca', ocaCompleta())
    expect(summary.montagem).toBe('COMPLETO')
    expect(summary.sections.map((section) => section.group)).toEqual(['dry', 'fruit'])
    const withCream = summarizeSelection('acai-oca', addTopping(oca, ocaCompleta(), 'creme-de-ninho'))
    expect(withCream.unitCents).toBe(1300)
    expect(withCream.sections.find((section) => section.group === 'syrup')?.items).toEqual([{ name: 'Creme de ninho', quantity: 1, totalCents: 300 }])
  })

  it('confirmação: a linha "Montagem" vem antes das outras', () => {
    expect(productSummary('acai-oca', semFarinha()).rows[0]).toEqual({ label: 'Montagem', value: 'COMPLETO (SEM: Farinha láctea)' })
  })

  it('carrinho: a descrição do item começa pela montagem', () => {
    const { item } = addItem(EMPTY_CART, 'acai-oca', semFarinha())
    if (!item) throw new Error('esperava um produto')
    expect(describeItem(item).montagem).toBe('COMPLETO (SEM: Farinha láctea)')
    // Nada pago marcado: nada cobrado à parte; caldas e cremes não entram sozinhos.
    expect(describeItem(item).paid).toEqual([])
    expect(describeItem(item).included.map((entry) => entry.group)).toEqual(['Adicionais', 'Frutas'])
  })

  it('WhatsApp: "• Montagem: COMPLETO (SEM: Farinha láctea)" logo abaixo do título, a Farinha láctea fora da lista e os pagos à parte', () => {
    const selection = addTopping(oca, addTopping(oca, addTopping(oca, semFarinha(), 'creme-de-avela'), 'creme-de-ninho'), 'calda-chocolate')
    const { cart } = addItem(EMPTY_CART, 'acai-oca', selection)
    const lines = buildOrderMessage(cart, PIX).split(NEWLINE)
    const title = lines.findIndex((line) => line.startsWith('*1x Açaí Oca'))
    expect(lines[title]).toContain('R$ 16,00')
    expect(lines[title + 1]).toBe('• Montagem: COMPLETO (SEM: Farinha láctea)')
    expect(lines.some((line) => line.includes('Farinha láctea') && !line.includes('SEM'))).toBe(false)
    // Na mensagem, o grupo se chama "Caldas/Cremes" (modelo do pedido de 2026-11-14).
    expect(lines).toContain('• Caldas/Cremes: Chocolate')
    expect(lines).toContain('• Extras / Cremes e Caldas pagos: Creme de ninho (+ R$ 3,00), Creme de avelã (+ R$ 3,00)')
  })

  it('WhatsApp da Barca completa com a cobertura: "COMPLETO", sem extras', () => {
    const selection = applyComplete(barca, chooseFlavor(barca, chooseSize(barca, EMPTY_SELECTION, 'barca').selection, 'calda-chocolate'))
    const message = buildOrderMessage(addItem(EMPTY_CART, 'barca-de-acai', selection).cart, PIX)
    expect(message).toContain('• Montagem: COMPLETO')
    expect(message).not.toContain('Extras / Cremes e Caldas pagos')
    expect(message).toContain('R$ 30,00')
  })
})
