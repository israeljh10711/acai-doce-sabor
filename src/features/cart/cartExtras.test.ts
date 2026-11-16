import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addBlocker,
  addTopping,
  chooseFlavor,
  freeUsed,
  removeTopping,
} from '../catalog/selection.ts'
import {
  EMPTY_CART,
  MAX_ITEM_QUANTITY,
  addExtraItem,
  addItem,
  cartCount,
  cartTotalCents,
  describeExtra,
  describeItem,
  lineTotalCents,
  parseCart,
  removeItem,
  serializeCart,
  setQuantity,
  summarizeSelection,
  unitPriceCents,
} from './cart.ts'

describe('itens das gavetas no carrinho', () => {
  it('item sem escolha entra com quantidade 1 e o preço da tabela', () => {
    const { cart, item } = addExtraItem(EMPTY_CART, 'agua-mineral-500-ml', {}, 'agua')
    expect(item).toEqual({ id: 'agua', kind: 'extra', itemId: 'agua-mineral-500-ml', choices: {}, quantity: 1 })
    expect(cartTotalCents(cart)).toBe(200)
  })

  it('o mesmo item com o mesmo sabor soma na quantidade; outro sabor é outra linha', () => {
    let cart = addExtraItem(EMPTY_CART, 'picole-gourmet', { sabor: 'Nutella' }, 'a').cart
    cart = addExtraItem(cart, 'picole-gourmet', { sabor: 'Nutella' }, 'b').cart
    cart = addExtraItem(cart, 'picole-gourmet', { sabor: 'Paçoca' }, 'c').cart
    expect(cart.items.map((item) => [item.id, item.quantity])).toEqual([
      ['a', 2],
      ['c', 1],
    ])
    expect(cartCount(cart)).toBe(3)
    expect(cartTotalCents(cart)).toBe(900)
  })

  it('a soma para no limite técnico', () => {
    let cart = setQuantity(addExtraItem(EMPTY_CART, 'jujuba', {}, 'j').cart, 'j', MAX_ITEM_QUANTITY)
    cart = addExtraItem(cart, 'jujuba', {}).cart
    expect(cart.items[0].quantity).toBe(MAX_ITEM_QUANTITY)
  })

  it('recusa item que não existe, sabor fora da lista e item de personalizador', () => {
    expect(addExtraItem(EMPTY_CART, 'pizza', {}).item).toBeNull()
    expect(addExtraItem(EMPTY_CART, 'picole-gourmet', { sabor: 'Pistache' }).item).toBeNull()
    expect(addExtraItem(EMPTY_CART, 'picole-gourmet', {}).item).toBeNull()
    expect(addExtraItem(EMPTY_CART, 'barca-de-acai', {}).item).toBeNull()
  })

  it('kit com dois sabores e "outro sabor" escrito pelo cliente', () => {
    const { item } = addExtraItem(EMPTY_CART, 'kit-completo-casquinha', { sorvete: 'ninho com morango', cobertura: 'Caramelo' })
    expect(describeExtra(item!)).toEqual({
      name: 'Kit Completo Casquinha DUO',
      rows: [
        { label: 'Sabor do sorvete (2 litros)', value: 'Ninho com morango (outro sabor)' },
        { label: 'Sabor da cobertura', value: 'Caramelo' },
      ],
    })
  })

  it('Açaí do Oca: o tamanho escolhido decide o preço (500 ml R$ 17,00, 1 Litro R$ 33,00)', () => {
    const litro = addExtraItem(EMPTY_CART, 'acai-do-oca-pronto', { tamanho: '1 Litro' }, 'oca')
    expect([unitPriceCents(litro.item!), describeExtra(litro.item!).rows]).toEqual([3300, [{ label: 'Tamanho', value: '1 Litro' }]])
    const meio = addExtraItem(litro.cart, 'acai-do-oca-pronto', { tamanho: '500 ml' }, 'oca-500')
    expect(meio.cart.items.map((item) => unitPriceCents(item))).toEqual([3300, 1700])
    expect(cartTotalCents(meio.cart)).toBe(5000)
    // Tamanho que não existe, ou escrito pelo cliente: não entra (o tamanho não aceita "outro").
    expect(addExtraItem(EMPTY_CART, 'acai-do-oca-pronto', { tamanho: '2 Litros' }).item).toBeNull()
    expect(addExtraItem(EMPTY_CART, 'acai-do-oca-pronto', {}).item).toBeNull()
  })

  it('soma com os produtos montados; quantidade e remoção funcionam igual', () => {
    const oca = addItem(EMPTY_CART, 'acai-oca', { ...EMPTY_SELECTION, sizeId: 'pote-200' }, 'oca').cart
    let cart = addExtraItem(oca, 'refrigerante-350-ml', { sabor: 'Sprite' }, 'refri').cart
    cart = setQuantity(cart, 'refri', 3)
    expect(lineTotalCents(cart.items[1])).toBe(1500)
    expect(cartTotalCents(cart)).toBe(1000 + 1500)
    cart = removeItem(cart, 'oca')
    expect(cart.items.map((item) => item.id)).toEqual(['refri'])
  })
})

describe('guardar no aparelho, versão 2', () => {
  it('produtos e itens das gavetas voltam iguais', () => {
    let cart = addItem(EMPTY_CART, 'acai-tradicional', { ...EMPTY_SELECTION, sizeId: 'copo-400' }, 'tr').cart
    cart = addExtraItem(cart, 'kit-completo', { sorvete: 'Pavê', cobertura: 'Morango' }, 'kit').cart
    cart = setQuantity(cart, 'kit', 2)
    expect(parseCart(serializeCart(cart)).items).toEqual(cart.items)
  })

  it('lê o carrinho da versão 1 (só produtos montados)', () => {
    const v1 = JSON.stringify({
      v: 1,
      items: [{ id: 'old', slug: 'acai-oca', sizeId: 'pote-200', flavorId: null, toppings: [['granola', 1]], quantity: 2 }],
    })
    expect(parseCart(v1).items).toEqual([
      { id: 'old', kind: 'product', slug: 'acai-oca', selection: { sizeId: 'pote-200', flavorId: null, toppings: { granola: 1 } }, quantity: 2 },
    ])
  })

  it('confere de novo os itens das gavetas: some o que não existe ou tem sabor inválido', () => {
    const raw = JSON.stringify({
      v: 2,
      items: [
        { kind: 'extra', id: 'ok', itemId: 'trufas', choices: [['sabor', 'Beijinho']], quantity: 1 },
        { kind: 'extra', id: 'sumiu', itemId: 'sorvete-de-pizza', choices: [], quantity: 1 },
        { kind: 'extra', id: 'sabor', itemId: 'trufas', choices: [['sabor', 'Pistache']], quantity: 1 },
        { kind: 'extra', id: 'barca', itemId: 'barca-de-acai', choices: [], quantity: 1 },
        { kind: 'extra', id: 'outro', itemId: 'pote-de-sorvete-1-5-litro', choices: [['sabor', '**Coco** queimado']], quantity: 99 },
      ],
    })
    const cart = parseCart(raw)
    expect(cart.items.map((item) => item.id)).toEqual(['ok', 'outro'])
    expect(cart.items[1]).toMatchObject({ choices: { sabor: 'Coco queimado' }, quantity: MAX_ITEM_QUANTITY })
  })
})

describe('produtos das gavetas no personalizador', () => {
  it('Pote de Açaí 1 Litro Montado: tamanho único de R$ 30,00 com 7 adicionais grátis', () => {
    const pote = PRODUCTS['pote-de-acai-1-litro']
    expect(pote.sizes).toEqual([{ id: 'pote-1-litro', name: 'Pote 1 litro', container: 'pote', priceCents: 3000, freeToppings: 7 }])
    expect(pote.groups).toEqual(PRODUCTS['acai-tradicional'].groups)
    let selection: Selection = { ...EMPTY_SELECTION, sizeId: 'pote-1-litro' }
    for (let i = 0; i < 8; i++) selection = addTopping(pote, selection, 'granola')
    expect(selection.toppings).toEqual({ granola: 7 })
    const summary = summarizeSelection('pote-de-acai-1-litro', selection)
    expect([summary.sizeLabel, summary.unitCents]).toEqual(['', 3000])
  })

  it('Barca de Açaí: R$ 30,00 com 1 cobertura, 2 frutas e 7 adicionais grátis; adicionais pagos à parte', () => {
    const barca = PRODUCTS['barca-de-acai']
    expect(barca.sizes.map((size) => [size.name, size.priceCents, size.freeToppings])).toEqual([['Barca', 3000, 7]])
    expect(barca.flavors.map((flavor) => flavor.name)).toEqual([
      'Frutas vermelhas',
      'Doce de leite',
      'Açaí',
      'Banana caramelada',
      'Chocolate',
      'Morango',
    ])
    expect(barca.groups).toEqual(['dry', 'fruit', 'paid'])
    const noCover = { ...EMPTY_SELECTION, sizeId: 'barca' }
    expect(addItem(EMPTY_CART, 'barca-de-acai', noCover).item).toBeNull()
    const withCover = addTopping(barca, chooseFlavor(barca, noCover, 'calda-chocolate'), 'kit-kat')
    const { item } = addItem(EMPTY_CART, 'barca-de-acai', withCover)
    expect(describeItem(item!)).toMatchObject({ productName: 'Barca de Açaí', sizeName: '', flavorLabel: 'Cobertura', flavorName: 'Chocolate' })
    expect(summarizeSelection('barca-de-acai', withCover).unitCents).toBe(3400)

    // 2 frutas: a terceira não entra.
    let full = addTopping(barca, addTopping(barca, withCover, 'kiwi'), 'morango')
    expect(addBlocker(barca, full, 'banana')).toBe('group-limit')
    expect(addTopping(barca, full, 'banana')).toBe(full)
    // 7 adicionais grátis: o oitavo não entra.
    for (let unit = 0; unit < 7; unit++) full = addTopping(barca, full, unit < 4 ? 'granola' : 'pacoca')
    expect([freeUsed(full), addBlocker(barca, full, 'amendoim')]).toEqual([7, 'free-limit'])
    // Tudo isso pelo mesmo preço: só o Kit Kat é cobrado.
    expect(summarizeSelection('barca-de-acai', full).unitCents).toBe(3400)
    // Tirar uma fruta libera outra.
    expect(addBlocker(barca, removeTopping(full, 'kiwi'), 'banana')).toBeNull()
    // Montagem guardada com 3 frutas (de antes da regra): volta com 2.
    const stored = { ...full, toppings: { ...full.toppings, banana: 1 } }
    const normalized = addItem(EMPTY_CART, 'barca-de-acai', stored).item!
    expect(Object.keys(normalized.selection.toppings).filter((id) => ['kiwi', 'morango', 'banana'].includes(id))).toEqual(['kiwi', 'morango'])
  })
})
