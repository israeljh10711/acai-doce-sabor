/**
 * Referências de preço citadas no briefing de 2026-11-12, conferidas contra o cardápio
 * validado pelo proprietário (D-020).
 *
 * O briefing lista "Copo 500 ml, R$ 23,00, 3 grátis". Esse valor veio da captura de tela do
 * site antigo, que mostrava o total de um Copo 500 ml do Oca (R$ 20,00) com um adicional pago
 * de R$ 3,00. O preço do copo continua R$ 20,00; o total de R$ 23,00 é reproduzido abaixo.
 */
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from './menu.ts'
import { EMPTY_SELECTION, addTopping, chooseSize, freeLimit, priceOf } from './selection.ts'

const oca = PRODUCTS['acai-oca']

const priced = (sizeId: string, paid: string[] = []) => {
  let selection = chooseSize(oca, EMPTY_SELECTION, sizeId).selection
  for (const id of paid) selection = addTopping(oca, selection, id)
  return { total: priceOf(oca, selection)?.totalCents, free: freeLimit(oca, selection) }
}

describe('referências de preço do briefing (Açaí Oca)', () => {
  it('Pote 200 ml: R$ 10,00 com 2 adicionais grátis', () => {
    expect(priced('pote-200')).toEqual({ total: 1000, free: 2 })
  })

  it('Pote 530 ml: R$ 20,00 com 4 adicionais grátis', () => {
    expect(priced('pote-530')).toEqual({ total: 2000, free: 4 })
  })

  it('Copo 500 ml: R$ 20,00 com 3 grátis; com um creme de R$ 3,00, o total da tela antiga (R$ 23,00)', () => {
    expect(priced('copo-500')).toEqual({ total: 2000, free: 3 })
    expect(priced('copo-500', ['creme-de-avela'])).toEqual({ total: 2300, free: 3 })
  })
})
