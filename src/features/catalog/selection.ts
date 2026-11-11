/**
 * Regras de montagem e de preço de um produto.
 *
 * Funções puras: recebem o produto e a seleção atual e devolvem uma seleção nova,
 * sem alterar a que receberam. A interface só mostra o que estas funções decidem.
 * Na Fase 6 as mesmas regras são repetidas no servidor, que é quem vale.
 */
import {
  MAX_PAID_UNITS,
  type Product,
  type ProductSize,
  TOPPING_GROUPS,
  type Topping,
  type ToppingGroupId,
  getTopping,
  toppingsOf,
} from './menu.ts'

export type Selection = {
  sizeId: string | null
  flavorId: string | null
  /** Unidades de cada ingrediente, na ordem em que foram escolhidos. */
  toppings: Readonly<Record<string, number>>
}

export const EMPTY_SELECTION: Selection = Object.freeze({
  sizeId: null,
  flavorId: null,
  toppings: Object.freeze({}),
})

const ruleOf = (topping: Topping) => TOPPING_GROUPS[topping.group].rule

export function selectedSize(product: Product, selection: Selection): ProductSize | undefined {
  return product.sizes.find((size) => size.id === selection.sizeId)
}

export function quantityOf(selection: Selection, toppingId: string): number {
  return selection.toppings[toppingId] ?? 0
}

/** Quantos adicionais gratuitos o tamanho escolhido inclui. Zero sem tamanho. */
export function freeLimit(product: Product, selection: Selection): number {
  return selectedSize(product, selection)?.freeToppings ?? 0
}

/** Quantas unidades de adicionais gratuitos já foram escolhidas. */
export function freeUsed(selection: Selection): number {
  let used = 0
  for (const [id, quantity] of Object.entries(selection.toppings)) {
    const topping = getTopping(id)
    if (topping && ruleOf(topping) === 'limited') used += quantity
  }
  return used
}

/**
 * Por que mais uma unidade de um ingrediente não pode entrar:
 *
 * - `no-size`: o tamanho ainda não foi escolhido;
 * - `not-in-product`: o produto não aceita esse ingrediente;
 * - `free-limit`: o limite de adicionais gratuitos do tamanho está cheio;
 * - `item-max`: o item já está na quantidade máxima.
 */
export type AddBlocker = 'no-size' | 'not-in-product' | 'free-limit' | 'item-max'

export function addBlocker(
  product: Product,
  selection: Selection,
  toppingId: string,
): AddBlocker | null {
  const topping = getTopping(toppingId)
  if (!topping || !product.groups.includes(topping.group)) return 'not-in-product'
  if (!selectedSize(product, selection)) return 'no-size'

  const quantity = quantityOf(selection, toppingId)
  switch (ruleOf(topping)) {
    case 'limited':
      return freeUsed(selection) >= freeLimit(product, selection) ? 'free-limit' : null
    case 'included':
      return quantity >= 1 ? 'item-max' : null
    case 'paid':
      return quantity >= MAX_PAID_UNITS ? 'item-max' : null
  }
}

/** Soma uma unidade do ingrediente. Devolve a mesma seleção quando não pode. */
export function addTopping(product: Product, selection: Selection, toppingId: string): Selection {
  if (addBlocker(product, selection, toppingId)) return selection

  return {
    ...selection,
    toppings: { ...selection.toppings, [toppingId]: quantityOf(selection, toppingId) + 1 },
  }
}

/** Tira uma unidade do ingrediente. Devolve a mesma seleção quando ele não foi escolhido. */
export function removeTopping(selection: Selection, toppingId: string): Selection {
  const quantity = quantityOf(selection, toppingId)
  if (quantity === 0) return selection

  const toppings = { ...selection.toppings }
  if (quantity === 1) delete toppings[toppingId]
  else toppings[toppingId] = quantity - 1

  return { ...selection, toppings }
}

export type RemovedTopping = { toppingId: string; quantity: number }

/**
 * Escolhe o tamanho. Se o novo tamanho inclui menos adicionais gratuitos do que
 * os já escolhidos, tira os que passam do limite, começando pelos últimos
 * escolhidos, e informa quais saíram.
 */
export function chooseSize(
  product: Product,
  selection: Selection,
  sizeId: string,
): { selection: Selection; removed: RemovedTopping[] } {
  const size = product.sizes.find((candidate) => candidate.id === sizeId)
  if (!size) return { selection, removed: [] }

  const toppings = { ...selection.toppings }
  const removed: RemovedTopping[] = []
  let excess = freeUsed(selection) - size.freeToppings

  for (const id of Object.keys(toppings).reverse()) {
    if (excess <= 0) break
    const topping = getTopping(id)
    if (!topping || ruleOf(topping) !== 'limited') continue

    const quantity = Math.min(toppings[id], excess)
    excess -= quantity
    removed.push({ toppingId: id, quantity })
    if (toppings[id] === quantity) delete toppings[id]
    else toppings[id] -= quantity
  }

  return { selection: { ...selection, sizeId, toppings }, removed }
}

/** Escolhe o sabor. Devolve a mesma seleção quando o produto não tem esse sabor. */
export function chooseFlavor(product: Product, selection: Selection, flavorId: string): Selection {
  if (!product.flavors.some((flavor) => flavor.id === flavorId)) return selection
  return { ...selection, flavorId }
}

/** Ingredientes escolhidos de um grupo, na ordem do cardápio. */
export function selectedByGroup(
  product: Product,
  selection: Selection,
  group: ToppingGroupId,
): { topping: Topping; quantity: number }[] {
  return toppingsOf(product, group)
    .map((topping) => ({ topping, quantity: quantityOf(selection, topping.id) }))
    .filter(({ quantity }) => quantity > 0)
}

export type PriceLine = {
  toppingId: string
  name: string
  quantity: number
  unitCents: number
  totalCents: number
}

export type Price = {
  sizeCents: number
  /** Um item por adicional pago escolhido, na ordem do cardápio. */
  paidLines: PriceLine[]
  paidCents: number
  totalCents: number
}

/** Preço do produto montado. Não existe antes de o tamanho ser escolhido. */
export function priceOf(product: Product, selection: Selection): Price | null {
  const size = selectedSize(product, selection)
  if (!size) return null

  const paidLines = selectedByGroup(product, selection, 'paid').map(({ topping, quantity }) => ({
    toppingId: topping.id,
    name: topping.name,
    quantity,
    unitCents: topping.priceCents,
    totalCents: topping.priceCents * quantity,
  }))
  const paidCents = paidLines.reduce((sum, line) => sum + line.totalCents, 0)

  return { sizeCents: size.priceCents, paidLines, paidCents, totalCents: size.priceCents + paidCents }
}

export type MissingChoice = 'size' | 'flavor'

/** Escolhas obrigatórias que ainda faltam para o produto ficar completo. */
export function missingChoices(product: Product, selection: Selection): MissingChoice[] {
  const missing: MissingChoice[] = []
  if (!selectedSize(product, selection)) missing.push('size')
  if (product.flavors.length > 0 && !product.flavors.some((f) => f.id === selection.flavorId)) {
    missing.push('flavor')
  }
  return missing
}
