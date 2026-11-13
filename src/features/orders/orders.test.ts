import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, addTopping, chooseFlavor, chooseSize } from '../catalog/selection.ts'
import { EMPTY_CART, addItem, setQuantity } from '../cart/cart.ts'
import { buildOrderMessage } from './orderMessage.ts'
import { ORDER_SUBMISSION_AVAILABLE, submitOrder } from './orderService.ts'

const NBSP = String.fromCharCode(160)
const plain = (text: string) => text.replaceAll(NBSP, ' ')

function sampleCart() {
  const oca = PRODUCTS['acai-oca']
  let ocaSelection = chooseSize(oca, EMPTY_SELECTION, 'copo-500').selection
  for (const id of ['granola', 'granola', 'banana', 'calda-leite-condensado', 'creme-de-avela']) {
    ocaSelection = addTopping(oca, ocaSelection, id)
  }
  const batido = PRODUCTS['acai-batido']
  const batidoSelection = chooseFlavor(batido, chooseSize(batido, EMPTY_SELECTION, '300-ml').selection, 'leite-condensado-amendoim')

  let cart = addItem(EMPTY_CART, 'acai-oca', ocaSelection, 'a').cart
  cart = addItem(cart, 'acai-batido', batidoSelection, 'b').cart
  return setQuantity(cart, 'b', 2)
}

describe('mensagem do pedido', () => {
  it('traz código, itens, escolhas, valores e total', () => {
    const message = plain(buildOrderMessage(sampleCart(), { code: 'ADS-0001' }))

    expect(message).toContain('*Pedido ADS-0001*')
    expect(message).toContain('*1. 1x Açaí Oca · Copo 500 ml*')
    expect(message).toContain('Adicionais: 2x Granola')
    expect(message).toContain('Frutas: Banana')
    expect(message).toContain('Coberturas: Leite condensado')
    expect(message).toContain('1x Creme de avelã: + R$ 3,00')
    expect(message).toContain('Valor: 1 x R$ 23,00 = R$ 23,00')
    expect(message).toContain('*2. 2x Açaí Batido · 300 ml · Açaí com Leite Condensado e Amendoim*')
    expect(message).toContain('Valor: 2 x R$ 10,00 = R$ 20,00')
    expect(message).toContain('*Total: R$ 43,00*')
  })
})

describe('envio do pedido', () => {
  it('fica desligado enquanto o banco de pedidos não existe', async () => {
    expect(ORDER_SUBMISSION_AVAILABLE).toBe(false)
    expect(await submitOrder(sampleCart())).toEqual({ ok: false, reason: 'not-configured' })
    expect(await submitOrder(EMPTY_CART)).toEqual({ ok: false, reason: 'empty-cart' })
  })
})
