import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, addTopping, chooseFlavor, chooseSize } from '../catalog/selection.ts'
import { EMPTY_CART, addItem, setQuantity } from '../cart/cart.ts'
import { buildOrderMessage } from './orderMessage.ts'
import { ORDER_DATABASE_AVAILABLE, orderWhatsAppUrl, submitOrder } from './orderService.ts'

function sampleCart() {
  const oca = PRODUCTS['acai-oca']
  let ocaSelection = chooseSize(oca, EMPTY_SELECTION, 'copo-500').selection
  for (const id of ['granola', 'granola', 'leite-condensado', 'banana', 'creme-de-avela', 'kit-kat']) {
    ocaSelection = addTopping(oca, ocaSelection, id)
  }
  const batido = PRODUCTS['acai-batido']
  const batidoSelection = chooseFlavor(batido, chooseSize(batido, EMPTY_SELECTION, '300-ml').selection, 'leite-condensado-amendoim')

  let cart = addItem(EMPTY_CART, 'acai-oca', ocaSelection, 'a').cart
  cart = addItem(cart, 'acai-batido', batidoSelection, 'b').cart
  return setQuantity(cart, 'b', 2)
}

// Oca copo 500 (R$ 20,00) + creme de avelã (R$ 3,00) + Kit Kat (R$ 4,00) = R$ 27,00;
// 2 batidos de 300 ml a R$ 10,00 = R$ 20,00. Total: R$ 47,00.
const ITEMS = [
  '*NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍨',
  '',
  '*ITENS DO PEDIDO:*',
  '*1x Açaí Oca (Copo 500 ml)* — R$ 27,00',
  '• Adicionais: 2x Granola, Leite condensado',
  '• Frutas: Banana',
  '• Caldas/Cremes: Creme de avelã (+ R$ 3,00)',
  '• Adicionais pagos: Kit Kat (+ R$ 4,00)',
  '',
  '*2x Açaí Batido (Copo 300 ml)* — R$ 20,00 (R$ 10,00 cada)',
  '• Sabor: Açaí com Leite Condensado e Amendoim',
  '',
  '-----------------------------------',
  '*TOTAL DO PEDIDO: R$ 47,00*',
]

describe('mensagem do pedido', () => {
  it('segue o modelo: itens, escolhas por grupo, total e dinheiro com troco', () => {
    const message = buildOrderMessage(sampleCart(), { method: 'dinheiro', changeForCents: 5000 })
    expect(message.split('\n')).toEqual([
      ...ITEMS,
      '*FORMA DE PAGAMENTO:* Dinheiro',
      '*TROCO PARA:* R$ 50,00 *(Levar troco de R$ 3,00)*',
    ])
  })

  it('dinheiro sem troco', () => {
    const message = buildOrderMessage(sampleCart(), { method: 'dinheiro', changeForCents: null })
    expect(message.split('\n').slice(-2)).toEqual(['*FORMA DE PAGAMENTO:* Dinheiro', '*TROCO:* Não preciso de troco (valor exato)'])
  })

  it('Pix avisa do comprovante; cartões só dizem a forma', () => {
    expect(buildOrderMessage(sampleCart(), { method: 'pix' }).split('\n').slice(-2)).toEqual([
      '*FORMA DE PAGAMENTO:* Pix',
      'Envio o comprovante do Pix nesta conversa.',
    ])
    expect(buildOrderMessage(sampleCart(), { method: 'credito' }).split('\n').at(-1)).toBe('*FORMA DE PAGAMENTO:* Cartão de crédito')
    expect(buildOrderMessage(sampleCart(), { method: 'debito' }).split('\n').at(-1)).toBe('*FORMA DE PAGAMENTO:* Cartão de débito')
  })

  it('põe o código do pedido quando houver', () => {
    expect(buildOrderMessage(sampleCart(), { method: 'pix' }, { code: 'ADS-0001' }).split('\n')[1]).toBe('Pedido ADS-0001')
  })
})

describe('envio do pedido', () => {
  it('abre a conversa do WhatsApp oficial com o pedido escrito', () => {
    const url = new URL(orderWhatsAppUrl(sampleCart(), { method: 'pix' }))
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/5583996999980')
    expect(url.searchParams.get('text')).toBe(buildOrderMessage(sampleCart(), { method: 'pix' }))
  })

  it('o banco de pedidos ainda não existe', async () => {
    expect(ORDER_DATABASE_AVAILABLE).toBe(false)
    expect(await submitOrder(sampleCart())).toEqual({ ok: false, reason: 'not-configured' })
    expect(await submitOrder(EMPTY_CART)).toEqual({ ok: false, reason: 'empty-cart' })
  })
})
