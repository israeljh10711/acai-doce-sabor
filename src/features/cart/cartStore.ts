/**
 * Carrinho em uso: guardado no aparelho (localStorage) e igual em todas as abas abertas.
 * As regras ficam em `cart.ts`; aqui só se guarda, se lê e se avisa quem está mostrando.
 * Se o navegador não deixar guardar (aba anônima, armazenamento cheio), o carrinho funciona
 * normalmente até a página ser fechada.
 */
import { useSyncExternalStore } from 'react'
import type { CategorySlug } from '../catalog/categories.ts'
import type { Selection } from '../catalog/selection.ts'
import {
  type Cart,
  type CartItem,
  EMPTY_CART,
  addItem,
  parseCart,
  removeItem,
  serializeCart,
  setQuantity,
  updateItem,
} from './cart.ts'

const STORAGE_KEY = 'acai-doce-sabor:carrinho'

function load(): Cart {
  try {
    return parseCart(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null)
  } catch {
    return EMPTY_CART
  }
}

let state: Cart = load()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function commit(next: Cart) {
  if (next === state) return
  state = next
  try {
    if (next.items.length === 0) globalThis.localStorage?.removeItem(STORAGE_KEY)
    else globalThis.localStorage?.setItem(STORAGE_KEY, serializeCart(next))
  } catch {
    // Sem armazenamento: o carrinho continua na memória.
  }
  emit()
}

// Outra aba mudou o carrinho: acompanha.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    state = parseCart(event.newValue)
    emit()
  })
}

export const cartActions = {
  /** Põe a montagem no carrinho. Devolve o item criado, ou `null` se a montagem está incompleta. */
  add(slug: CategorySlug, selection: Selection): CartItem | null {
    const { cart, item } = addItem(state, slug, selection)
    commit(cart)
    return item
  },
  update(id: string, selection: Selection) {
    commit(updateItem(state, id, selection))
  },
  remove(id: string) {
    commit(removeItem(state, id))
  },
  setQuantity(id: string, quantity: number) {
    commit(setQuantity(state, id, quantity))
  },
  /** Esvazia o carrinho (o cliente avisa que já enviou o pedido pelo WhatsApp). */
  clear() {
    commit(EMPTY_CART)
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
