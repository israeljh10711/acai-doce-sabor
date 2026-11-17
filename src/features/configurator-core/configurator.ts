/**
 * Estado do personalizador: a escolha do cliente e os textos que acompanham cada mudança.
 * As regras ficam em `catalog/selection.ts`; aqui só se decide o que anunciar.
 */
import type { Product } from '../catalog/menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addTopping,
  applyComplete,
  chooseFlavor,
  chooseSize,
  clearToppings,
  removeTopping,
  settleComplete,
} from '../catalog/selection.ts'
import { addedText, clearedText, completeText, flavorText, removedBySizeText, removedText, sizeText } from './messages.ts'

export type ConfiguratorState = {
  selection: Selection
  /** Último anúncio para leitores de tela. */
  announcement: string
  /** Aviso visível dos adicionais que saíram na última troca de tamanho. */
  sizeNotice: string
}

export type ConfiguratorAction =
  | { type: 'size'; sizeId: string }
  | { type: 'flavor'; flavorId: string }
  | { type: 'add'; toppingId: string }
  | { type: 'remove'; toppingId: string }
  /** "Completo" ou "Marcar tudo novamente" (pedido de 2026-11-16). */
  | { type: 'complete' }
  /** "Limpar": tira os acompanhamentos e volta ao modo normal. */
  | { type: 'clear' }

export const INITIAL_STATE: ConfiguratorState = {
  selection: EMPTY_SELECTION,
  announcement: '',
  sizeNotice: '',
}

/** Devolve o mesmo estado quando a ação não muda nada. */
export function configuratorReducer(
  product: Product,
  state: ConfiguratorState,
  action: ConfiguratorAction,
): ConfiguratorState {
  switch (action.type) {
    case 'size': {
      const { selection, removed } = chooseSize(product, state.selection, action.sizeId)
      if (selection === state.selection) return state
      return {
        selection,
        announcement: sizeText(product, action.sizeId, removed),
        sizeNotice: removedBySizeText(removed),
      }
    }
    case 'flavor': {
      const selection = chooseFlavor(product, state.selection, action.flavorId)
      if (selection === state.selection) return state
      return { ...state, selection, announcement: flavorText(product, action.flavorId) }
    }
    case 'add': {
      const selection = addTopping(product, state.selection, action.toppingId)
      if (selection === state.selection) return state
      return { ...state, selection, announcement: addedText(product, selection, action.toppingId) }
    }
    case 'remove': {
      const removed = removeTopping(state.selection, action.toppingId)
      if (removed === state.selection) return state
      const selection = settleComplete(product, removed)
      return { ...state, selection, announcement: removedText(product, selection, action.toppingId) }
    }
    case 'complete': {
      if (!product.completo) return state
      const selection = applyComplete(product, state.selection)
      return { ...state, selection, sizeNotice: '', announcement: completeText(product, selection) }
    }
    case 'clear': {
      if (Object.keys(state.selection.toppings).length === 0 && !state.selection.complete) return state
      return { ...state, selection: clearToppings(state.selection), sizeNotice: '', announcement: clearedText() }
    }
  }
}
