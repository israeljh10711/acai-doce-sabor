import { afterEach, describe, expect, it } from 'vitest'
import { NO_CHANGES } from '../catalog/catalogChanges.ts'
import { setCatalogChanges } from '../catalog/catalogStore.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, addTopping, applyComplete, chooseFlavor, chooseSize, removeTopping } from '../catalog/selection.ts'
import { type Cart, EMPTY_CART, addExtraItem, addItem, setNote, setQuantity } from '../cart/cart.ts'
import type { Payment } from '../checkout/payment.ts'
import type { Customer, DeliveryFee } from '../checkout/delivery.ts'
import { type OrderDraft, buildOrderMessage, keycap } from './orderMessage.ts'
import { ORDER_DATABASE_AVAILABLE, orderWhatsAppUrl, submitOrder } from './orderService.ts'

afterEach(() => setCatalogChanges(NO_CHANGES))

const NEWLINE = String.fromCharCode(10)
const LINE = '━━━━━━━━━━━━━━━━━━━━'
/** 17/11/2026 às 15:42 em Brasília. */
const SENT_AT = Date.parse('2026-11-17T15:42:10-03:00')

const MARIA: Customer = {
  name: 'Maria',
  phone: '(83) 99999-0000',
  fulfillment: { kind: 'entrega', street: 'Rua das Flores', number: '12', district: 'Centro', reference: 'perto da praça' },
  fee: { kind: 'taxa', cents: 300, zoneName: 'Centro' },
}
const JOAO: Customer = { name: 'João', phone: null, fulfillment: { kind: 'retirada' }, fee: { kind: 'retirada' } }
const withFee = (fee: DeliveryFee): Customer => ({ ...MARIA, fee })

const tradicional = PRODUCTS['acai-tradicional']
const completoIsoporM = () => applyComplete(tradicional, chooseSize(tradicional, EMPTY_SELECTION, 'isopor-m').selection)

/** O exemplo do desenho aprovado: Tradicional Isopor M Completo sem Farinha láctea, com ninho, avelã e Kit Kat (R$ 25,00), e 2 picolés (R$ 6,00). */
function exampleCart(): Cart {
  let selection = removeTopping(completoIsoporM(), 'farinha-lactea')
  for (const id of ['creme-de-ninho', 'creme-de-avela', 'kit-kat']) selection = addTopping(tradicional, selection, id)
  let cart = addItem(EMPTY_CART, 'acai-tradicional', selection, 'a').cart
  cart = setNote(cart, 'a', 'pouco gelo')
  cart = addExtraItem(cart, 'picole-gourmet', { sabor: 'Nutella' }, 'b').cart
  return setQuantity(cart, 'b', 2)
}

const order = (patch: Partial<OrderDraft> = {}): OrderDraft => ({
  cart: exampleCart(),
  customer: MARIA,
  payment: { method: 'dinheiro', changeForCents: 5000 },
  sentAt: SENT_AT,
  antecipado: false,
  ...patch,
})
const lines = (draft: OrderDraft) => buildOrderMessage(draft).split(NEWLINE)
const pay = (payment: Payment, customer: Customer = MARIA) => lines(order({ payment, customer }))

describe('comanda do WhatsApp (pedido de 2026-11-17)', () => {
  it('segue o modelo aprovado: cliente, itens numerados, resumo com frete e pagamento com troco', () => {
    expect(lines(order())).toEqual([
      '🍧 *NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍧',
      '📅 *Data/Hora:* 17/11/2026 às 15:42',
      '',
      '👤 *DADOS DO CLIENTE*',
      '• *Nome:* Maria',
      '• *Telefone:* (83) 99999-0000',
      '• *Tipo de Pedido:* 🛵 Entrega em Domicílio',
      '• *Endereço:* Rua das Flores, 12, Centro — Ref.: perto da praça',
      '',
      LINE,
      '🍨 *ITENS DO PEDIDO*',
      '',
      '1️⃣ *1x Açaí Tradicional* (Isopor M) — *R$ 25,00*',
      '   ✨ *Montagem:* COMPLETO',
      '   🚫 *RETIRAR (SEM):* Farinha láctea',
      '   ➕ *Cremes / Extras Pagos:* Creme de ninho (+R$ 3,00), Creme de avelã (+R$ 3,00), Kit Kat (+R$ 4,00)',
      '   🥄 *Acompanhamentos:*',
      '      • Adicionais: Leite em pó, Granola, Paçoca, Chocoball, Amendoim, Gotas de chocolate, Canudinho, BIS, Sucrilhos, Marshmallow, Disquete (confete)',
      '      • Frutas: Kiwi, Morango, Banana',
      '   📝 *Observação:* pouco gelo',
      '',
      '2️⃣ *2x Picolé Gourmet* (Sabor: Nutella) — *R$ 6,00*',
      '',
      LINE,
      '🧾 *RESUMO FINANCEIRO*',
      '🛍️ *Subtotal dos itens:* R$ 31,00',
      '🛵 *Frete / Entrega (Centro):* R$ 3,00',
      '💰 *TOTAL A PAGAR:* *R$ 34,00*',
      '',
      LINE,
      '💳 *FORMA DE PAGAMENTO*',
      '• *Método escolhido:* 💵 *Dinheiro* — *R$ 34,00*',
      '  🪙 *Troco para:* R$ 50,00 *(Levar R$ 16,00 de troco)*',
      '',
      '💜 _Obrigado pela preferência! Açaí Doce Sabor_',
    ])
  })

  it('Completo sem nada tirado: "COMPLETO (todos os acompanhamentos)", sem a linha RETIRAR', () => {
    const cart = addItem(EMPTY_CART, 'acai-tradicional', completoIsoporM(), 'a').cart
    const message = lines(order({ cart }))
    expect(message).toContain('   ✨ *Montagem:* COMPLETO (todos os acompanhamentos)')
    expect(message.some((line) => line.includes('RETIRAR'))).toBe(false)
    expect(message.some((line) => line.includes('Extras Pagos'))).toBe(false)
  })

  it('retirada na loja: sem endereço, frete grátis; Pix com o comprovante; sem telefone quando não foi escrito', () => {
    const message = pay({ method: 'pix' }, JOAO)
    expect(message).toContain('• *Tipo de Pedido:* 🏪 Retirada na Loja')
    expect(message.some((line) => line.startsWith('• *Endereço:*') || line.startsWith('• *Telefone:*'))).toBe(false)
    expect(message).toContain('🏪 *Retirada na loja:* Grátis (R$ 0,00)')
    expect(message).toContain('💰 *TOTAL A PAGAR:* *R$ 31,00*')
    expect(message.slice(-4)).toEqual([
      '• *Método escolhido:* 💠 *Pix* — *R$ 31,00*',
      '  📎 _Envio o comprovante do Pix nesta conversa._',
      '',
      '💜 _Obrigado pela preferência! Açaí Doce Sabor_',
    ])
  })

  it('cartão: crédito ou débito, com "Levar maquininha" só na entrega', () => {
    expect(pay({ method: 'credito' })).toContain('• *Método escolhido:* 💳 *Cartão de crédito* — *R$ 34,00* 📟 _(Levar maquininha)_')
    expect(pay({ method: 'debito' }, JOAO)).toContain('• *Método escolhido:* 💳 *Cartão de débito* — *R$ 31,00*')
  })

  it('dinheiro sem troco', () => {
    expect(pay({ method: 'dinheiro', changeForCents: null })).toContain('  ✅ *Troco:* Não precisa (valor exato)')
  })

  it('frete grátis, bairro com taxa zero e frete a combinar (sem "Levar troco", que dependeria do frete)', () => {
    expect(lines(order({ customer: withFee({ kind: 'gratis' }) }))).toContain('🛵 *Frete / Entrega:* Grátis (R$ 0,00)')
    expect(lines(order({ customer: withFee({ kind: 'taxa', cents: 0, zoneName: 'Centro' }) }))).toContain(
      '🛵 *Frete / Entrega (Centro):* Grátis (R$ 0,00)',
    )
    const combinar = lines(order({ customer: withFee({ kind: 'combinar' }) }))
    expect(combinar).toContain('🛵 *Frete / Entrega:* A combinar')
    expect(combinar).toContain('💰 *TOTAL A PAGAR:* *R$ 31,00* + frete a combinar')
    expect(combinar).toContain('• *Método escolhido:* 💵 *Dinheiro* — *R$ 31,00* + frete a combinar')
    expect(combinar).toContain('  🪙 *Troco para:* R$ 50,00')
  })

  it('pedido antecipado (loja fechada, vendedor aceita) e código do pedido, logo abaixo do título', () => {
    expect(lines(order({ antecipado: true })).slice(1, 3)).toEqual([
      '📅 *Data/Hora:* 17/11/2026 às 15:42',
      '⏰ *Pedido antecipado:* enviado com a loja fechada',
    ])
    expect(lines(order({ code: 'ADS-0001' }))[1]).toBe('🔖 *Pedido:* ADS-0001')
  })

  it('itens sem Completo: pagos com o valor e os grátis agrupados; sabor e tamanho entre parênteses', () => {
    const oca = PRODUCTS['acai-oca']
    let ocaSelection = chooseSize(oca, EMPTY_SELECTION, 'copo-500').selection
    for (const id of ['granola', 'granola', 'leite-condensado', 'banana', 'creme-de-avela', 'kit-kat']) ocaSelection = addTopping(oca, ocaSelection, id)
    const batido = PRODUCTS['acai-batido']
    const batidoSelection = chooseFlavor(batido, chooseSize(batido, EMPTY_SELECTION, '300-ml').selection, 'leite-condensado-amendoim')
    const barca = PRODUCTS['barca-de-acai']
    const barcaSelection = chooseFlavor(barca, chooseSize(barca, EMPTY_SELECTION, 'barca').selection, 'calda-chocolate')
    let cart = addItem(EMPTY_CART, 'acai-oca', ocaSelection, 'a').cart
    cart = addItem(cart, 'acai-batido', batidoSelection, 'b').cart
    cart = addItem(cart, 'barca-de-acai', barcaSelection, 'c').cart
    cart = addExtraItem(cart, 'kit-completo-casquinha', { sorvete: 'ninho com morango', cobertura: 'Caramelo' }, 'd').cart
    cart = addExtraItem(cart, 'agua-mineral-500-ml', {}, 'e').cart
    const message = lines(order({ cart }))
    const from = (start: string, count: number) => message.slice(message.indexOf(start), message.indexOf(start) + count)

    expect(from('1️⃣ *1x Açaí Oca* (Copo 500 ml) — *R$ 27,00*', 6)).toEqual([
      '1️⃣ *1x Açaí Oca* (Copo 500 ml) — *R$ 27,00*',
      '   ➕ *Cremes / Extras Pagos:* Creme de avelã (+R$ 3,00), Kit Kat (+R$ 4,00)',
      '   🥄 *Acompanhamentos:*',
      '      • Adicionais: 2x Granola, Leite condensado',
      '      • Frutas: Banana',
      '',
    ])
    expect(message).toContain('2️⃣ *1x Açaí Batido* (Copo 300 ml · Sabor: Açaí com Leite Condensado e Amendoim) — *R$ 10,00*')
    expect(from('3️⃣ *1x Barca de Açaí* (Cobertura: Chocolate) — *R$ 30,00*', 2)).toEqual(['3️⃣ *1x Barca de Açaí* (Cobertura: Chocolate) — *R$ 30,00*', ''])
    expect(from('4️⃣ *1x Kit Completo Casquinha DUO* — *R$ 41,00*', 4)).toEqual([
      '4️⃣ *1x Kit Completo Casquinha DUO* — *R$ 41,00*',
      '   • *Sabor do sorvete (2 litros):* Ninho com morango (outro sabor)',
      '   • *Sabor da cobertura:* Caramelo',
      '',
    ])
    expect(message).toContain('5️⃣ *1x Água Mineral 500 ml* — *R$ 2,00*')
    expect(message.some((line) => line.includes('Observação'))).toBe(false)
  })

  it('números dos itens com emoji: 1️⃣ a 9️⃣, 🔟 e depois os dígitos', () => {
    expect([keycap(1), keycap(9), keycap(10), keycap(11), keycap(20)]).toEqual(['1️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '2️⃣0️⃣'])
  })
})

describe('envio do pedido', () => {
  it('abre a conversa do WhatsApp da loja com a comanda escrita', () => {
    const url = new URL(orderWhatsAppUrl(order()))
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/5583996999980')
    expect(url.searchParams.get('text')).toBe(buildOrderMessage(order()))
  })

  it('usa o WhatsApp que o vendedor gravou em "Horários e Contato"', () => {
    setCatalogChanges({ ...NO_CHANGES, settings: { loja: { contact: { whatsapp: '(83) 98888-7777' } } } })
    expect(new URL(orderWhatsAppUrl(order())).pathname).toBe('/5583988887777')
  })

  it('o banco de pedidos ainda não existe', async () => {
    expect(ORDER_DATABASE_AVAILABLE).toBe(false)
    expect(await submitOrder(exampleCart())).toEqual({ ok: false, reason: 'not-configured' })
    expect(await submitOrder(EMPTY_CART)).toEqual({ ok: false, reason: 'empty-cart' })
  })
})
