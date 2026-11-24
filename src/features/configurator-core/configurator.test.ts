import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import {
  type ConfiguratorAction,
  type ConfiguratorState,
  INITIAL_STATE,
  configuratorReducer,
} from './configurator.ts'

const tradicional = PRODUCTS['acai-tradicional']
const milkShake = PRODUCTS['milk-shake']

function run(product = tradicional, actions: ConfiguratorAction[]): ConfiguratorState {
  return actions.reduce((state, action) => configuratorReducer(product, state, action), INITIAL_STATE)
}

describe('configuratorReducer', () => {
  it('adiciona e anuncia', () => {
    const state = run(tradicional, [
      { type: 'size', sizeId: 'copo-500' },
      { type: 'add', toppingId: 'granola' },
    ])

    expect(state.selection.toppings).toEqual({ granola: 1 })
    expect(state.announcement).toBe('Você adicionou Granola. 1 adicional grátis escolhido.')
  })

  it('não muda nada quando o item não pode entrar', () => {
    const full = run(tradicional, [
      { type: 'size', sizeId: 'pote-200' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'granola' },
    ])

    expect(configuratorReducer(tradicional, full, { type: 'add', toppingId: 'granola' })).toBe(full)
    // Ingrediente que o produto não oferece também não muda nada.
    expect(configuratorReducer(tradicional, INITIAL_STATE, { type: 'add', toppingId: 'calda-leite-condensado' })).toBe(
      INITIAL_STATE,
    )
  })

  it('tira e anuncia', () => {
    const state = run(tradicional, [
      { type: 'size', sizeId: 'copo-500' },
      { type: 'add', toppingId: 'banana' },
      { type: 'remove', toppingId: 'banana' },
    ])

    expect(state.selection.toppings).toEqual({})
    expect(state.announcement).toBe('Você tirou Banana.')
  })

  it('ao diminuir o tamanho, avisa o que saiu', () => {
    const state = run(PRODUCTS['acai-oca'], [
      { type: 'size', sizeId: 'copo-500' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'pacoca' },
      { type: 'add', toppingId: 'amendoim' },
      { type: 'size', sizeId: 'pote-200' },
    ])

    expect(state.selection.toppings).toEqual({ granola: 1, pacoca: 1 })
    expect(state.sizeNotice).toBe('Saíram por passar do novo limite: 1 Amendoim.')
    expect(state.announcement).toBe(
      'Tamanho: Pote 200 ml, R$ 10,00. Saíram por passar do novo limite: 1 Amendoim.',
    )
  })

  it('apaga o aviso de remoção quando o novo tamanho comporta tudo', () => {
    const state = run(tradicional, [
      { type: 'size', sizeId: 'copo-500' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'pacoca' },
      { type: 'add', toppingId: 'amendoim' },
      { type: 'size', sizeId: 'pote-200' },
      { type: 'size', sizeId: 'isopor-gg' },
    ])

    expect(state.sizeNotice).toBe('')
  })

  it('escolhe o sabor do milk-shake e anuncia', () => {
    const state = run(milkShake, [{ type: 'flavor', flavorId: 'morango' }])

    expect(state.selection.flavorId).toBe('morango')
    expect(state.announcement).toBe('Sabor: Morango.')
  })
})

describe('Completo e Limpar no personalizador (pedido de 2026-11-16)', () => {
  const barca = PRODUCTS['barca-de-acai']

  it('"Completo" marca tudo, não fecha nada e anuncia quantos itens', () => {
    const state = run(barca, [{ type: 'size', sizeId: 'barca' }, { type: 'complete' }])
    expect(state.selection.complete).toBe(true)
    expect(Object.keys(state.selection.toppings)).toHaveLength(15)
    expect(state.announcement).toBe('Completo aplicado: 15 itens marcados, pelo preço do tamanho.')
  })

  it('tirar a Farinha láctea depois do Completo mantém o Completo e os outros itens', () => {
    const state = run(barca, [{ type: 'complete' }, { type: 'remove', toppingId: 'farinha-lactea' }])
    expect(state.selection.complete).toBe(true)
    expect(state.selection.toppings['farinha-lactea']).toBeUndefined()
    expect(Object.keys(state.selection.toppings)).toHaveLength(14)
    expect(state.announcement).toBe('Você tirou Farinha láctea. O Completo continua, sem Farinha láctea.')
  })

  it('tirar tudo desliga o Completo; "Limpar" zera e volta ao modo normal', () => {
    const marked = run(barca, [{ type: 'complete' }])
    const emptied = Object.keys(marked.selection.toppings).reduce(
      (state, toppingId) => configuratorReducer(barca, state, { type: 'remove', toppingId }),
      marked,
    )
    expect(emptied.selection.complete).toBe(false)
    const cleared = run(barca, [{ type: 'size', sizeId: 'barca' }, { type: 'complete' }, { type: 'clear' }])
    expect(cleared.selection).toEqual({ sizeId: 'barca', flavorId: null, toppings: {}, complete: false })
    expect(cleared.announcement).toBe('Seleção limpa. Escolha os itens que quiser.')
  })

  it('produto sem Completo (Milk-shake) ignora a ação', () => {
    expect(run(milkShake, [{ type: 'complete' }])).toEqual(INITIAL_STATE)
  })
})
