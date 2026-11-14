/**
 * Carrinho: funções puras. Recebem o carrinho e devolvem um carrinho novo, sem alterar o que
 * receberam. Cada item guarda uma cópia própria da montagem, então mexer no personalizador
 * (ou em outro item) nunca muda um item que já está no carrinho.
 *
 * O preço não é guardado: é calculado pelas mesmas regras do personalizador
 * (`catalog/selection.ts`), a partir do cardápio atual. Assim o carrinho, o personalizador e
 * a finalização mostram sempre o mesmo valor. Na Fase 6 o servidor repete a conta.
 */
import type { CategorySlug } from '../catalog/categories.ts'
import { findCategoryBySlug } from '../catalog/categories.ts'
import { type Product, PRODUCTS, TOPPING_GROUPS, type ToppingGroupId } from '../catalog/menu.ts'
import {
  EMPTY_SELECTION,
  type PriceLine,
  type Selection,
  addTopping,
  chooseFlavor,
  chooseSize,
  missingChoices,
  freeByGroup,
  priceOf,
  selectedSize,
} from '../catalog/selection.ts'

/** Limite técnico de unidades de um mesmo item. Não é regra do cardápio. */
export const MAX_ITEM_QUANTITY = 20

export type CartItem = {
  /** Identificador do item, para editar e remover. */
  id: string
  slug: CategorySlug
  selection: Selection
  /** Quantas unidades deste item montado. */
  quantity: number
}

export type Cart = { readonly items: readonly CartItem[] }

export const EMPTY_CART: Cart = Object.freeze({ items: Object.freeze([]) })

/** Identificador aleatório. Não usa `crypto.randomUUID`, que falta fora de HTTPS (ex.: rede local). */
export function newItemId(): string {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function freezeSelection(selection: Selection): Selection {
  return Object.freeze({
    sizeId: selection.sizeId,
    flavorId: selection.flavorId,
    toppings: Object.freeze({ ...selection.toppings }),
  })
}

/**
 * Refaz a montagem passo a passo pelas regras do cardápio: tamanho, sabor e cada unidade de
 * ingrediente, na ordem em que foram escolhidos. O que as regras recusam fica de fora.
 * Devolve `null` se o produto não existe ou se falta tamanho ou sabor.
 */
export function normalizeSelection(slug: string, selection: Selection): Selection | null {
  if (!findCategoryBySlug(slug)) return null
  const product = PRODUCTS[slug as CategorySlug]

  let rebuilt = selection.sizeId ? chooseSize(product, EMPTY_SELECTION, selection.sizeId).selection : EMPTY_SELECTION
  if (selection.flavorId) rebuilt = chooseFlavor(product, rebuilt, selection.flavorId)
  for (const [toppingId, quantity] of Object.entries(selection.toppings)) {
    const units = Number.isInteger(quantity) ? Math.min(quantity, 100) : 0
    for (let unit = 0; unit < units; unit++) rebuilt = addTopping(product, rebuilt, toppingId)
  }

  if (missingChoices(product, rebuilt).length > 0) return null
  return freezeSelection(rebuilt)
}

const clampQuantity = (quantity: number) =>
  Number.isInteger(quantity) ? Math.min(MAX_ITEM_QUANTITY, Math.max(1, quantity)) : 1

/** Põe um produto montado no carrinho. Montagem incompleta ou inválida não entra. */
export function addItem(
  cart: Cart,
  slug: CategorySlug,
  selection: Selection,
  id: string = newItemId(),
): { cart: Cart; item: CartItem | null } {
  const normalized = normalizeSelection(slug, selection)
  if (!normalized) return { cart, item: null }
  const item: CartItem = Object.freeze({ id, slug, selection: normalized, quantity: 1 })
  return { cart: { items: [...cart.items, item] }, item }
}

/** Troca a montagem de um item (edição pelo personalizador). A quantidade continua a mesma. */
export function updateItem(cart: Cart, id: string, selection: Selection): Cart {
  const index = cart.items.findIndex((item) => item.id === id)
  if (index === -1) return cart
  const current = cart.items[index]
  const normalized = normalizeSelection(current.slug, selection)
  if (!normalized) return cart
  const items = [...cart.items]
  items[index] = Object.freeze({ ...current, selection: normalized })
  return { items }
}

export function removeItem(cart: Cart, id: string): Cart {
  const items = cart.items.filter((item) => item.id !== id)
  return items.length === cart.items.length ? cart : { items }
}

/** Muda a quantidade de um item, entre 1 e o limite técnico. */
export function setQuantity(cart: Cart, id: string, quantity: number): Cart {
  const index = cart.items.findIndex((item) => item.id === id)
  if (index === -1) return cart
  const next = clampQuantity(quantity)
  if (cart.items[index].quantity === next) return cart
  const items = [...cart.items]
  items[index] = Object.freeze({ ...cart.items[index], quantity: next })
  return { items }
}

export function findItem(cart: Cart, id: string | null | undefined): CartItem | undefined {
  return id ? cart.items.find((item) => item.id === id) : undefined
}

const productOf = (item: CartItem): Product => PRODUCTS[item.slug]

/** Preço de uma unidade do item, pelas regras do personalizador. */
export function unitPriceCents(item: CartItem): number {
  return priceOf(productOf(item), item.selection)?.totalCents ?? 0
}

export function lineTotalCents(item: CartItem): number {
  return unitPriceCents(item) * item.quantity
}

export function cartTotalCents(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + lineTotalCents(item), 0)
}

/** Quantidade de unidades no carrinho (para o selo do cabeçalho). */
export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}

export type ItemDescription = {
  productName: string
  sizeName: string
  container: string
  flavorName: string | null
  /** Ingredientes sem custo, por grupo, com "2x" quando repetidos. */
  included: { group: string; items: string[] }[]
  /** Adicionais cobrados, com quantidade e valor. */
  paid: PriceLine[]
}

const CONTAINER_NAMES = { pote: 'Pote', copo: 'Copo', isopor: 'Isopor' } as const

/** Tudo o que o cliente escolheu, em texto, para o carrinho e para a mensagem do pedido. */
export function describeItem(item: CartItem): ItemDescription {
  const product = productOf(item)
  const size = selectedSize(product, item.selection)
  const flavor = product.flavors.find((candidate) => candidate.id === item.selection.flavorId)
  const freeGroups = product.groups.filter((group: ToppingGroupId) => TOPPING_GROUPS[group].rule !== 'paid')

  return {
    productName: product.name,
    sizeName: size?.name ?? '',
    container: size ? CONTAINER_NAMES[size.container] : '',
    flavorName: flavor?.name ?? null,
    included: freeGroups
      .map((group) => ({
        group: TOPPING_GROUPS[group].name,
        items: freeByGroup(product, item.selection, group).map(({ topping, quantity }) =>
          quantity > 1 ? `${quantity}x ${topping.name}` : topping.name,
        ),
      }))
      .filter((entry) => entry.items.length > 0),
    paid: priceOf(product, item.selection)?.paidLines ?? [],
  }
}

/* Armazenamento: formato versionado, com a ordem dos ingredientes preservada. */

const STORAGE_VERSION = 1

type StoredItem = {
  id: string
  slug: string
  sizeId: string | null
  flavorId: string | null
  toppings: [string, number][]
  quantity: number
}

export function serializeCart(cart: Cart): string {
  const items: StoredItem[] = cart.items.map((item) => ({
    id: item.id,
    slug: item.slug,
    sizeId: item.selection.sizeId,
    flavorId: item.selection.flavorId,
    toppings: Object.entries(item.selection.toppings),
    quantity: item.quantity,
  }))
  return JSON.stringify({ v: STORAGE_VERSION, items })
}

const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Lê o carrinho guardado. Tudo é conferido de novo pelas regras do cardápio: item de produto
 * que não existe mais, tamanho retirado ou dado corrompido simplesmente não volta.
 */
export function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return EMPTY_CART
  }
  if (typeof data !== 'object' || data === null) return EMPTY_CART
  const { v, items } = data as { v?: unknown; items?: unknown }
  if (v !== STORAGE_VERSION || !Array.isArray(items)) return EMPTY_CART

  const seen = new Set<string>()
  const restored: CartItem[] = []
  for (const entry of items as Partial<StoredItem>[]) {
    if (!entry || !isString(entry.id) || !isString(entry.slug) || seen.has(entry.id)) continue
    const toppings: Record<string, number> = {}
    for (const pair of Array.isArray(entry.toppings) ? entry.toppings : []) {
      if (Array.isArray(pair) && isString(pair[0]) && typeof pair[1] === 'number') toppings[pair[0]] = pair[1]
    }
    const selection = normalizeSelection(entry.slug, {
      sizeId: isString(entry.sizeId) ? entry.sizeId : null,
      flavorId: isString(entry.flavorId) ? entry.flavorId : null,
      toppings,
    })
    if (!selection) continue
    seen.add(entry.id)
    restored.push(
      Object.freeze({
        id: entry.id,
        slug: entry.slug as CategorySlug,
        selection,
        quantity: clampQuantity(Number(entry.quantity)),
      }),
    )
  }
  return { items: restored }
}
