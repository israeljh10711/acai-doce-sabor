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
  offers,
  toppingsOf,
} from './menu.ts'

export type Selection = {
  sizeId: string | null
  flavorId: string | null
  /** Unidades de cada ingrediente, na ordem em que foram escolhidos. */
  toppings: Readonly<Record<string, number>>
  /**
   * Montagem "Completo" (pedido de 2026-11-16): todos os adicionais, frutas e caldas e cremes, 1 de
   * cada, pelo preço do tamanho, sem cota. Sem o campo (ou `false`), valem as regras de sempre.
   */
  complete?: boolean
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

/** Menor e maior limite gratuito entre os tamanhos do produto. */
export function freeLimitRange(product: Product): { min: number; max: number } {
  const limits = product.sizes.map((size) => size.freeToppings)
  return { min: Math.min(...limits), max: Math.max(...limits) }
}

/**
 * Até onde os adicionais gratuitos podem ir agora. Com o tamanho escolhido, é o limite dele.
 * Sem tamanho, o cliente pode montar livremente até o maior limite do produto; ao escolher o
 * tamanho, o que passar do limite dele sai, com aviso (`chooseSize`).
 */
export function freeCap(product: Product, selection: Selection): number {
  return selectedSize(product, selection)?.freeToppings ?? freeLimitRange(product).max
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
 * Por que mais uma unidade de um ingrediente não pode entrar. A ordem das escolhas é livre:
 * dá para escolher ingredientes antes do tamanho (pedido de 2026-11-14).
 *
 * - `not-in-product`: o produto não aceita esse ingrediente;
 * - `free-limit`: o limite de adicionais gratuitos está cheio;
 * - `item-max`: o item já está na quantidade máxima (uma vez nas frutas, caldas e cremes; 10 nos
 *   adicionais pagos e nos adicionais grátis);
 * - `group-limit`: o grupo já tem o número de ingredientes que o produto aceita (na barca, 2 frutas).
 */
export type AddBlocker = 'not-in-product' | 'unavailable' | 'free-limit' | 'item-max' | 'group-limit'

export function addBlocker(
  product: Product,
  selection: Selection,
  toppingId: string,
): AddBlocker | null {
  const topping = getTopping(toppingId)
  if (!topping || !offers(product, topping)) return 'not-in-product'
  // Esgotado pelo vendedor (modo vendedor, 2026-11-16).
  if (topping.available === false) return 'unavailable'

  const quantity = quantityOf(selection, toppingId)
  // Completo: os grupos dele vão 1 de cada, sem cota nem limite do grupo.
  if (selection.complete && inComplete(product, topping)) return quantity >= 1 ? 'item-max' : null

  switch (ruleOf(topping)) {
    case 'limited':
      if (quantity >= MAX_PAID_UNITS) return 'item-max'
      return freeUsed(selection) >= freeCap(product, selection) ? 'free-limit' : null
    case 'included': {
      if (quantity >= 1) return 'item-max'
      const limit = product.groupLimits?.[topping.group]
      return limit !== undefined && selectedByGroup(product, selection, topping.group).length >= limit ? 'group-limit' : null
    }
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
  // No Completo não há cota: nada sai ao trocar de tamanho.
  if (selection.complete) return { selection: { ...selection, sizeId }, removed: [] }

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

/** Ingredientes escolhidos de um grupo que têm preço. */
export function pricedByGroup(product: Product, selection: Selection, group: ToppingGroupId) {
  return selectedByGroup(product, selection, group).filter(({ topping }) => topping.priceCents > 0)
}

/** Ingredientes escolhidos de um grupo que não custam nada. */
export function freeByGroup(product: Product, selection: Selection, group: ToppingGroupId) {
  return selectedByGroup(product, selection, group).filter(({ topping }) => topping.priceCents === 0)
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
  /** Um item por adicional cobrado escolhido, na ordem do cardápio. */
  paidLines: PriceLine[]
  paidCents: number
  totalCents: number
}

/** Preço do produto montado. Não existe antes de o tamanho ser escolhido. */
export function priceOf(product: Product, selection: Selection): Price | null {
  const size = selectedSize(product, selection)
  if (!size) return null

  // Todo item com preço entra: os adicionais pagos, os do batido e os cremes das caldas e cremes.
  // No Completo, os grupos dele (com os cremes) já estão no preço do tamanho.
  const charged = selection.complete ? product.groups.filter((group) => !COMPLETE_GROUPS.includes(group)) : product.groups
  const paidLines = charged.flatMap((group) =>
    pricedByGroup(product, selection, group).map(({ topping, quantity }) => ({
      toppingId: topping.id,
      name: topping.name,
      quantity,
      unitCents: topping.priceCents,
      totalCents: topping.priceCents * quantity,
    })),
  )
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

/*
 * Botão "Completo" (pedido de 2026-11-16): na loja, o cliente pede "completo", paga o preço do
 * tamanho e diz o que não quer. Só nos produtos com `completo` (Oca, Tradicional, Pote 1 L e Barca).
 */

/** Grupos que o Completo marca: adicionais, frutas e caldas e cremes. Os pagos ficam de fora. */
export const COMPLETE_GROUPS: readonly ToppingGroupId[] = ['dry', 'fruit', 'syrup']

const inComplete = (product: Product, topping: Topping) =>
  Boolean(product.completo) && COMPLETE_GROUPS.includes(topping.group)

/** O que o Completo marca no produto, na ordem do cardápio: tudo dos grupos dele, menos o esgotado. */
export function completeToppings(product: Product): readonly Topping[] {
  if (!product.completo) return []
  return COMPLETE_GROUPS.flatMap((group) => toppingsOf(product, group)).filter((topping) => topping.available !== false)
}

/**
 * Marca tudo (1 de cada) e liga o modo Completo. Mantém tamanho, sabor e os itens pagos já
 * escolhidos; também serve para "Marcar tudo novamente".
 */
export function applyComplete(product: Product, selection: Selection): Selection {
  if (!product.completo) return selection
  const marked = new Set(completeToppings(product).map((topping) => topping.id))
  const toppings: Record<string, number> = {}
  // Primeiro os itens pagos já escolhidos (fora do Completo), depois tudo o que ele marca.
  for (const [id, quantity] of Object.entries(selection.toppings)) {
    const topping = getTopping(id)
    if (topping && !inComplete(product, topping)) toppings[id] = quantity
  }
  for (const id of marked) toppings[id] = 1
  return { ...selection, toppings, complete: true }
}

/** "Limpar": tira os acompanhamentos (e os pagos) e volta ao modo normal; tamanho e sabor ficam. */
export function clearToppings(selection: Selection): Selection {
  return { ...selection, toppings: {}, complete: false }
}

/** Desliga o modo Completo quando o cliente tirou tudo o que ele marcou. */
export function settleComplete(product: Product, selection: Selection): Selection {
  if (!selection.complete) return selection
  const left = Object.keys(selection.toppings).some((id) => {
    const topping = getTopping(id)
    return topping !== undefined && inComplete(product, topping)
  })
  return left ? selection : { ...selection, complete: false }
}

/** O que o cliente tirou do Completo ("COMPLETO (SEM: Farinha láctea)"), na ordem do cardápio. */
export function completeOmitted(product: Product, selection: Selection): readonly Topping[] {
  if (!selection.complete) return []
  return completeToppings(product).filter((topping) => quantityOf(selection, topping.id) === 0)
}

/** Tudo o que o Completo marca está marcado (o botão vira "Completo aplicado"). */
export function isCompleteFull(product: Product, selection: Selection): boolean {
  return Boolean(selection.complete) && completeOmitted(product, selection).length === 0
}

/**
 * Linha da montagem no resumo, na confirmação, no carrinho e no WhatsApp:
 * "COMPLETO (todos os acompanhamentos)" ou "COMPLETO (SEM: Farinha láctea, Granola)".
 * Fora do Completo, `null`.
 */
export function completeLabel(product: Product, selection: Selection): string | null {
  if (!selection.complete) return null
  const omitted = completeOmitted(product, selection).map((topping) => topping.name)
  return omitted.length === 0 ? 'COMPLETO (todos os acompanhamentos)' : `COMPLETO (SEM: ${omitted.join(', ')})`
}

/** Quantas unidades de ingredientes estão escolhidas ("18 itens selecionados"). */
export function selectedCount(selection: Selection): number {
  return Object.values(selection.toppings).reduce((sum, quantity) => sum + quantity, 0)
}
