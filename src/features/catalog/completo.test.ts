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

const barca = PRODUCTS['barca-de-acai']
const oca = PRODUCTS['acai-oca']
const pote = PRODUCTS['pote-de-acai-1-litro']

describe('botão Completo (pedido de 2026-11-16): marca tudo pelo preço do tamanho', () => {
  it('só os 4 açaís montáveis têm o Completo', () => {
    expect(Object.values(PRODUCTS).filter((product) => product.completo).map((product) => product.slug)).toEqual([
      'acai-oca',
      'acai-tradicional',
      'pote-de-acai-1-litro',
      'barca-de-acai',
    ])
  })

  it('Barca: os 13 adicionais e as 3 frutas, 1 de cada; sem caldas, cereja nem Kit Kat; R$ 30,00; a cobertura continua a escolher', () => {
    const selection = applyComplete(barca, sized(barca, 'barca'))
    expect(selection.complete).toBe(true)
    expect(ids(selection)).toHaveLength(16)
    expect(Object.values(selection.toppings).every((quantity) => quantity === 1)).toBe(true)
    expect(ids(selection)).toContain('farinha-lactea')
    expect(ids(selection)).toEqual(expect.arrayContaining(['kiwi', 'morango', 'banana']))
    expect(ids(selection)).not.toContain('cereja')
    expect(ids(selection)).not.toContain('kit-kat')
    expect(priceOf(barca, selection)?.totalCents).toBe(3000)
    expect(missingChoices(barca, selection)).toEqual(['flavor'])
    expect(isCompleteFull(barca, selection)).toBe(true)
  })

  it('Oca pote de 200 ml: 24 itens (adicionais, frutas, caldas e cremes) e o preço continua R$ 10,00, com os cremes sem custo', () => {
    const selection = applyComplete(oca, sized(oca, 'pote-200'))
    expect(ids(selection)).toHaveLength(24)
    expect(ids(selection)).toEqual(expect.arrayContaining(['creme-de-ninho', 'creme-de-avela', 'calda-chocolate']))
    expect(ids(selection)).not.toContain('calda-leite-condensado')
    expect(priceOf(oca, selection)).toEqual({ sizeCents: 1000, paidLines: [], paidCents: 0, totalCents: 1000 })
  })

  it('no Completo, cada item vai 1 vez só; cereja e Kit Kat continuam cobrados', () => {
    const selection = applyComplete(pote, sized(pote, 'pote-1-litro'))
    expect(addBlocker(pote, selection, 'granola')).toBe('item-max')
    expect(addTopping(pote, selection, 'granola')).toBe(selection)
    const withKitKat = addTopping(pote, selection, 'kit-kat')
    expect(priceOf(pote, withKitKat)?.totalCents).toBe(3400)
    expect(priceOf(pote, withKitKat)?.paidLines.map((line) => line.toppingId)).toEqual(['kit-kat'])
  })

  it('tirar a Farinha láctea: só ela sai, o preço não muda e ela aparece em "sem"', () => {
    const complete = applyComplete(oca, sized(oca, 'pote-200'))
    const without = settleComplete(oca, removeTopping(complete, 'farinha-lactea'))
    expect(without.complete).toBe(true)
    expect(ids(without)).toHaveLength(23)
    expect(ids(without)).not.toContain('farinha-lactea')
    expect(names(completeOmitted(oca, without))).toEqual(['Farinha láctea'])
    expect(priceOf(oca, without)?.totalCents).toBe(1000)
    expect(isCompleteFull(oca, without)).toBe(false)
    // "Marcar tudo novamente" devolve a Farinha láctea.
    expect(ids(applyComplete(oca, without))).toHaveLength(24)
  })

  it('trocar de tamanho no Completo não tira nada; o preço passa a ser o do novo tamanho', () => {
    const complete = applyComplete(oca, sized(oca, 'isopor-gg'))
    const { selection, removed } = chooseSize(oca, complete, 'pote-200')
    expect(removed).toEqual([])
    expect(ids(selection)).toHaveLength(24)
    expect(priceOf(oca, selection)?.totalCents).toBe(1000)
  })

  it('Completo antes de escolher o tamanho também marca tudo; o preço aparece com o tamanho', () => {
    const selection = applyComplete(oca, EMPTY_SELECTION)
    expect(ids(selection)).toHaveLength(24)
    expect(priceOf(oca, selection)).toBeNull()
  })

  it('"Limpar" tira os acompanhamentos e volta ao modo normal; tamanho e cobertura ficam', () => {
    const chosen = chooseFlavor(barca, sized(barca, 'barca'), 'calda-chocolate')
    const cleared = clearToppings(addTopping(barca, applyComplete(barca, chosen), 'kit-kat'))
    expect(cleared).toEqual({ sizeId: 'barca', flavorId: 'calda-chocolate', toppings: {}, complete: false })
  })

  it('tirar tudo o que o Completo marcou desliga o modo Completo', () => {
    let selection = applyComplete(barca, sized(barca, 'barca'))
    for (const id of ids(selection)) selection = removeTopping(selection, id)
    expect(settleComplete(barca, selection).complete).toBe(false)
  })

  it('fora do Completo, a cota continua: o pote de 200 ml do Oca tem 2 adicionais grátis', () => {
    let selection = sized(oca, 'pote-200')
    selection = addTopping(oca, addTopping(oca, selection, 'granola'), 'pacoca')
    expect(addBlocker(oca, selection, 'amendoim')).toBe('free-limit')
    // A 3ª fruta da Barca continua bloqueada fora do Completo.
    let fruits = sized(barca, 'barca')
    fruits = addTopping(barca, addTopping(barca, fruits, 'kiwi'), 'morango')
    expect(addBlocker(barca, fruits, 'banana')).toBe('group-limit')
  })

  it('esgotado fica fora do Completo', () => {
    const farinha = getTopping('farinha-lactea')!
    const original = farinha.available
    try {
      ;(farinha as { available?: boolean }).available = false
      expect(names(completeToppings(oca))).not.toContain('Farinha láctea')
      expect(ids(applyComplete(oca, sized(oca, 'pote-200')))).toHaveLength(23)
    } finally {
      ;(farinha as { available?: boolean }).available = original
    }
  })
})
