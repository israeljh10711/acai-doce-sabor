/**
 * Carrinho em uso: guardado no aparelho (localStorage) e igual em todas as abas abertas.
 * As regras ficam em `cart.ts`; aqui só se guarda, se lê e se avisa quem está mostrando.
 * Se o navegador não deixar guardar (aba anônima, armazenamento cheio), o carrinho funciona
 * normalmente até a página ser fechada.
 */
import { useSyncExternalStore } from 'react'
import type { ProductSlug } from '../catalog/menu.ts'
import type { Selection } from '../catalog/selection.ts'
import {
  type Cart,
  EMPTY_CART,
  type ExtraCartItem,
  type ProductCartItem,
  addExtraItem,
  addItem,
  parseCart,
  removeItem,
  serializeCart,
  setNote,
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

/**
 * Lido na primeira vez que alguém pede, e não ao carregar o módulo (2026-11-17): assim as
 * mudanças do vendedor (`initCatalog`, em `main.tsx`) já valem. Lido antes, um item criado pelo
 * vendedor sumia do carrinho ao recarregar a página.
 */
let state: Cart | null = null
const current = (): Cart => (state ??= load())
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function commit(next: Cart) {
  if (next === current()) return
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
  add(slug: ProductSlug, selection: Selection): ProductCartItem | null {
    const { cart, item } = addItem(current(), slug, selection)
    commit(cart)
    return item
  },
  /**
   * Põe um item das gavetas no carrinho (o mesmo item com o mesmo sabor soma na quantidade).
   * Devolve o item, ou `null` se a escolha é inválida.
   */
  addExtra(itemId: string, choices: Readonly<Record<string, string>>): ExtraCartItem | null {
    const { cart, item } = addExtraItem(current(), itemId, choices)
    commit(cart)
    return item
  },
  update(id: string, selection: Selection) {
    commit(updateItem(current(), id, selection))
  },
  remove(id: string) {
    commit(removeItem(current(), id))
  },
  setQuantity(id: string, quantity: number) {
    commit(setQuantity(current(), id, quantity))
  },
  /** Observação do item ("pouco gelo"); vazia apaga (pedido de 2026-11-17). */
  setNote(id: string, note: string) {
    commit(setNote(current(), id, note))
  },
  /** Esvazia o carrinho (o cliente avisa que já enviou o pedido pelo WhatsApp). */
  clear() {
    commit(EMPTY_CART)
  },
}

/** O carrinho agora (fora de um componente). */
export function getCart(): Cart {
  return current()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => current()

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
