import { describe, expect, it } from 'vitest'
import { MAX_PAID_UNITS, PRODUCTS, TOPPING_GROUPS, toppingsOf } from './menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addBlocker,
  addTopping,
  chooseFlavor,
  chooseSize,
  missingChoices,
  priceOf,
  removeTopping,
} from './selection.ts'

const batido = PRODUCTS['acai-batido']

/** Batido com tamanho, sabor e adicionais, na ordem dada. */
function build(sizeId: string, flavorId: string | null, addOns: string[] = []): Selection {
  let selection = chooseSize(batido, EMPTY_SELECTION, sizeId).selection
  if (flavorId) selection = chooseFlavor(batido, selection, flavorId)
  for (const id of addOns) selection = addTopping(batido, selection, id)
  return selection
}

describe('Açaí Batido: sabores e tamanhos', () => {
  it('tem exatamente os três sabores do briefing', () => {
    expect(batido.flavors.map((flavor) => flavor.name)).toEqual([
      'Açaí Batido com Leite Condensado',
      'Açaí com Leite Condensado e Amendoim',
      'Açaí com Leite Condensado e Paçoca',
    ])
  })

  it('tem 300 ml a R$ 10,00 e 500 ml a R$ 12,00, sem adicionais grátis', () => {
    expect(batido.sizes.map((size) => [size.name, size.priceCents, size.freeToppings])).toEqual([
      ['300 ml', 1000, 0],
      ['500 ml', 1200, 0],
    ])
  })

  it('custa o preço do tamanho quando não há adicionais, nos dois tamanhos', () => {
    for (const flavor of batido.flavors) {
      expect(priceOf(batido, build('300-ml', flavor.id))?.totalCents).toBe(1000)
      expect(priceOf(batido, build('500-ml', flavor.id))?.totalCents).toBe(1200)
    }
  })

  it('só fica completo com tamanho e sabor', () => {
    expect(missingChoices(batido, EMPTY_SELECTION)).toEqual(['size', 'flavor'])
    expect(missingChoices(batido, build('300-ml', null))).toEqual(['flavor'])
    expect(missingChoices(batido, build('300-ml', 'leite-condensado-pacoca'))).toEqual([])
  })
})

describe('Açaí Batido: adicionais exclusivos', () => {
  it('são os cinco do briefing, a R$ 3,00 cada, cobrados por unidade', () => {
    expect(TOPPING_GROUPS.batido.rule).toBe('paid')
    expect(batido.groups).toEqual(['batido'])
    expect(toppingsOf(batido, 'batido').map((topping) => [topping.name, topping.priceCents])).toEqual([
      ['Creme de avelã', 300],
      ['Creme de morango', 300],
      ['Creme de cookies', 300],
      ['Creme de ninho', 300],
      ['Ovomaltine', 300],
    ])
  })

  it('somam R$ 3,00 por unidade ao preço do tamanho, que não muda', () => {
    const selection = build('300-ml', 'leite-condensado', [
      'batido-creme-de-avela',
      'batido-creme-de-avela',
      'batido-ovomaltine',
    ])
    const price = priceOf(batido, selection)

    expect(price?.sizeCents).toBe(1000)
    expect(price?.paidLines.map((line) => [line.name, line.quantity, line.totalCents])).toEqual([
      ['Creme de avelã', 2, 600],
      ['Ovomaltine', 1, 300],
    ])
    expect(price?.totalCents).toBe(1000 + 3 * 300)
  })

  it('500 ml com um de cada adicional dá R$ 27,00', () => {
    const all = toppingsOf(batido, 'batido').map((topping) => topping.id)
    expect(priceOf(batido, build('500-ml', 'leite-condensado-amendoim', all))?.totalCents).toBe(2700)
  })

  it('aceita no máximo 10 unidades de cada adicional', () => {
    const ten = build('500-ml', 'leite-condensado', Array(MAX_PAID_UNITS).fill('batido-creme-de-cookies'))

    expect(MAX_PAID_UNITS).toBe(10)
    expect(addBlocker(batido, ten, 'batido-creme-de-cookies')).toBe('item-max')
    expect(addTopping(batido, ten, 'batido-creme-de-cookies')).toBe(ten)
    expect(priceOf(batido, ten)?.totalCents).toBe(1200 + 10 * 300)
    // O limite é por adicional: os outros continuam livres.
    expect(addBlocker(batido, ten, 'batido-creme-de-ninho')).toBeNull()
  })

  it('não deixa quantidade negativa', () => {
    const selection = build('300-ml', 'leite-condensado')
    expect(removeTopping(selection, 'batido-ovomaltine')).toBe(selection)
  })

  it('pede o tamanho antes dos adicionais', () => {
    expect(addBlocker(batido, EMPTY_SELECTION, 'batido-creme-de-ninho')).toBe('no-size')
  })

  it('não mistura ingredientes do açaí com os do batido', () => {
    const selection = build('300-ml', 'leite-condensado')
    expect(addBlocker(batido, selection, 'granola')).toBe('not-in-product')
    expect(addBlocker(batido, selection, 'creme-de-avela')).toBe('not-in-product')

    const oca = PRODUCTS['acai-oca']
    const ocaSelection = chooseSize(oca, EMPTY_SELECTION, 'copo-500').selection
    expect(addBlocker(oca, ocaSelection, 'batido-ovomaltine')).toBe('not-in-product')
  })
})
