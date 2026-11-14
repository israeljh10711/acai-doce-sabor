/**
 * Textos curtos que o personalizador mostra ou anuncia para leitores de tela.
 */
import { type Product, type Topping, TOPPING_GROUPS, getTopping } from '../catalog/menu.ts'
import {
  type AddBlocker,
  type RemovedTopping,
  type Selection,
  freeLimit,
  freeUsed,
  quantityOf,
} from '../catalog/selection.ts'
import { formatBRL } from '../../utils/money.ts'

/** Nome do ingrediente fora do seu grupo. "Morango" é fruta e também cobertura (calda). */
export function toppingLabel(topping: Topping): string {
  return topping.group === 'syrup' && topping.priceCents === 0 ? `cobertura de ${topping.name}` : topping.name
}

export function blockerText(blocker: AddBlocker, limit: number): string {
  switch (blocker) {
    case 'free-limit':
      return `Limite de ${limit} adicionais grátis atingido`
    case 'item-max':
      return 'Quantidade máxima atingida'
    case 'not-in-product':
      return 'Indisponível neste produto'
  }
}

function freeCount(product: Product, selection: Selection): string {
  return `${freeUsed(selection)} de ${freeLimit(product, selection)} adicionais grátis usados.`
}

function paidCount(topping: Topping, quantity: number): string {
  const units = quantity === 1 ? 'unidade' : 'unidades'
  return `${quantity} ${units}, ${formatBRL(topping.priceCents * quantity)}.`
}

/** Anúncio depois de somar uma unidade. Recebe a seleção já atualizada. */
export function addedText(product: Product, selection: Selection, toppingId: string): string {
  const topping = getTopping(toppingId)
  if (!topping) return ''

  switch (TOPPING_GROUPS[topping.group].rule) {
    case 'limited':
      return `Você adicionou ${topping.name}. ${freeCount(product, selection)}`
    case 'paid':
      return `Você adicionou ${topping.name}. ${paidCount(topping, quantityOf(selection, toppingId))}`
    case 'included':
      return topping.priceCents > 0
        ? `Você incluiu ${toppingLabel(topping)}, ${formatBRL(topping.priceCents)}.`
        : `Você incluiu ${toppingLabel(topping)}.`
  }
}

/** Anúncio depois de tirar uma unidade. Recebe a seleção já atualizada. */
export function removedText(product: Product, selection: Selection, toppingId: string): string {
  const topping = getTopping(toppingId)
  if (!topping) return ''

  const removed = `Você tirou ${toppingLabel(topping)}.`
  const quantity = quantityOf(selection, toppingId)

  switch (TOPPING_GROUPS[topping.group].rule) {
    case 'limited':
      return `${removed} ${freeCount(product, selection)}`
    case 'paid':
      return quantity > 0 ? `${removed} ${paidCount(topping, quantity)}` : removed
    case 'included':
      return removed
  }
}

/** Aviso dos adicionais que saíram ao trocar para um tamanho menor. Vazio se nada saiu. */
export function removedBySizeText(removed: RemovedTopping[]): string {
  if (removed.length === 0) return ''
  const list = removed
    .map(({ toppingId, quantity }) => `${quantity} ${getTopping(toppingId)?.name ?? toppingId}`)
    .join(', ')
  return `Saíram por passar do novo limite: ${list}.`
}

export function sizeText(product: Product, sizeId: string, removed: RemovedTopping[]): string {
  const size = product.sizes.find((candidate) => candidate.id === sizeId)
  if (!size) return ''

  const chosen = `Tamanho: ${size.name}, ${formatBRL(size.priceCents)}.`
  return removed.length === 0 ? chosen : `${chosen} ${removedBySizeText(removed)}`
}

export function flavorText(product: Product, flavorId: string): string {
  const flavor = product.flavors.find((candidate) => candidate.id === flavorId)
  return flavor ? `Sabor: ${flavor.name}.` : ''
}
