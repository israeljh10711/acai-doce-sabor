import { useReducer } from 'react'
import type { Product } from '../catalog/menu.ts'
import {
  type Selection,
  addBlocker,
  freeCap,
  freeLimit,
  freeLimitRange,
  freeUsed,
  missingChoices,
  priceOf,
  selectedSize,
} from '../catalog/selection.ts'
import { type ConfiguratorAction, type ConfiguratorState, INITIAL_STATE, configuratorReducer } from './configurator.ts'

/**
 * Estado e ações do personalizador de um produto. Começa vazio ou, ao editar um item do
 * carrinho, com a montagem dele.
 */
export function useConfigurator(product: Product, initialSelection?: Selection) {
  const [state, dispatch] = useReducer(
    (current: ConfiguratorState, action: ConfiguratorAction) =>
      configuratorReducer(product, current, action),
    initialSelection,
    (selection): ConfiguratorState => (selection ? { ...INITIAL_STATE, selection } : INITIAL_STATE),
  )
  const { selection } = state

  return {
    ...state,
    size: selectedSize(product, selection),
    price: priceOf(product, selection),
    freeLimit: freeLimit(product, selection),
    /** Até onde os grátis podem ir agora: o limite do tamanho ou, sem tamanho, o maior. */
    freeCap: freeCap(product, selection),
    freeRange: freeLimitRange(product),
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
