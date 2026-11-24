import { describe, expect, it } from 'vitest'
import { PRODUCTS, type Product, type Topping, getTopping } from './menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addBlocker,
  addTopping,
  applyComplete,
  chooseFlavor,
  chooseSize,
  clearToppings,
  completeLabel,
  completeOmitted,
  completeToppings,
  isCompleteFull,
  missingChoices,
  priceOf,
  removeTopping,
  settleComplete,
} from './selection.ts'

const sized = (product: Product, sizeId: string): Selection => chooseSize(product, EMPTY_SELECTION, sizeId).selection
const ids = (selection: Selection) => Object.keys(selection.toppings)
const names = (toppings: readonly Topping[]) => toppings.map((topping) => topping.name)
const groupsOf = (selection: Selection) => [...new Set(ids(selection).map((id) => getTopping(id)?.group))]

const barca = PRODUCTS['barca-de-acai']
const oca = PRODUCTS['acai-oca']
const tradicional = PRODUCTS['acai-tradicional']
const pote = PRODUCTS['pote-de-acai-1-litro']

describe('botão Completo (ajuste de 2026-11-16): só adicionais e frutas sem custo, pelo preço do tamanho', () => {
  it('Tradicional, pote de 1 litro e barca têm o Completo', () => {
    expect(Object.values(PRODUCTS).filter((product) => product.completo).map((product) => product.slug)).toEqual([
      'acai-tradicional',
      'pote-de-acai-1-litro',
      'barca-de-acai',
    ])
  })

  it('Barca: 12 adicionais e 3 frutas (15), 1 de cada; sem leite condensado, caldas, cremes nem pagos; R$ 30,00', () => {
    const selection = applyComplete(barca, sized(barca, 'barca'))
    expect(selection.complete).toBe(true)
    expect(ids(selection)).toHaveLength(15)
    expect(groupsOf(selection)).toEqual(['dry', 'fruit'])
    expect(Object.values(selection.toppings).every((quantity) => quantity === 1)).toBe(true)
    expect(ids(selection)).toContain('farinha-lactea')
    expect(ids(selection)).not.toContain('leite-condensado')
    expect(ids(selection)).not.toContain('kit-kat')
    expect(priceOf(barca, selection)?.totalCents).toBe(3000)
    expect(missingChoices(barca, selection)).toEqual(['flavor'])
    expect(isCompleteFull(barca, selection)).toBe(true)
    expect(completeLabel(barca, selection)).toBe('COMPLETO')
  })

  it('Oca não aceita Completo, mesmo se o carrinho pedir', () => {
    const selection = sized(oca, 'pote-200')
    expect(applyComplete(oca, selection)).toBe(selection)
    expect(completeToppings(oca)).toEqual([])
  })

  it('exemplo do pedido: tamanho de R$ 15,00 + Completo + creme de avelã + creme de ninho = R$ 21,00', () => {
    let selection = applyComplete(tradicional, sized(tradicional, 'isopor-m'))
    expect(priceOf(tradicional, selection)?.totalCents).toBe(1500)
    selection = addTopping(tradicional, addTopping(tradicional, selection, 'creme-de-avela'), 'creme-de-ninho')
    expect(priceOf(tradicional, selection)?.totalCents).toBe(2100)
    expect(priceOf(tradicional, selection)?.paidLines.map((line) => line.toppingId)).toEqual(['creme-de-ninho', 'creme-de-avela'])
    // Calda sem custo soma R$ 0,00; Kit Kat soma R$ 4,00.
    selection = addTopping(tradicional, addTopping(tradicional, selection, 'calda-morango'), 'kit-kat')
    expect(priceOf(tradicional, selection)?.totalCents).toBe(2500)
  })

  it('no Completo, os adicionais vão 1 de cada, sem cota; o leite condensado pode ser marcado à parte, sem custo', () => {
    const selection = applyComplete(pote, sized(pote, 'pote-1-litro'))
    expect(addBlocker(pote, selection, 'granola')).toBe('item-max')
    expect(addTopping(pote, selection, 'granola')).toBe(selection)
    const withMilk = addTopping(pote, selection, 'leite-condensado')
    expect(withMilk.toppings['leite-condensado']).toBe(1)
    expect(priceOf(pote, withMilk)?.totalCents).toBe(3000)
    expect(addBlocker(pote, withMilk, 'leite-condensado')).toBe('item-max')
  })

  it('tirar a Farinha láctea: só ela sai, o preço não muda e ela aparece em "SEM"; os pagos continuam somados', () => {
    const complete = addTopping(tradicional, applyComplete(tradicional, sized(tradicional, 'isopor-m')), 'creme-de-avela')
    const without = settleComplete(tradicional, removeTopping(complete, 'farinha-lactea'))
    expect(without.complete).toBe(true)
    expect(ids(without)).not.toContain('farinha-lactea')
    expect(names(completeOmitted(tradicional, without))).toEqual(['Farinha láctea'])
    expect(completeLabel(tradicional, without)).toBe('COMPLETO (SEM: Farinha láctea)')
    expect(priceOf(tradicional, without)?.totalCents).toBe(1800)
    expect(isCompleteFull(tradicional, without)).toBe(false)
    expect(ids(applyComplete(tradicional, without))).toContain('farinha-lactea')
  })

  it('trocar de tamanho no Completo não tira nada; o preço passa a ser o do novo tamanho', () => {
    const complete = applyComplete(tradicional, sized(tradicional, 'isopor-gg'))
    const { selection, removed } = chooseSize(tradicional, complete, 'pote-200')
    expect(removed).toEqual([])
    expect(ids(selection)).toHaveLength(15)
    expect(priceOf(tradicional, selection)?.totalCents).toBe(700)
  })

  it('"Limpar" tira tudo (também os pagos) e volta ao modo normal; tamanho e cobertura ficam', () => {
    const chosen = chooseFlavor(barca, sized(barca, 'barca'), 'calda-chocolate')
    const cleared = clearToppings(addTopping(barca, applyComplete(barca, chosen), 'kit-kat'))
    expect(cleared).toEqual({ sizeId: 'barca', flavorId: 'calda-chocolate', toppings: {}, complete: false })
  })

  it('tirar tudo o que o Completo marcou desliga o modo Completo', () => {
    let selection = applyComplete(barca, sized(barca, 'barca'))
    for (const id of ids(selection)) selection = removeTopping(selection, id)
    expect(settleComplete(barca, selection).complete).toBe(false)
  })

  it('fora do Completo, a cota continua (2 grátis no pote de 200 ml) e a 3ª fruta da Barca fica bloqueada', () => {
    let selection = sized(oca, 'pote-200')
    selection = addTopping(oca, addTopping(oca, selection, 'granola'), 'pacoca')
    expect(addBlocker(oca, selection, 'amendoim')).toBe('free-limit')
    let fruits = sized(barca, 'barca')
    fruits = addTopping(barca, addTopping(barca, fruits, 'kiwi'), 'morango')
    expect(addBlocker(barca, fruits, 'banana')).toBe('group-limit')
  })

  it('esgotado e adicional com preço ficam fora do Completo', () => {
    const farinha = getTopping('farinha-lactea')!
    const granola = getTopping('granola')!
    const before = [farinha.available, granola.priceCents]
    try {
      ;(farinha as { available?: boolean }).available = false
      ;(granola as { priceCents: number }).priceCents = 200
      expect(names(completeToppings(tradicional))).not.toContain('Farinha láctea')
      expect(names(completeToppings(tradicional))).not.toContain('Granola')
      expect(ids(applyComplete(tradicional, sized(tradicional, 'pote-200')))).toHaveLength(13)
    } finally {
      ;(farinha as { available?: boolean }).available = before[0] as boolean | undefined
      ;(granola as { priceCents: number }).priceCents = before[1] as number
    }
  })
})
