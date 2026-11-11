import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './categories.ts'
import { MAX_PAID_UNITS, PRODUCTS, TOPPING_GROUPS, TOPPINGS, getTopping, toppingsOf } from './menu.ts'

/** Nome, preço em centavos e adicionais gratuitos de cada tamanho de um produto. */
const sizeTable = (slug: keyof typeof PRODUCTS) =>
  PRODUCTS[slug].sizes.map((size) => [size.name, size.priceCents, size.freeToppings])

const namesOf = (group: keyof typeof TOPPING_GROUPS) =>
  TOPPINGS.filter((topping) => topping.group === group).map((topping) => topping.name)

describe('cardápio do Açaí Tradicional', () => {
  it('tem os dez tamanhos, com o preço e os adicionais gratuitos confirmados', () => {
    expect(sizeTable('acai-tradicional')).toEqual([
      ['Pote 150 ml', 600, 2],
      ['Pote 200 ml', 700, 2],
      ['Pote 250 ml', 800, 2],
      ['Pote 530 ml', 1300, 4],
      ['Copo 400 ml', 1000, 3],
      ['Copo 500 ml', 1200, 3],
      ['Isopor P', 1100, 4],
      ['Isopor M', 1500, 5],
      ['Isopor G', 1800, 6],
      ['Isopor GG', 2200, 7],
    ])
  })
})

describe('cardápio do Açaí Oca', () => {
  it('tem os oito tamanhos, sem 150 ml e 250 ml, com preços próprios', () => {
    expect(sizeTable('acai-oca')).toEqual([
      ['Pote 200 ml', 1000, 2],
      ['Pote 530 ml', 2000, 4],
      ['Copo 400 ml', 1700, 3],
      ['Copo 500 ml', 2000, 3],
      ['Isopor P', 1600, 4],
      ['Isopor M', 2200, 5],
      ['Isopor G', 3000, 6],
      ['Isopor GG', 3800, 7],
    ])
  })
})

describe('cardápio do Milk-shake', () => {
  it('tem dois tamanhos, sem adicionais gratuitos', () => {
    expect(sizeTable('milk-shake')).toEqual([
      ['400 ml', 1000, 0],
      ['500 ml', 1200, 0],
    ])
  })

  it('tem os 13 sabores, na ordem do cardápio', () => {
    expect(PRODUCTS['milk-shake'].flavors.map((flavor) => flavor.name)).toEqual([
      'Açaí',
      'Toffe',
      'Ninho',
      'Pitaya',
      'Maracujá',
      'Morango',
      'Prestígio',
      'Chocolate',
      'Choconute',
      'Laka Bis',
      'Iogurte Grego',
      'Ninho Trufado',
      'Chocolate Branco',
    ])
  })

  it('aceita só coberturas e adicionais pagos', () => {
    expect(PRODUCTS['milk-shake'].groups).toEqual(['syrup', 'paid'])
  })
})

describe('ingredientes', () => {
  it('lista os 12 adicionais do cardápio', () => {
    expect(namesOf('dry')).toEqual([
      'Leite em pó',
      'Granola',
      'Biscoito',
      'Paçoca',
      'Chocoball',
      'Amendoim',
      'Gotas de chocolate',
      'Canudinho',
      'BIS',
      'Farinha láctea',
      'Sucrilhos',
      'Marshmallow',
    ])
  })

  it('lista as 3 frutas e as 7 coberturas do cardápio', () => {
    expect(namesOf('fruit')).toEqual(['Kiwi', 'Morango', 'Banana'])
    expect(namesOf('syrup')).toEqual([
      'Leite condensado',
      'Morango',
      'Chocolate',
      'Banana caramelizada',
      'Açaí',
      'Doce de leite',
      'Frutas vermelhas',
    ])
  })

  it('cobra só os adicionais pagos, pelos preços do cardápio', () => {
    const paid = TOPPINGS.filter((topping) => topping.group === 'paid')

    expect(paid.map((topping) => [topping.name, topping.priceCents])).toEqual([
      ['Creme de avelã', 300],
      ['Creme de ninho', 300],
      ['Cereja', 300],
      ['Kit Kat', 400],
    ])
    for (const topping of TOPPINGS.filter((item) => item.group !== 'paid')) {
      expect(topping.priceCents).toBe(0)
    }
  })

  it('tem identificadores únicos, sem acentos nem espaços', () => {
    const ids = TOPPINGS.map((topping) => topping.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('encontra um ingrediente pelo identificador', () => {
    expect(getTopping('kit-kat')?.name).toBe('Kit Kat')
    expect(getTopping('pizza')).toBeUndefined()
  })
})

describe('regras dos grupos', () => {
  it('adicionais contam no limite; frutas e coberturas são inclusas; pagos são cobrados', () => {
    expect(TOPPING_GROUPS.dry.rule).toBe('limited')
    expect(TOPPING_GROUPS.fruit.rule).toBe('included')
    expect(TOPPING_GROUPS.syrup.rule).toBe('included')
    expect(TOPPING_GROUPS.paid.rule).toBe('paid')
  })

  it('os dois açaís aceitam os quatro grupos, com adicionais primeiro', () => {
    expect(PRODUCTS['acai-tradicional'].groups).toEqual(['dry', 'fruit', 'syrup', 'paid'])
    expect(PRODUCTS['acai-oca'].groups).toEqual(['dry', 'fruit', 'syrup', 'paid'])
  })

  it('entrega a um produto só os ingredientes dos grupos que ele aceita', () => {
    expect(toppingsOf(PRODUCTS['acai-oca'], 'dry')).toHaveLength(12)
    expect(toppingsOf(PRODUCTS['milk-shake'], 'syrup')).toHaveLength(7)
    expect(toppingsOf(PRODUCTS['milk-shake'], 'paid')).toHaveLength(4)
    expect(toppingsOf(PRODUCTS['milk-shake'], 'dry')).toEqual([])
    expect(toppingsOf(PRODUCTS['milk-shake'], 'fruit')).toEqual([])
  })

  it('tem um limite técnico de unidades por adicional pago', () => {
    expect(MAX_PAID_UNITS).toBe(10)
  })
})

describe('produtos e categorias', () => {
  it('existe um produto para cada categoria de Monte seu Pedido', () => {
    expect(Object.keys(PRODUCTS)).toEqual(CATEGORIES.map((category) => category.slug))
    for (const category of CATEGORIES) {
      expect(PRODUCTS[category.slug].name).toBe(category.name)
    }
  })

  it('os resumos das categorias batem com o cardápio', () => {
    const summaryOf = (slug: string) => CATEGORIES.find((category) => category.slug === slug)?.summary

    expect(PRODUCTS['acai-oca'].sizes[0].name).toBe('Pote 200 ml')
    expect(summaryOf('acai-oca')).toContain('200 ml')
    expect(PRODUCTS['acai-tradicional'].sizes[0].name).toBe('Pote 150 ml')
    expect(summaryOf('acai-tradicional')).toContain('150 ml')
    expect(summaryOf('milk-shake')).toContain(`${PRODUCTS['milk-shake'].flavors.length} sabores`)
  })

  it('todo preço é um número inteiro de centavos, maior que zero nos tamanhos', () => {
    for (const product of Object.values(PRODUCTS)) {
      for (const size of product.sizes) {
        expect(Number.isInteger(size.priceCents)).toBe(true)
        expect(size.priceCents).toBeGreaterThan(0)
      }
    }
  })
})
