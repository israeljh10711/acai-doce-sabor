import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, addItem, cartItemProblem, parseCart, serializeCart } from '../cart/cart.ts'
import { BASE_CATEGORIES } from './categories.ts'
import { type CatalogChanges, type CatalogData, NO_CHANGES, applyChanges, parseChanges } from './catalogChanges.ts'
import { setCatalogChanges } from './catalogStore.ts'
import { BASE_DRAWERS, BASE_EXTRA_ITEMS, choiceGroupsOf } from './extras.ts'
import { BASE_PRODUCTS, BASE_TOPPINGS, PRODUCTS } from './menu.ts'
import { EMPTY_SELECTION, chooseFlavor, chooseSize, missingChoices } from './selection.ts'

const BASE: CatalogData = { items: BASE_EXTRA_ITEMS, toppings: BASE_TOPPINGS, products: BASE_PRODUCTS, categories: BASE_CATEGORIES, drawers: BASE_DRAWERS, groupTitles: {} }
const changes = (partial: Partial<CatalogChanges>): CatalogChanges => ({ ...NO_CHANGES, ...partial })

afterEach(() => setCatalogChanges(NO_CHANGES))

describe('gerenciador de sabores: os sabores dos produtos (pedido de 2026-11-17)', () => {
  it('Batido: renomear mantém o id, sabor novo ganha id, esgotado fica marcado e o que saiu da lista sai', () => {
    const data = applyChanges(
      BASE,
      changes({
        products: {
          'acai-batido': {
            flavors: [
              { id: 'leite-condensado', name: 'Batido com Leite Condensado' },
              { id: 'leite-condensado-amendoim', name: 'Açaí com Leite Condensado e Amendoim', available: false },
              { name: 'Açaí com Nutella' },
            ],
          },
        },
      }),
    )
    expect(data.products['acai-batido'].flavors).toEqual([
      { id: 'leite-condensado', name: 'Batido com Leite Condensado' },
      { id: 'leite-condensado-amendoim', name: 'Açaí com Leite Condensado e Amendoim', available: false },
      { id: 'novo-acai-com-nutella', name: 'Açaí com Nutella' },
    ])
  })

  it('Barca: as coberturas seguem as caldas (esgotar, renomear, calda nova e calda excluída)', () => {
    const data = applyChanges(
      BASE,
      changes({
        toppings: {
          'calda-chocolate': { available: false, name: 'Chocolate belga' },
          'calda-morango': { deleted: true },
          'novo-calda-de-uva-ab12': { created: true, group: 'syrup', name: 'Uva', priceCents: 0 },
        },
      }),
    )
    const flavors = data.products['barca-de-acai'].flavors
    expect(flavors.find((flavor) => flavor.id === 'calda-chocolate')).toEqual({ id: 'calda-chocolate', name: 'Chocolate belga', available: false })
    expect(flavors.some((flavor) => flavor.id === 'calda-morango')).toBe(false)
    expect(flavors.at(-1)).toEqual({ id: 'novo-calda-de-uva-ab12', name: 'Uva' })
  })

  it('leitura guardada: só sabores com nome, sem repetir, até 40', () => {
    const parsed = parseChanges({
      products: { 'acai-batido': { flavors: [{ id: 'leite-condensado', name: ' Batido ' }, { name: '' }, { name: 'batido' }, { name: 'Nutella', available: false }, 7] } },
    })
    expect(parsed.products['acai-batido'].flavors).toEqual([{ id: 'leite-condensado', name: 'Batido' }, { name: 'Nutella', available: false }])
  })
})

describe('gerenciador de sabores: as escolhas dos itens (pedido de 2026-11-17)', () => {
  it('Kit Completo: as duas escolhas pela mudança, com opção esgotada; "outro sabor" do código continua', () => {
    const data = applyChanges(
      BASE,
      changes({
        items: {
          'kit-completo-casquinha': {
            groups: [
              { id: 'sorvete', label: 'Sabor do sorvete (2 litros)', options: [{ name: 'Ninho' }, { name: 'Morango', available: false }] },
              { id: 'cobertura', label: 'Sabor da cobertura', options: [{ name: 'Caramelo' }] },
            ],
          },
        },
      }),
    )
    const kit = data.items.find((item) => item.id === 'kit-completo-casquinha')!
    expect(choiceGroupsOf(kit).map((group) => [group.id, group.label, group.options, group.unavailable ?? [], Boolean(group.allowOther)])).toEqual([
      ['sorvete', 'Sabor do sorvete (2 litros)', ['Ninho', 'Morango'], ['Morango'], true],
      ['cobertura', 'Sabor da cobertura', ['Caramelo'], [], false],
    ])
  })

  it('escolha nova num item sem sabor e escolhas apagadas; o tamanho continua primeiro', () => {
    const data = applyChanges(
      BASE,
      changes({
        items: {
          jujuba: { groups: [{ label: 'Cor', options: [{ name: 'Verde' }, { name: 'Vermelha' }] }] },
          'kit-completo': { groups: [] },
          'acai-do-oca-pronto': { groups: [{ label: 'Sabor', options: [{ name: 'Tradicional' }] }] },
        },
      }),
    )
    const byId = (id: string) => choiceGroupsOf(data.items.find((item) => item.id === id)!)
    expect(byId('jujuba').map((group) => [group.id, group.label, group.options])).toEqual([['escolha-1', 'Cor', ['Verde', 'Vermelha']]])
    expect(byId('kit-completo')).toEqual([])
    expect(byId('acai-do-oca-pronto').map((group) => [group.id, Boolean(group.prices)])).toEqual([['tamanho', true], ['escolha-1', false]])
  })

  it('leitura guardada: até 3 escolhas, cada uma com nome e pelo menos uma opção', () => {
    const parsed = parseChanges({
      items: {
        jujuba: {
          groups: [
            { label: ' Cor ', options: [{ name: 'Verde' }, { name: 'verde' }] },
            { label: '', options: [{ name: 'X' }] },
            { label: 'Vazia', options: [] },
            { id: 'a', label: 'A', options: [{ name: '1' }] },
            { id: 'b', label: 'B', options: [{ name: '2' }] },
            { id: 'c', label: 'C', options: [{ name: '3' }] },
          ],
        },
      },
    })
    expect(parsed.items.jujuba.groups).toEqual([
      { label: 'Cor', options: [{ name: 'Verde' }] },
      { id: 'a', label: 'A', options: [{ name: '1' }] },
      { id: 'b', label: 'B', options: [{ name: '2' }] },
    ])
  })
})

describe('sabor e opção esgotados na escolha e no carrinho (pedido de 2026-11-17)', () => {
  const batido = () => PRODUCTS['acai-batido']
  const sized = () => chooseSize(batido(), EMPTY_SELECTION, '300-ml').selection
  const esgotarAmendoim = () =>
    setCatalogChanges(
      changes({
        products: {
          'acai-batido': {
            flavors: batido().flavors.map((flavor) => (flavor.id === 'leite-condensado-amendoim' ? { ...flavor, available: false } : flavor)),
          },
        },
      }),
    )

  it('sabor esgotado não é escolhido no personalizador e conta como falta', () => {
    const chosen = chooseFlavor(batido(), sized(), 'leite-condensado-amendoim')
    esgotarAmendoim()
    expect(chooseFlavor(batido(), sized(), 'leite-condensado-amendoim').flavorId).toBeNull()
    expect(missingChoices(batido(), chosen)).toEqual(['flavor'])
    expect(missingChoices(batido(), chosen, { ignoreStock: true })).toEqual([])
  })

  it('carrinho guardado com o sabor que esgotou: continua e fica marcado', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-batido', chooseFlavor(batido(), sized(), 'leite-condensado-amendoim'))
    esgotarAmendoim()
    const [again] = parseCart(serializeCart(cart)).items
    expect(again.kind === 'product' && again.selection.flavorId).toBe('leite-condensado-amendoim')
    expect(cartItemProblem(again)).toEqual({ kind: 'toppings', names: ['Açaí com Leite Condensado e Amendoim'] })
  })

  it('opção esgotada de um item: não entra no carrinho; a que já estava continua, marcada', () => {
    const { cart } = addExtraItem(EMPTY_CART, 'picole-gourmet', { sabor: 'Nutella' })
    const options = choiceGroupsOf(BASE_EXTRA_ITEMS.find((item) => item.id === 'picole-gourmet')!)[0].options
    setCatalogChanges(changes({ items: { 'picole-gourmet': { groups: [{ id: 'sabor', label: 'Sabor', options: options.map((name) => ({ name, ...(name === 'Nutella' ? { available: false } : {}) })) }] } } }))
    expect(addExtraItem(EMPTY_CART, 'picole-gourmet', { sabor: 'Nutella' }).item).toBeNull()
    const [again] = parseCart(serializeCart(cart)).items
    expect(again).toBeDefined()
    expect(cartItemProblem(again)).toEqual({ kind: 'toppings', names: ['Nutella'] })
  })

  it('sabor que saiu da lista: o item no carrinho fica marcado como indisponível', () => {
    const { cart } = addItem(EMPTY_CART, 'acai-batido', chooseFlavor(batido(), sized(), 'leite-condensado-pacoca'))
    setCatalogChanges(changes({ products: { 'acai-batido': { flavors: batido().flavors.filter((flavor) => flavor.id !== 'leite-condensado-pacoca') } } }))
    expect(cartItemProblem(cart.items[0])).toEqual({ kind: 'item' })
  })
})
