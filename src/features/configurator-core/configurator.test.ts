import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../catalog/menu.ts'
import {
  type ConfiguratorAction,
  type ConfiguratorState,
  INITIAL_STATE,
  configuratorReducer,
} from './configurator.ts'
import { previewTitle } from './messages.ts'

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
    expect(state.announcement).toBe('Você adicionou Granola. 1 de 3 grátis usados.')
  })

  it('não muda nada quando o item não pode entrar', () => {
    const full = run(tradicional, [
      { type: 'size', sizeId: 'pote-200' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'granola' },
    ])

    expect(configuratorReducer(tradicional, full, { type: 'add', toppingId: 'pacoca' })).toBe(full)
    expect(configuratorReducer(tradicional, INITIAL_STATE, { type: 'add', toppingId: 'granola' })).toBe(
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
    const state = run(tradicional, [
      { type: 'size', sizeId: 'copo-500' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'pacoca' },
      { type: 'add', toppingId: 'amendoim' },
      { type: 'size', sizeId: 'pote-200' },
    ])

    expect(state.selection.toppings).toEqual({ granola: 1, pacoca: 1 })
    expect(state.sizeNotice).toBe('Saíram por passar do novo limite: 1 Amendoim.')
    expect(state.announcement).toBe(
      'Tamanho: Pote 200 ml, R$ 7,00. Saíram por passar do novo limite: 1 Amendoim.',
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

describe('previewTitle', () => {
  it('descreve o recipiente vazio antes do tamanho', () => {
    expect(previewTitle(tradicional, INITIAL_STATE.selection)).toBe(
      'Prévia ilustrativa: recipiente vazio. Escolha o tamanho para começar.',
    )
  })

  it('descreve a montagem com as quantidades', () => {
    const state = run(tradicional, [
      { type: 'size', sizeId: 'copo-500' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'granola' },
      { type: 'add', toppingId: 'banana' },
      { type: 'add', toppingId: 'calda-morango' },
    ])

    expect(previewTitle(tradicional, state.selection)).toBe(
      'Prévia ilustrativa: Açaí Tradicional, Copo 500 ml, com 2 Granola, Banana e cobertura de Morango.',
    )
  })

  it('cita o sabor do milk-shake', () => {
    const state = run(milkShake, [
      { type: 'size', sizeId: '400-ml' },
      { type: 'flavor', flavorId: 'ninho' },
    ])

    expect(previewTitle(milkShake, state.selection)).toBe(
      'Prévia ilustrativa: Milk-shake, 400 ml, sabor Ninho, sem complementos.',
    )
  })
})
