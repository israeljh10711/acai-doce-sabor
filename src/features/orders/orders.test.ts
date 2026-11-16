import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, type Selection, addTopping, chooseFlavor, chooseSize } from '../catalog/selection.ts'
import { EMPTY_CART, addExtraItem, addItem, setQuantity } from '../cart/cart.ts'
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

describe('mensagem com os itens das gavetas e os produtos novos (pedido de 2026-11-15)', () => {
  function mixedCart() {
    const barca = PRODUCTS['barca-de-acai']
    const barcaSelection = addTopping(barca, chooseFlavor(barca, { ...EMPTY_SELECTION, sizeId: 'barca' }, 'calda-chocolate'), 'kit-kat')
    const pote = PRODUCTS['pote-de-acai-1-litro']
    let poteSelection: Selection = { ...EMPTY_SELECTION, sizeId: 'pote-1-litro' }
    for (const id of ['granola', 'pacoca', 'kiwi']) poteSelection = addTopping(pote, poteSelection, id)

    let cart = addItem(EMPTY_CART, 'barca-de-acai', barcaSelection, 'barca').cart
    cart = addItem(cart, 'pote-de-acai-1-litro', poteSelection, 'pote').cart
    cart = addExtraItem(cart, 'picole-gourmet', { sabor: 'Nutella' }, 'picole').cart
    cart = setQuantity(cart, 'picole', 2)
    cart = addExtraItem(cart, 'kit-completo-casquinha', { sorvete: 'ninho com morango', cobertura: 'Caramelo' }, 'kit').cart
    return addExtraItem(cart, 'agua-mineral-500-ml', {}, 'agua').cart
  }

  it('lista cada item com quantidade, nome, sabor, adicionais e valor, e soma tudo', () => {
    const lines = buildOrderMessage(mixedCart(), { method: 'dinheiro', changeForCents: 15000 }).split('\n')
    expect(lines).toEqual([
      '*NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍨',
      '',
      '*ITENS DO PEDIDO:*',
      '*1x Barca de Açaí* — R$ 34,00',
      '• Cobertura: Chocolate',
      '• Adicionais pagos: Kit Kat (+ R$ 4,00)',
      '',
      '*1x Pote de Açaí 1 Litro Montado* — R$ 30,00',
      '• Adicionais: Granola, Paçoca',
      '• Frutas: Kiwi',
      '',
      '*2x Picolé Gourmet* — R$ 6,00 (R$ 3,00 cada)',
      '• Sabor: Nutella',
      '',
      '*1x Kit Completo Casquinha DUO* — R$ 41,00',
      '• Sabor do sorvete (2 litros): Ninho com morango (outro sabor)',
      '• Sabor da cobertura: Caramelo',
      '',
      '*1x Água Mineral 500 ml* — R$ 2,00',
      '',
      '-----------------------------------',
      '*TOTAL DO PEDIDO: R$ 113,00*',
      '*FORMA DE PAGAMENTO:* Dinheiro',
      '*TROCO PARA:* R$ 150,00 *(Levar troco de R$ 37,00)*',
    ])
  })

  it('Açaí do Oca: o tamanho e o preço dele na mensagem (pedido de 2026-11-16)', () => {
    const cart = addExtraItem(EMPTY_CART, 'acai-do-oca-pronto', { tamanho: '1 Litro' }, 'oca').cart
    const lines = buildOrderMessage(cart, { method: 'pix' }).split(String.fromCharCode(10))
    expect(lines.slice(3, 5)).toEqual(['*1x Açaí do Oca (Pote Pronto)* — R$ 33,00', '• Tamanho: 1 Litro'])
    expect(lines).toContain('*TOTAL DO PEDIDO: R$ 33,00*')
  })

  it('o link do WhatsApp leva a mesma mensagem, com Pix', () => {
    const url = new URL(orderWhatsAppUrl(mixedCart(), { method: 'pix' }))
    expect(url.searchParams.get('text')).toBe(buildOrderMessage(mixedCart(), { method: 'pix' }))
    expect(url.searchParams.get('text')).toContain('*TOTAL DO PEDIDO: R$ 113,00*')
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
