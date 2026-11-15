import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './categories.ts'
import { MAX_PAID_UNITS, PRODUCTS, TOPPING_GROUPS, TOPPINGS, getTopping, toppingsOf } from './menu.ts'

/** Nome, preço em centavos e adicionais gratuitos de cada tamanho de um produto. */
const sizeTable = (slug: keyof typeof PRODUCTS) =>
  PRODUCTS[slug].sizes.map((size) => [size.name, size.priceCents, size.freeToppings])


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

  it('mostra o aviso de disponibilidade de sabores; o batido não tem aviso', () => {
    expect(PRODUCTS['milk-shake'].flavorNotice).toBe('Favor verificar com a nossa atendente a disponibilidade de sabores.')
    expect(PRODUCTS['acai-batido'].flavorNotice).toBeUndefined()
  })
})

describe('ingredientes', () => {
  const names = (slug: keyof typeof PRODUCTS, group: keyof typeof TOPPING_GROUPS) =>
    toppingsOf(PRODUCTS[slug], group).map((topping) => topping.name)

  it('o Biscoito saiu do cardápio: a loja não trabalha com ele', () => {
    expect(TOPPINGS.filter((topping) => /biscoito/i.test(`${topping.id} ${topping.name}`))).toEqual([])
  })

  it('lista os 13 adicionais: os do cardápio sem o Biscoito, o leite condensado e o disquete', () => {
    expect(names('acai-oca', 'dry')).toEqual([
      'Leite em pó',
      'Granola',
      'Paçoca',
      'Chocoball',
      'Amendoim',
      'Gotas de chocolate',
      'Canudinho',
      'BIS',
      'Farinha láctea',
      'Sucrilhos',
      'Marshmallow',
      'Leite condensado',
      'Disquete (confete)',
    ])
  })

  it('lista as 3 frutas e as caldas e cremes, na ordem pedida', () => {
    expect(names('acai-tradicional', 'fruit')).toEqual(['Kiwi', 'Morango', 'Banana'])
    expect(names('acai-tradicional', 'syrup')).toEqual([
      'Creme de ninho',
      'Creme de avelã',
      'Frutas vermelhas',
      'Doce de leite',
      'Açaí',
      'Banana caramelada',
      'Chocolate',
      'Morango',
    ])
  })

  it('no açaí, o leite condensado é adicional; o milk-shake continua com ele como cobertura', () => {
    expect(names('acai-oca', 'syrup')).not.toContain('Leite condensado')
    expect(names('milk-shake', 'syrup')).toContain('Leite condensado')
    expect(names('milk-shake', 'dry')).toEqual([])
  })

  it('cobra só os cremes, os adicionais pagos e os do batido, pelos preços do cardápio', () => {
    const priced = TOPPINGS.filter((topping) => topping.priceCents > 0).map((topping) => [topping.id, topping.priceCents])
    expect(priced).toEqual([
      ['creme-de-ninho', 300],
      ['creme-de-avela', 300],
      ['cereja', 300],
      ['kit-kat', 400],
      ['batido-creme-de-avela', 300],
      ['batido-creme-de-morango', 300],
      ['batido-creme-de-cookies', 300],
      ['batido-creme-de-ninho', 300],
      ['batido-ovomaltine', 300],
    ])
    for (const topping of TOPPINGS.filter((item) => item.group === 'dry' || item.group === 'fruit')) {
      expect(topping.priceCents, topping.id).toBe(0)
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
  it('adicionais contam no limite; frutas, caldas e cremes entram uma vez; pagos são por unidade', () => {
    expect(TOPPING_GROUPS.dry.rule).toBe('limited')
    expect(TOPPING_GROUPS.fruit.rule).toBe('included')
    expect(TOPPING_GROUPS.syrup).toMatchObject({ name: 'Caldas e cremes', rule: 'included' })
    expect(TOPPING_GROUPS.paid.rule).toBe('paid')
  })

  it('os dois açaís aceitam os quatro grupos, com adicionais primeiro', () => {
    expect(PRODUCTS['acai-tradicional'].groups).toEqual(['dry', 'fruit', 'syrup', 'paid'])
    expect(PRODUCTS['acai-oca'].groups).toEqual(['dry', 'fruit', 'syrup', 'paid'])
  })

  it('entrega a um produto só os ingredientes dos grupos que ele aceita', () => {
    expect(toppingsOf(PRODUCTS['acai-oca'], 'dry')).toHaveLength(13)
    expect(toppingsOf(PRODUCTS['acai-oca'], 'syrup')).toHaveLength(8)
    expect(toppingsOf(PRODUCTS['milk-shake'], 'syrup')).toHaveLength(9)
    expect(toppingsOf(PRODUCTS['milk-shake'], 'paid').map((topping) => topping.name)).toEqual(['Cereja', 'Kit Kat'])
    expect(toppingsOf(PRODUCTS['milk-shake'], 'dry')).toEqual([])
    expect(toppingsOf(PRODUCTS['milk-shake'], 'fruit')).toEqual([])
  })

  it('tem um limite técnico de unidades por adicional pago', () => {
    expect(MAX_PAID_UNITS).toBe(10)
  })
})

describe('produtos e categorias', () => {
  it('existe um produto para cada categoria e para os dois das gavetas (Pote 1 L Montado e Barca)', () => {
    expect(Object.keys(PRODUCTS)).toEqual([...CATEGORIES.map((category) => category.slug), 'pote-de-acai-1-litro', 'barca-de-acai'])
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
    expect(summaryOf('acai-batido')).toContain(`${PRODUCTS['acai-batido'].flavors.length} sabores`)
    expect(summaryOf('acai-batido')).toContain('300 ml')
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
