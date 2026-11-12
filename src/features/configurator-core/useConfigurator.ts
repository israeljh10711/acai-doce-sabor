import { useReducer } from 'react'
import type { Product } from '../catalog/menu.ts'
import {
  addBlocker,
  freeLimit,
  freeUsed,
  missingChoices,
  priceOf,
  selectedSize,
} from '../catalog/selection.ts'
import { type ConfiguratorAction, type ConfiguratorState, INITIAL_STATE, configuratorReducer } from './configurator.ts'

/** Estado e ações do personalizador de um produto. A montagem não é guardada ao sair. */
export function useConfigurator(product: Product) {
  const [state, dispatch] = useReducer(
    (current: ConfiguratorState, action: ConfiguratorAction) =>
      configuratorReducer(product, current, action),
    INITIAL_STATE,
  )
  const { selection } = state

  return {
    ...state,
    size: selectedSize(product, selection),
    price: priceOf(product, selection),
    freeLimit: freeLimit(product, selection),
    freeUsed: freeUsed(selection),
    missing: missingChoices(product, selection),
    blockerFor: (toppingId: string) => addBlocker(product, selection, toppingId),
    chooseSize: (sizeId: string) => dispatch({ type: 'size', sizeId }),
    chooseFlavor: (flavorId: string) => dispatch({ type: 'flavor', flavorId }),
    add: (toppingId: string) => dispatch({ type: 'add', toppingId }),
    remove: (toppingId: string) => dispatch({ type: 'remove', toppingId }),
  }
}

export type ConfiguratorApi = ReturnType<typeof useConfigurator>
