/**
 * Estado do personalizador: a escolha do cliente e os textos que acompanham cada mudança.
 * As regras ficam em `catalog/selection.ts`; aqui só se decide o que anunciar.
 */
import type { Product } from '../catalog/menu.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addTopping,
  chooseFlavor,
  chooseSize,
  removeTopping,
} from '../catalog/selection.ts'
import { addedText, flavorText, removedBySizeText, removedText, sizeText } from './messages.ts'

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
      const selection = removeTopping(state.selection, action.toppingId)
      if (selection === state.selection) return state
      return { ...state, selection, announcement: removedText(product, selection, action.toppingId) }
    }
  }
}
