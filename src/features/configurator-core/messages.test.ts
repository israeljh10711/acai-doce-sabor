import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import { EMPTY_SELECTION, type Selection, addTopping, chooseSize } from '../catalog/selection.ts'
import { addedText, blockerText, flavorText, removedText, sizeText } from './messages.ts'

const tradicional = PRODUCTS['acai-tradicional']
const milkShake = PRODUCTS['milk-shake']

function build(sizeId: string, toppingIds: string[]): Selection {
  let selection = chooseSize(tradicional, EMPTY_SELECTION, sizeId).selection
  for (const id of toppingIds) selection = addTopping(tradicional, selection, id)
  return selection
}

describe('blockerText', () => {
  it('explica por que o item não pode entrar', () => {
    expect(blockerText('no-size', 0)).toBe('Escolha o tamanho primeiro')
    expect(blockerText('free-limit', 3)).toBe('Limite de 3 grátis atingido')
    expect(blockerText('item-max', 3)).toBe('Quantidade máxima atingida')
    expect(blockerText('not-in-product', 3)).toBe('Indisponível neste produto')
  })
})

describe('addedText', () => {
  it('nos adicionais, conta quantos grátis já foram usados', () => {
    expect(addedText(tradicional, build('copo-500', ['granola', 'granola']), 'granola')).toBe(
      'Você adicionou Granola. 2 de 3 adicionais grátis usados.',
    )
  })

  it('nos pagos, diz a quantidade e quanto custam', () => {
    expect(addedText(tradicional, build('copo-500', ['kit-kat', 'kit-kat']), 'kit-kat')).toBe(
      'Você adicionou Kit Kat. 2 unidades, R$ 8,00.',
    )
    expect(addedText(tradicional, build('copo-500', ['cereja']), 'cereja')).toBe(
      'Você adicionou Cereja. 1 unidade, R$ 3,00.',
    )
  })

  it('nas frutas e coberturas, só confirma', () => {
    expect(addedText(tradicional, build('copo-500', ['banana']), 'banana')).toBe('Você incluiu Banana.')
    expect(addedText(tradicional, build('copo-500', ['calda-acai']), 'calda-acai')).toBe(
      'Você incluiu cobertura de Açaí.',
    )
  })
})

describe('removedText', () => {
  it('confirma a retirada e, nos adicionais, atualiza a conta dos grátis', () => {
    expect(removedText(tradicional, build('copo-500', ['granola']), 'granola')).toBe(
      'Você tirou Granola. 1 de 3 adicionais grátis usados.',
    )
    expect(removedText(tradicional, build('copo-500', []), 'banana')).toBe('Você tirou Banana.')
    expect(removedText(tradicional, build('copo-500', []), 'calda-morango')).toBe(
      'Você tirou cobertura de Morango.',
    )
  })
})

describe('sizeText', () => {
  it('confirma o tamanho e o preço', () => {
    expect(sizeText(tradicional, 'copo-500', [])).toBe('Tamanho: Copo 500 ml, R$ 12,00.')
  })

  it('avisa o que saiu por passar do novo limite', () => {
    expect(
      sizeText(tradicional, 'pote-200', [
        { toppingId: 'amendoim', quantity: 2 },
        { toppingId: 'pacoca', quantity: 1 },
      ]),
    ).toBe('Tamanho: Pote 200 ml, R$ 7,00. Saíram por passar do novo limite: 2 Amendoim, 1 Paçoca.')
  })
})

describe('flavorText', () => {
  it('confirma o sabor', () => {
    expect(flavorText(milkShake, 'morango')).toBe('Sabor: Morango.')
  })
})
