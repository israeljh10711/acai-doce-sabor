import { describe, expect, it } from 'vitest'
import { PRODUCTS, getTopping } from '../catalog/menu.ts'
import { EMPTY_SELECTION, addTopping, applyComplete, chooseFlavor, chooseSize, removeTopping } from '../catalog/selection.ts'
import { productSummary } from '../configurator-core/confirmSummary.ts'
import { buildOrderMessage } from '../orders/orderMessage.ts'
import { type Cart, EMPTY_CART, addItem, describeItem, normalizeSelection, parseCart, serializeCart, summarizeSelection, unitPriceCents } from './cart.ts'

const tradicional = PRODUCTS['acai-tradicional']
const barca = PRODUCTS['barca-de-acai']
const NEWLINE = String.fromCharCode(10)
const PIX = { method: 'pix' } as const
/** Comanda de 2026-11-17: cliente que retira na loja, pagando com Pix. */
const message = (cart: Cart) =>
  buildOrderMessage({
    cart,
    customer: { name: 'Ana', phone: null, fulfillment: { kind: 'retirada' }, fee: { kind: 'retirada' } },
    payment: PIX,
    sentAt: Date.parse('2026-11-17T15:00:00-03:00'),
    antecipado: false,
  })

const tradicionalCompleto = () => applyComplete(tradicional, chooseSize(tradicional, EMPTY_SELECTION, 'pote-200').selection)
const semFarinha = () => removeTopping(tradicionalCompleto(), 'farinha-lactea')

describe('Completo no carrinho, na confirmação e no WhatsApp (pedido de 2026-11-16)', () => {
  it('o carrinho guarda o Completo: 15 itens pelo preço do pote de 200 ml, e a marca volta ao reler', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-tradicional', tradicionalCompleto())
    const [item] = cart.items
    expect(item.kind === 'product' && item.selection.complete).toBe(true)
    expect(unitPriceCents(item)).toBe(700)
    const reread = parseCart(serializeCart(cart))
    const [again] = reread.items
    expect(again.kind === 'product' && Object.keys(again.selection.toppings)).toHaveLength(15)
    expect(again.kind === 'product' && again.selection.complete).toBe(true)
    expect(unitPriceCents(again)).toBe(700)
  })

  it('um Oca Completo antigo volta com a cota vigente e perde a marca de Completo', () => {
    const normalized = normalizeSelection('acai-oca', tradicionalCompleto())!
    expect(normalized.complete).toBeFalsy()
    // O pote de 200 ml tem 2 adicionais grátis: só os 2 primeiros ficam.
    expect(Object.keys(normalized.toppings).filter((id) => getTopping(id)?.group === 'dry')).toEqual(['leite-em-po', 'granola'])
  })

  it('resumo: "COMPLETO", e o creme marcado à parte com o preço (+ R$ 3,00)', () => {
    const summary = summarizeSelection('acai-tradicional', tradicionalCompleto())
    expect(summary.montagem).toBe('COMPLETO')
    expect(summary.sections.map((section) => section.group)).toEqual(['dry', 'fruit'])
    const withCream = summarizeSelection('acai-tradicional', addTopping(tradicional, tradicionalCompleto(), 'creme-de-ninho'))
    expect(withCream.unitCents).toBe(1000)
    expect(withCream.sections.find((section) => section.group === 'syrup')?.items).toEqual([{ name: 'Creme de ninho', quantity: 1, totalCents: 300 }])
  })

  it('confirmação: a linha "Montagem" vem antes das outras', () => {
    expect(productSummary('acai-tradicional', semFarinha()).rows[0]).toEqual({ label: 'Montagem', value: 'COMPLETO (SEM: Farinha láctea)' })
  })

  it('carrinho: a descrição do item começa pela montagem', () => {
    const { item } = addItem(EMPTY_CART, 'acai-tradicional', semFarinha())
    if (!item) throw new Error('esperava um produto')
    expect(describeItem(item).montagem).toBe('COMPLETO (SEM: Farinha láctea)')
    // Nada pago marcado: nada cobrado à parte; caldas e cremes não entram sozinhos.
    expect(describeItem(item).paid).toEqual([])
    expect(describeItem(item).included.map((entry) => entry.group)).toEqual(['Adicionais', 'Frutas'])
  })

  it('WhatsApp: "COMPLETO" e "RETIRAR (SEM): Farinha láctea" logo abaixo do título, a Farinha láctea fora da lista e os pagos à parte', () => {
    const selection = addTopping(tradicional, addTopping(tradicional, addTopping(tradicional, semFarinha(), 'creme-de-avela'), 'creme-de-ninho'), 'calda-chocolate')
    const { cart } = addItem(EMPTY_CART, 'acai-tradicional', selection)
    const lines = message(cart).split(NEWLINE)
    const title = lines.findIndex((line) => line.startsWith('1️⃣ *1x Açaí Tradicional'))
    expect(lines[title]).toContain('R$ 13,00')
    expect(lines.slice(title + 1, title + 3)).toEqual(['   ✨ *Montagem:* COMPLETO', '   🚫 *RETIRAR (SEM):* Farinha láctea'])
    expect(lines.some((line) => line.includes('Farinha láctea') && !line.includes('RETIRAR'))).toBe(false)
    // A cobertura grátis fica nos acompanhamentos, com o nome do grupo do personalizador.
    expect(lines).toContain('      • Caldas e cremes: Chocolate')
    expect(lines).toContain('   ➕ *Cremes / Extras Pagos:* Creme de ninho (+R$ 3,00), Creme de avelã (+R$ 3,00)')
  })

  it('WhatsApp da Barca completa com a cobertura: "COMPLETO (todos os acompanhamentos)", sem extras', () => {
    const selection = applyComplete(barca, chooseFlavor(barca, chooseSize(barca, EMPTY_SELECTION, 'barca').selection, 'calda-chocolate'))
    const text = message(addItem(EMPTY_CART, 'barca-de-acai', selection).cart)
    expect(text).toContain('✨ *Montagem:* COMPLETO (todos os acompanhamentos)')
    expect(text).not.toContain('Extras Pagos')
    expect(text).toContain('R$ 30,00')
  })
})
