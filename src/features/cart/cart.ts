/**
 * Carrinho: funções puras. Recebem o carrinho e devolvem um carrinho novo, sem alterar o que
 * receberam. Cada item guarda uma cópia própria da montagem, então mexer no personalizador
 * (ou em outro item) nunca muda um item que já está no carrinho.
 *
 * Dois tipos de item:
 * - `product`: montado no personalizador (açaís, batido, milk-shake, Pote 1 L Montado, Barca);
 * - `extra`: item das gavetas de "Mais opções do cardápio" (picolés, bebidas, doces...), com o
 *   sabor escolhido quando tem (pedido de 2026-11-15).
 *
 * O preço não é guardado: é calculado pelas mesmas regras do personalizador
 * (`catalog/selection.ts`) e pela tabela das gavetas (`catalog/extras.ts`). Assim o carrinho,
 * o personalizador e a finalização mostram sempre o mesmo valor. Na Fase 6 o servidor repete a
 * conta.
 */
import { choiceRows, extraPriceCents, getExtraItem, isOrderableExtra, normalizeChoices } from '../catalog/extras.ts'
import {
  type Product,
  type ProductSlug,
  PRODUCTS,
  TOPPING_GROUPS,
  type ToppingGroupId,
  flavorTermOf,
  isProductSlug,
} from '../catalog/menu.ts'
import {
  EMPTY_SELECTION,
  type PriceLine,
  type Selection,
  addTopping,
  chooseFlavor,
  chooseSize,
  completeLabel,
  missingChoices,
  freeByGroup,
  priceOf,
  selectedByGroup,
  selectedSize,
  settleComplete,
} from '../catalog/selection.ts'
import { formatBRL } from '../../utils/money.ts'

/** Limite técnico de unidades de um mesmo item. Não é regra do cardápio. */
export const MAX_ITEM_QUANTITY = 20

export type ProductCartItem = {
  /** Identificador do item, para editar e remover. */
  id: string
  kind: 'product'
  slug: ProductSlug
  selection: Selection
  /** Quantas unidades deste item montado. */
  quantity: number
}

export type ExtraCartItem = {
  id: string
  kind: 'extra'
  /** Item das gavetas (`catalog/extras.ts`). */
  itemId: string
  /** Escolha de cada grupo do item ("sabor", "sorvete", "cobertura"...). Vazio sem escolha. */
  choices: Readonly<Record<string, string>>
  quantity: number
}

export type CartItem = ProductCartItem | ExtraCartItem

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
    ...(selection.complete ? { complete: true } : {}),
  })
}

/**
 * Refaz a montagem passo a passo pelas regras do cardápio: tamanho, sabor e cada unidade de
 * ingrediente, na ordem em que foram escolhidos. O que as regras recusam fica de fora.
 * Devolve `null` se o produto não existe ou se falta tamanho ou sabor.
 */
export function normalizeSelection(slug: string, selection: Selection): Selection | null {
  if (!isProductSlug(slug)) return null
  const product = PRODUCTS[slug]

  // O Completo (pedido de 2026-11-16) muda as regras: liga antes de refazer os ingredientes.
  const start: Selection = selection.complete === true && product.completo ? { ...EMPTY_SELECTION, complete: true } : EMPTY_SELECTION
  let rebuilt = selection.sizeId ? chooseSize(product, start, selection.sizeId).selection : start
  if (selection.flavorId) rebuilt = chooseFlavor(product, rebuilt, selection.flavorId)
  for (const [toppingId, quantity] of Object.entries(selection.toppings)) {
    const units = Number.isInteger(quantity) ? Math.min(quantity, 100) : 0
    for (let unit = 0; unit < units; unit++) rebuilt = addTopping(product, rebuilt, toppingId)
  }
  rebuilt = settleComplete(product, rebuilt)

  if (missingChoices(product, rebuilt).length > 0) return null
  return freezeSelection(rebuilt)
}

const clampQuantity = (quantity: number) =>
  Number.isInteger(quantity) ? Math.min(MAX_ITEM_QUANTITY, Math.max(1, quantity)) : 1

/** Põe um produto montado no carrinho. Montagem incompleta ou inválida não entra. */
export function addItem(
  cart: Cart,
  slug: ProductSlug,
  selection: Selection,
  id: string = newItemId(),
): { cart: Cart; item: ProductCartItem | null } {
  const normalized = normalizeSelection(slug, selection)
  if (!normalized) return { cart, item: null }
  const item: ProductCartItem = Object.freeze({ id, kind: 'product', slug, selection: normalized, quantity: 1 })
  return { cart: { items: [...cart.items, item] }, item }
}

const sameChoices = (a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

/**
 * Põe um item das gavetas no carrinho, com as escolhas conferidas pelas regras do item. O mesmo
 * item com as mesmas escolhas soma uma unidade na linha que já existe (até o limite técnico).
 * Item desconhecido, que precisa do personalizador ou com escolha inválida não entra.
 */
export function addExtraItem(
  cart: Cart,
  itemId: string,
  choices: Readonly<Record<string, unknown>>,
  id: string = newItemId(),
): { cart: Cart; item: ExtraCartItem | null } {
  const extra = getExtraItem(itemId)
  // Item excluído ou esgotado pelo vendedor não entra.
  const normalized = extra && isOrderableExtra(extra) ? normalizeChoices(extra, choices) : null
  if (!normalized) return { cart, item: null }

  const index = cart.items.findIndex(
    (item) => item.kind === 'extra' && item.itemId === itemId && sameChoices(item.choices, normalized),
  )
  if (index !== -1) {
    const current = cart.items[index] as ExtraCartItem
    const merged: ExtraCartItem = Object.freeze({ ...current, quantity: clampQuantity(current.quantity + 1) })
    const items = [...cart.items]
    items[index] = merged
    return { cart: { items }, item: merged }
  }
  const item: ExtraCartItem = Object.freeze({ id, kind: 'extra', itemId, choices: normalized, quantity: 1 })
  return { cart: { items: [...cart.items, item] }, item }
}

/** Troca a montagem de um item (edição pelo personalizador). A quantidade continua a mesma. */
export function updateItem(cart: Cart, id: string, selection: Selection): Cart {
  const index = cart.items.findIndex((item) => item.id === id)
  if (index === -1) return cart
  const current = cart.items[index]
  if (current.kind !== 'product') return cart
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

const productOf = (item: ProductCartItem): Product => PRODUCTS[item.slug]

/** Preço de uma unidade do item: pelas regras do personalizador ou pela tabela das gavetas. */
export function unitPriceCents(item: CartItem): number {
  if (item.kind === 'extra') {
    const extra = getExtraItem(item.itemId)
    // O preço é sempre o do cardápio, pela opção escolhida (o tamanho do Açaí do Oca).
    return extra ? extraPriceCents(extra, item.choices) : 0
  }
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
  /** Vazio nos produtos de um tamanho só (Pote 1 L Montado, Barca). */
  sizeName: string
  container: string
  /** "Sabor", ou "Cobertura" na barca. */
  flavorLabel: string
  flavorName: string | null
  /** Ingredientes sem custo, por grupo, com "2x" quando repetidos. */
  included: { group: string; items: string[] }[]
  /** Adicionais cobrados, com quantidade e valor. */
  paid: PriceLine[]
  /** "COMPLETO (todos os acompanhamentos)" ou "COMPLETO (SEM: ...)"; `null` fora do Completo. */
  montagem: string | null
}

const CONTAINER_NAMES = { pote: 'Pote', copo: 'Copo', isopor: 'Isopor', barca: 'Barca' } as const

/** Tudo o que o cliente escolheu num produto montado, em texto, para o carrinho. */
export function describeItem(item: ProductCartItem): ItemDescription {
  const product = productOf(item)
  const size = selectedSize(product, item.selection)
  const flavor = product.flavors.find((candidate) => candidate.id === item.selection.flavorId)
  const freeGroups = product.groups.filter((group: ToppingGroupId) => TOPPING_GROUPS[group].rule !== 'paid')
  const singleSize = product.sizes.length === 1

  return {
    productName: product.name,
    sizeName: singleSize ? '' : (size?.name ?? ''),
    container: size && !singleSize ? CONTAINER_NAMES[size.container] : '',
    flavorLabel: flavorTermOf(product).label,
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
    montagem: completeLabel(product, item.selection),
  }
}

/** Nome e escolhas ("Sabor: Nutella") de um item das gavetas, para o carrinho e a mensagem. */
export function describeExtra(item: ExtraCartItem): { name: string; rows: { label: string; value: string }[] } {
  const extra = getExtraItem(item.itemId)
  if (!extra) return { name: item.itemId, rows: [] }
  return { name: extra.name, rows: choiceRows(extra, item.choices) }
}

export type Choice = { name: string; quantity: number; totalCents: number }

export type ChoiceSection = {
  group: ToppingGroupId
  /** Nome do grupo, como no personalizador. */
  label: string
  items: Choice[]
}

export type SelectionSummary = {
  productName: string
  /**
   * Tamanho com o recipiente na frente: "Copo 500 ml", "Isopor M", "Pote 200 ml". Vazio nos
   * produtos de um tamanho só, em que o nome do produto já diz tudo.
   */
  sizeLabel: string
  /** "Sabor", ou "Cobertura" na barca. */
  flavorLabel: string
  flavorName: string | null
  /** Só os grupos com alguma escolha, na ordem do personalizador. */
  sections: ChoiceSection[]
  /** Preço de uma unidade do item montado. */
  unitCents: number
  /** "COMPLETO (todos os acompanhamentos)" ou "COMPLETO (SEM: ...)"; `null` fora do Completo. */
  montagem: string | null
}

/**
 * Tudo o que foi escolhido para um produto, grupo a grupo, para a janela de confirmação e a
 * mensagem do pedido. Diferente de `describeItem`, cada grupo traz juntos os itens que custam e
 * os que não custam: os cremes de ninho e avelã aparecem em "Caldas e cremes", com o preço.
 */
export function summarizeSelection(slug: ProductSlug, selection: Selection): SelectionSummary {
  const product = PRODUCTS[slug]
  const size = selectedSize(product, selection)
  const container = size ? CONTAINER_NAMES[size.container] : ''
  const sizeName = product.sizes.length === 1 ? '' : (size?.name ?? '')
  return {
    productName: product.name,
    sizeLabel: !sizeName || sizeName.startsWith(container) ? sizeName : `${container} ${sizeName}`,
    flavorLabel: flavorTermOf(product).label,
    flavorName: product.flavors.find((candidate) => candidate.id === selection.flavorId)?.name ?? null,
    sections: product.groups
      .map((group) => ({
        group,
        label: TOPPING_GROUPS[group].name,
        items: selectedByGroup(product, selection, group).map(({ topping, quantity }) => ({
          name: topping.name,
          quantity,
          totalCents: topping.priceCents * quantity,
        })),
      }))
      .filter((section) => section.items.length > 0),
    unitCents: priceOf(product, selection)?.totalCents ?? 0,
    montagem: completeLabel(product, selection),
  }
}

/** Uma escolha como o cliente lê: "2x Granola", "Creme de avelã (+ R$ 3,00)". */
export function choiceText({ name, quantity, totalCents }: Choice): string {
  const base = quantity > 1 ? `${quantity}x ${name}` : name
  return totalCents > 0 ? `${base} (+ ${formatBRL(totalCents)})` : base
}

/*
 * Armazenamento: formato versionado, com a ordem dos ingredientes preservada.
 * Versão 2 (2026-11-15): itens das gavetas (`kind: 'extra'`). A versão 1 (só produtos montados)
 * continua sendo lida.
 */

const STORAGE_VERSION = 2

type StoredProductItem = {
  kind?: 'product'
  id: string
  slug: string
  sizeId: string | null
  flavorId: string | null
  toppings: [string, number][]
  /** Montagem Completo (desde 2026-11-16). Sem o campo, montagem normal. */
  complete?: true
  quantity: number
}

type StoredExtraItem = {
  kind: 'extra'
  id: string
  itemId: string
  choices: [string, string][]
  quantity: number
}

export function serializeCart(cart: Cart): string {
  const items: (StoredProductItem | StoredExtraItem)[] = cart.items.map((item) =>
    item.kind === 'extra'
      ? { kind: 'extra', id: item.id, itemId: item.itemId, choices: Object.entries(item.choices), quantity: item.quantity }
      : {
          kind: 'product',
          id: item.id,
          slug: item.slug,
          sizeId: item.selection.sizeId,
          flavorId: item.selection.flavorId,
          toppings: Object.entries(item.selection.toppings),
          ...(item.selection.complete ? { complete: true as const } : {}),
          quantity: item.quantity,
        },
  )
  return JSON.stringify({ v: STORAGE_VERSION, items })
}

const isString = (value: unknown): value is string => typeof value === 'string'

function restoreProduct(entry: Partial<StoredProductItem>): ProductCartItem | null {
  if (!isString(entry.id) || !isString(entry.slug) || !isProductSlug(entry.slug)) return null
  const toppings: Record<string, number> = {}
  for (const pair of Array.isArray(entry.toppings) ? entry.toppings : []) {
    if (Array.isArray(pair) && isString(pair[0]) && typeof pair[1] === 'number') toppings[pair[0]] = pair[1]
  }
  const selection = normalizeSelection(entry.slug, {
    sizeId: isString(entry.sizeId) ? entry.sizeId : null,
    flavorId: isString(entry.flavorId) ? entry.flavorId : null,
    toppings,
    ...(entry.complete === true ? { complete: true } : {}),
  })
  if (!selection) return null
  return Object.freeze({
    id: entry.id,
    kind: 'product',
    slug: entry.slug,
    selection,
    quantity: clampQuantity(Number(entry.quantity)),
  })
}

function restoreExtra(entry: Partial<StoredExtraItem>): ExtraCartItem | null {
  if (!isString(entry.id) || !isString(entry.itemId)) return null
  const extra = getExtraItem(entry.itemId)
  if (!extra || !isOrderableExtra(extra)) return null
  const raw: Record<string, string> = {}
  for (const pair of Array.isArray(entry.choices) ? entry.choices : []) {
    if (Array.isArray(pair) && isString(pair[0]) && isString(pair[1])) raw[pair[0]] = pair[1]
  }
  const choices = normalizeChoices(extra, raw)
  if (!choices) return null
  return Object.freeze({
    id: entry.id,
    kind: 'extra',
    itemId: entry.itemId,
    choices,
    quantity: clampQuantity(Number(entry.quantity)),
  })
}

/**
 * Lê o carrinho guardado. Tudo é conferido de novo pelas regras do cardápio: item de produto
 * que não existe mais, tamanho retirado, sabor que saiu ou dado corrompido simplesmente não volta.
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
  if ((v !== 1 && v !== STORAGE_VERSION) || !Array.isArray(items)) return EMPTY_CART

  const seen = new Set<string>()
  const restored: CartItem[] = []
  for (const entry of items as Partial<StoredProductItem | StoredExtraItem>[]) {
    if (!entry || typeof entry !== 'object' || !isString(entry.id) || seen.has(entry.id)) continue
    const item =
      entry.kind === 'extra' ? restoreExtra(entry as Partial<StoredExtraItem>) : restoreProduct(entry as Partial<StoredProductItem>)
    if (!item) continue
    seen.add(item.id)
    restored.push(item)
  }
  return { items: restored }
}
