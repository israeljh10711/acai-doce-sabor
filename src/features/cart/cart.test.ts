import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, type Selection, addTopping, chooseFlavor, chooseSize, priceOf } from '../catalog/selection.ts'
import {
  type Cart,
  EMPTY_CART,
  type ProductCartItem,
  MAX_ITEM_QUANTITY,
  addItem,
  cartCount,
  cartTotalCents,
  choiceText,
  describeItem,
  lineTotalCents,
  newItemId,
  parseCart,
  removeItem,
  serializeCart,
  setQuantity,
  summarizeSelection,
  unitPriceCents,
  updateItem,
} from './cart.ts'

type Slug = keyof typeof PRODUCTS

/** O item na posição, que precisa ser um produto montado. */
function productAt(cart: Cart, index: number): ProductCartItem {
  const item = cart.items[index]
  if (item.kind !== 'product') throw new Error(`item ${index} não é um produto montado`)
  return item
}

/** Montagem pronta: tamanho, sabor (se houver) e ingredientes, na ordem dada. */
function built(slug: Slug, sizeId: string, toppings: string[] = [], flavorId?: string): Selection {
  const product = PRODUCTS[slug]
  let selection = chooseSize(product, EMPTY_SELECTION, sizeId).selection
  if (flavorId) selection = chooseFlavor(product, selection, flavorId)
  for (const id of toppings) selection = addTopping(product, selection, id)
  return selection
}

describe('adicionar ao carrinho', () => {
  it('aceita um produto completo, com quantidade 1', () => {
    const { cart, item } = addItem(EMPTY_CART, 'acai-oca', built('acai-oca', 'copo-500', ['granola']), 'a')
    expect(cart.items).toHaveLength(1)
    expect(item).toMatchObject({ id: 'a', slug: 'acai-oca', quantity: 1 })
  })

  it('recusa montagem sem tamanho, ou sem sabor quando o produto tem sabores', () => {
    expect(addItem(EMPTY_CART, 'acai-oca', EMPTY_SELECTION).item).toBeNull()
    expect(addItem(EMPTY_CART, 'milk-shake', built('milk-shake', '400-ml')).item).toBeNull()
    expect(addItem(EMPTY_CART, 'acai-batido', built('acai-batido', '300-ml')).item).toBeNull()
  })

  it('guarda o mesmo preço que o personalizador mostra', () => {
    const selection = built('acai-tradicional', 'isopor-g', ['granola', 'banana', 'kit-kat', 'kit-kat'])
    const { item } = addItem(EMPTY_CART, 'acai-tradicional', selection)
    expect(unitPriceCents(item!)).toBe(priceOf(PRODUCTS['acai-tradicional'], selection)?.totalCents)
    expect(unitPriceCents(item!)).toBe(1800 + 2 * 400)
  })

  it('confere as regras de novo: o que passa do limite grátis não entra', () => {
    const tooMany: Selection = { sizeId: 'copo-500', flavorId: null, toppings: { granola: 2, pacoca: 2 } }
    const { item } = addItem(EMPTY_CART, 'acai-oca', tooMany)
    expect(item?.selection.toppings).toEqual({ granola: 2, pacoca: 1 })
  })
})

describe('itens independentes', () => {
  it('mudar a montagem depois de adicionar não muda o item já adicionado', () => {
    const product = PRODUCTS['acai-tradicional']
    const first = built('acai-tradicional', 'copo-400', ['granola'])
    let cart = addItem(EMPTY_CART, 'acai-tradicional', first, 'a').cart

    // O cliente continua mexendo no personalizador e adiciona outro.
    const second = addTopping(product, addTopping(product, first, 'banana'), 'creme-de-avela')
    cart = addItem(cart, 'acai-tradicional', second, 'b').cart

    expect(productAt(cart, 0).selection.toppings).toEqual({ granola: 1 })
    expect(productAt(cart, 1).selection.toppings).toEqual({ granola: 1, banana: 1, 'creme-de-avela': 1 })
  })

  it('o item guardado não pode ser alterado por fora', () => {
    const selection = built('acai-oca', 'pote-200', ['granola'])
    const { item } = addItem(EMPTY_CART, 'acai-oca', selection)
    expect(Object.isFrozen(item!.selection.toppings)).toBe(true)
    expect(item!.selection).not.toBe(selection)
  })

  it('editar um item não mexe nos outros', () => {
    let cart = addItem(EMPTY_CART, 'acai-oca', built('acai-oca', 'pote-200', ['granola']), 'a').cart
    cart = addItem(cart, 'acai-oca', built('acai-oca', 'pote-200', ['granola']), 'b').cart
    cart = updateItem(cart, 'b', built('acai-oca', 'isopor-gg', ['pacoca', 'morango']))

    expect(productAt(cart, 0).selection).toMatchObject({ sizeId: 'pote-200', toppings: { granola: 1 } })
    expect(productAt(cart, 1).selection).toMatchObject({ sizeId: 'isopor-gg', toppings: { pacoca: 1, morango: 1 } })
  })

  it('edição incompleta é ignorada', () => {
    const cart = addItem(EMPTY_CART, 'milk-shake', built('milk-shake', '500-ml', [], 'morango'), 'a').cart
    expect(updateItem(cart, 'a', built('milk-shake', '500-ml'))).toBe(cart)
  })
})

describe('quantidades, remoção e totais', () => {
  const twoItems = () => {
    let cart = addItem(EMPTY_CART, 'acai-batido', built('acai-batido', '500-ml', ['batido-creme-de-cookies', 'batido-creme-de-cookies'], 'leite-condensado'), 'a').cart
    cart = addItem(cart, 'milk-shake', built('milk-shake', '400-ml', ['calda-chocolate', 'cereja'], 'ninho'), 'b').cart
    return cart
  }

  it('calcula preço unitário, total do item e total geral', () => {
    let cart = twoItems()
    cart = setQuantity(cart, 'a', 2)
    const [batido, shake] = cart.items

    expect(unitPriceCents(batido)).toBe(1200 + 2 * 300)
    expect(lineTotalCents(batido)).toBe(2 * 1800)
    expect(unitPriceCents(shake)).toBe(1000 + 300)
    expect(cartTotalCents(cart)).toBe(3600 + 1300)
    expect(cartCount(cart)).toBe(3)
  })

  it('a quantidade fica entre 1 e o limite técnico', () => {
    const cart = twoItems()
    expect(setQuantity(cart, 'a', 0).items[0].quantity).toBe(1)
    expect(setQuantity(cart, 'a', -3).items[0].quantity).toBe(1)
    expect(setQuantity(cart, 'a', 999).items[0].quantity).toBe(MAX_ITEM_QUANTITY)
    expect(setQuantity(cart, 'a', 2.5).items[0].quantity).toBe(1)
  })

  it('remove só o item pedido', () => {
    const cart = removeItem(twoItems(), 'a')
    expect(cart.items.map((item) => item.id)).toEqual(['b'])
    expect(removeItem(cart, 'nao-existe')).toBe(cart)
  })

  it('carrinho vazio custa zero', () => {
    expect(cartTotalCents(EMPTY_CART)).toBe(0)
    expect(cartCount(EMPTY_CART)).toBe(0)
  })
})

describe('descrição do item', () => {
  it('lista tamanho, recipiente, sabor, grátis por grupo e pagos', () => {
    const selection = built('acai-tradicional', 'copo-500', ['leite-em-po', 'leite-em-po', 'leite-condensado', 'banana', 'calda-morango', 'creme-de-ninho'])
    const { item } = addItem(EMPTY_CART, 'acai-tradicional', selection)
    const description = describeItem(item!)

    expect(description).toMatchObject({ productName: 'Açaí Tradicional', sizeName: 'Copo 500 ml', container: 'Copo', flavorName: null })
    expect(description.included).toEqual([
      { group: 'Adicionais', items: ['2x Leite em pó', 'Leite condensado'] },
      { group: 'Frutas', items: ['Banana'] },
      // O creme de ninho tem preço: vai nas linhas pagas, não aqui.
      { group: 'Caldas e cremes', items: ['Morango'] },
    ])
    expect(description.paid.map((line) => [line.name, line.quantity, line.totalCents])).toEqual([['Creme de ninho', 1, 300]])
  })

  it('mostra o sabor do batido', () => {
    const { item } = addItem(EMPTY_CART, 'acai-batido', built('acai-batido', '300-ml', [], 'leite-condensado-pacoca'))
    expect(describeItem(item!).flavorName).toBe('Açaí com Leite Condensado e Paçoca')
  })
})

describe('resumo para a confirmação e a mensagem', () => {
  it('lista cada grupo com escolha, com os cremes pagos junto das caldas', () => {
    const summary = summarizeSelection(
      'acai-tradicional',
      built('acai-tradicional', 'isopor-m', ['granola', 'granola', 'kiwi', 'creme-de-ninho', 'calda-chocolate', 'cereja']),
    )
    expect(summary.productName).toBe('Açaí Tradicional')
    expect(summary.sizeLabel).toBe('Isopor M')
    expect(summary.flavorName).toBeNull()
    expect(summary.sections.map((section) => [section.label, section.items.map(choiceText)])).toEqual([
      ['Adicionais', ['2x Granola']],
      ['Frutas', ['Kiwi']],
      ['Caldas e cremes', ['Creme de ninho (+ R$ 3,00)', 'Chocolate']],
      ['Adicionais pagos', ['Cereja (+ R$ 3,00)']],
    ])
    expect(summary.unitCents).toBe(priceOf(PRODUCTS['acai-tradicional'], built('acai-tradicional', 'isopor-m', ['granola', 'granola', 'kiwi', 'creme-de-ninho', 'calda-chocolate', 'cereja']))!.totalCents)
  })

  it('põe o recipiente no tamanho e traz o sabor', () => {
    const summary = summarizeSelection('acai-batido', built('acai-batido', '500-ml', ['batido-creme-de-avela', 'batido-creme-de-avela'], 'leite-condensado'))
    expect(summary.sizeLabel).toBe('Copo 500 ml')
    expect(summary.flavorName).toBe('Açaí Batido com Leite Condensado')
    expect(summary.sections.map((section) => section.items.map(choiceText))).toEqual([['2x Creme de avelã (+ R$ 6,00)']])
  })

  it('montagem sem ingredientes não tem grupos', () => {
    expect(summarizeSelection('acai-oca', built('acai-oca', 'pote-200')).sections).toEqual([])
  })
})

describe('guardar no aparelho', () => {
  it('volta igual depois de guardar e ler', () => {
    const cart = setQuantity(
      addItem(EMPTY_CART, 'acai-oca', built('acai-oca', 'isopor-m', ['granola', 'pacoca', 'kiwi', 'kit-kat']), 'x').cart,
      'x',
      3,
    )
    const restored = parseCart(serializeCart(cart))
    expect(restored.items).toEqual(cart.items)
    expect(Object.keys(productAt(restored, 0).selection.toppings)).toEqual(['granola', 'pacoca', 'kiwi', 'kit-kat'])
  })

  it('ignora dado corrompido, versão desconhecida e itens inválidos', () => {
    expect(parseCart(null)).toEqual(EMPTY_CART)
    expect(parseCart('{quebrado')).toEqual(EMPTY_CART)
    expect(parseCart(JSON.stringify({ v: 99, items: [] }))).toEqual(EMPTY_CART)

    const raw = JSON.stringify({
      v: 1,
      items: [
        { id: 'ok', slug: 'acai-oca', sizeId: 'pote-200', flavorId: null, toppings: [['granola', 1]], quantity: 1 },
        { id: 'pizza', slug: 'pizza', sizeId: 'g', flavorId: null, toppings: [], quantity: 1 },
        { id: 'sem-tamanho', slug: 'acai-oca', sizeId: 'copo-900', flavorId: null, toppings: [], quantity: 1 },
        { id: 'ok', slug: 'acai-oca', sizeId: 'pote-200', flavorId: null, toppings: [], quantity: 1 },
        { id: 'qtd', slug: 'acai-tradicional', sizeId: 'pote-150', flavorId: null, toppings: [['cereja', 50]], quantity: 1e9 },
      ],
    })
    const cart = parseCart(raw)
    expect(cart.items.map((item) => item.id)).toEqual(['ok', 'qtd'])
    expect(cart.items[1].quantity).toBe(MAX_ITEM_QUANTITY)
    expect(productAt(cart, 1).selection.toppings).toEqual({ cereja: 10 })
  })

  it('carrinho guardado com Biscoito (saiu do cardápio) volta sem ele', () => {
    const raw = JSON.stringify({
      v: 1,
      items: [
        {
          id: 'antigo',
          slug: 'acai-oca',
          sizeId: 'pote-200',
          flavorId: null,
          toppings: [
            ['biscoito', 1],
            ['granola', 1],
          ],
          quantity: 1,
        },
      ],
    })
    expect(productAt(parseCart(raw), 0).selection.toppings).toEqual({ granola: 1 })
  })
})

describe('identificador', () => {
  it('é aleatório e sem depender de HTTPS', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newItemId()))
    expect(ids.size).toBe(50)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/)
  })
})
