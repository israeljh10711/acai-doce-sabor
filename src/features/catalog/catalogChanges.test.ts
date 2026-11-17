import { describe, expect, it } from 'vitest'
import { BASE_CATEGORIES } from './categories.ts'
import { type CatalogChanges, type CatalogData, NO_CHANGES, applyChanges, parseChanges } from './catalogChanges.ts'
import { BASE_EXTRA_ITEMS } from './extras.ts'
import { BASE_PRODUCTS, BASE_TOPPINGS } from './menu.ts'

const BASE: CatalogData = { items: BASE_EXTRA_ITEMS, toppings: BASE_TOPPINGS, products: BASE_PRODUCTS, categories: BASE_CATEGORIES }
const changes = (partial: Partial<CatalogChanges>): CatalogChanges => ({ ...NO_CHANGES, ...partial })
const item = (data: CatalogData, id: string) => data.items.find((candidate) => candidate.id === id)
const topping = (data: CatalogData, id: string) => data.toppings.find((candidate) => candidate.id === id)

describe('mudanças do vendedor sobre o cardápio (modo vendedor, 2026-11-16)', () => {
  it('sem mudanças, o cardápio é o do código', () => {
    const data = applyChanges(BASE, NO_CHANGES)
    expect(data.items).toEqual(BASE_EXTRA_ITEMS)
    expect(data.toppings).toEqual(BASE_TOPPINGS)
    expect(data.products).toEqual(BASE_PRODUCTS)
    expect(data.categories).toEqual(BASE_CATEGORIES)
  })

  it('editar nome, preço, preço antigo, descrição, foto e disponibilidade de um item, sem mexer na base', () => {
    const data = applyChanges(
      BASE,
      changes({
        items: {
          sundae: { name: 'Sundae duplo', priceCents: 900, originalPriceCents: 1100, description: 'Duas bolas', image: 'https://x/s.webp', available: false },
        },
      }),
    )
    expect(item(data, 'sundae')).toMatchObject({
      name: 'Sundae duplo',
      priceCents: 900,
      originalPriceCents: 1100,
      description: 'Duas bolas',
      image: 'https://x/s.webp',
      imageAlt: 'Sundae duplo',
      available: false,
    })
    expect(item(BASE, 'sundae')?.name).toBe('Sundae')
  })

  it('preço antigo null tira o riscado', () => {
    const data = applyChanges(BASE, changes({ items: { trufas: { originalPriceCents: null } } }))
    expect(item(data, 'trufas')?.originalPriceCents).toBeUndefined()
  })

  it('sabores: trocam o primeiro grupo; item direto com sabores passa a pedir o sabor; lista vazia volta a ser direto', () => {
    const data = applyChanges(
      BASE,
      changes({ items: { sundae: { flavors: ['Morango', 'Uva'] }, moreninha: { flavors: ['Chocolate', 'Coco'] }, cremosinho: { flavors: [] } } }),
    )
    const sundae = item(data, 'sundae')!
    expect(sundae.action.type === 'flavor_modal' && sundae.action.choices[0].options).toEqual(['Morango', 'Uva'])
    const moreninha = item(data, 'moreninha')!
    expect(moreninha.action).toEqual({ type: 'flavor_modal', choices: [{ id: 'sabor', label: 'Sabor', options: ['Chocolate', 'Coco'] }] })
    expect(item(data, 'cremosinho')!.action).toEqual({ type: 'direct_confirm' })
  })

  it('item novo: entra no fim da seção; com sabores pede o sabor, sem sabores vai direto', () => {
    const data = applyChanges(
      BASE,
      changes({
        items: {
          'novo-picole-trufado': {
            created: true,
            drawer: 'picoles-e-sorvetes',
            name: 'Picolé trufado',
            priceCents: 300,
            description: 'Picolé trufado sabor chocolate',
            image: 'https://x/p.webp',
          },
          'novo-bala': { created: true, drawer: 'doces-e-bomboniere', name: 'Bala', priceCents: 50, description: 'Bala', flavors: ['Menta'] },
        },
      }),
    )
    const picoles = data.items.filter((candidate) => candidate.drawer === 'picoles-e-sorvetes')
    expect(picoles.at(-1)).toMatchObject({ id: 'novo-picole-trufado', name: 'Picolé trufado', priceCents: 300, action: { type: 'direct_confirm' } })
    expect(item(data, 'novo-bala')!.action.type).toBe('flavor_modal')
    expect(data.items).toHaveLength(BASE_EXTRA_ITEMS.length + 2)
  })

  it('item novo sem nome, preço ou seção válidos fica de fora', () => {
    const data = applyChanges(BASE, changes({ items: { 'novo-x': { created: true, name: '', priceCents: 100, drawer: 'bebidas' } } }))
    expect(item(data, 'novo-x')).toBeUndefined()
  })

  it('excluir tira o item; o Pote 1 L e a Barca (personalizador) não podem ser excluídos', () => {
    const data = applyChanges(BASE, changes({ items: { sundae: { deleted: true }, 'barca-de-acai': { deleted: true } } }))
    expect(item(data, 'sundae')).toBeUndefined()
    expect(item(data, 'barca-de-acai')).toBeDefined()
  })

  it('mover de seção', () => {
    const data = applyChanges(BASE, changes({ items: { sundae: { drawer: 'combos-e-ofertas' } } }))
    expect(item(data, 'sundae')!.drawer).toBe('combos-e-ofertas')
  })

  it('o preço do Pote 1 L também muda o tamanho do personalizador; o nome também', () => {
    const data = applyChanges(BASE, changes({ items: { 'pote-de-acai-1-litro': { priceCents: 3200, name: 'Pote 1 Litro' } } }))
    expect(data.products['pote-de-acai-1-litro'].sizes[0].priceCents).toBe(3200)
    expect(data.products['pote-de-acai-1-litro'].name).toBe('Pote 1 Litro')
  })

  it('produto principal: nome, descrição, foto e preço de cada tamanho', () => {
    const data = applyChanges(
      BASE,
      changes({ products: { 'acai-oca': { name: 'Oca Premium', description: 'Nova frase', image: 'https://x/o.webp', sizePrices: { 'pote-200': 1100, inexistente: 5 } } } }),
    )
    const category = data.categories.find((candidate) => candidate.slug === 'acai-oca')!
    expect([category.name, category.tagline, category.photo]).toEqual(['Oca Premium', 'Nova frase', 'https://x/o.webp'])
    expect(data.products['acai-oca'].name).toBe('Oca Premium')
    expect(data.products['acai-oca'].sizes.find((size) => size.id === 'pote-200')?.priceCents).toBe(1100)
    expect(data.products['acai-oca'].sizes).toHaveLength(BASE_PRODUCTS['acai-oca'].sizes.length)
  })

  it('complementos: editar, esgotar, excluir e criar', () => {
    const data = applyChanges(
      BASE,
      changes({
        toppings: {
          granola: { name: 'Granola crocante', image: 'https://x/g.webp' },
          'farinha-lactea': { available: false },
          pacoca: { deleted: true },
          'novo-ovomaltine': { created: true, group: 'dry', name: 'Ovomaltine', priceCents: 0 },
          'novo-sem-nome': { created: true, group: 'dry', name: '  ' },
        },
      }),
    )
    expect(topping(data, 'granola')).toMatchObject({ name: 'Granola crocante', image: 'https://x/g.webp' })
    expect(topping(data, 'farinha-lactea')?.available).toBe(false)
    expect(topping(data, 'pacoca')).toBeUndefined()
    expect(topping(data, 'novo-ovomaltine')).toEqual({ id: 'novo-ovomaltine', group: 'dry', name: 'Ovomaltine', priceCents: 0 })
    expect(topping(data, 'novo-sem-nome')).toBeUndefined()
  })
})

describe('leitura das mudanças guardadas ou vindas da rede (parseChanges)', () => {
  it('aceita só campos válidos e ignora o resto', () => {
    const parsed = parseChanges({
      items: {
        sundae: { name: 'Ok', priceCents: -5, originalPriceCents: 'x', flavors: ['A', 3, ' B '], drawer: 'inexistente', available: 'sim' },
        '': { name: 'sem id' },
      },
      products: { 'acai-oca': { sizePrices: { 'pote-200': 1200, 'pote-530': 1.5 } }, inexistente: { name: 'x' } },
      toppings: { granola: { priceCents: 300, group: 'xyz' } },
      extra: true,
    })
    expect(parsed).toEqual({
      items: { sundae: { name: 'Ok', flavors: ['A', 'B'] } },
      products: { 'acai-oca': { sizePrices: { 'pote-200': 1200 } } },
      toppings: { granola: { priceCents: 300 } },
    })
  })

  it('lixo vira "sem mudanças"', () => {
    expect(parseChanges(null)).toEqual(NO_CHANGES)
    expect(parseChanges('texto')).toEqual(NO_CHANGES)
  })
})
