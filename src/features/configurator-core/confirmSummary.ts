/**
 * O que a janela de confirmação mostra: título, escolhas e valor de uma unidade do item.
 */
import { choiceText, summarizeSelection } from '../cart/cart.ts'
import { type ExtraItem, choiceRows, extraPriceCents } from '../catalog/extras.ts'
import type { ProductSlug } from '../catalog/menu.ts'
import type { Selection } from '../catalog/selection.ts'

const list = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

/** O que a janela mostra do item: título, linhas de escolhas e valor de uma unidade. */
export type ConfirmSummary = {
  /** Rótulo acima do título: "Produto e tamanho" ou "Produto". */
  eyebrow: string
  title: string
  rows: readonly { label: string; value: string }[]
  /** Texto quando não há escolhas (montagem sem ingredientes). Sem ele, a lista não aparece. */
  emptyText?: string
  unitCents: number
}

/** Resumo de um produto montado no personalizador. */
export function productSummary(slug: ProductSlug, selection: Selection): ConfirmSummary {
  const summary = summarizeSelection(slug, selection)
  return {
    eyebrow: summary.sizeLabel ? 'Produto e tamanho' : 'Produto',
    title: summary.sizeLabel ? `${summary.productName} — ${summary.sizeLabel}` : summary.productName,
    rows: [
      ...(summary.flavorName ? [{ label: summary.flavorLabel, value: summary.flavorName }] : []),
      ...summary.sections.map((section) => ({ label: section.label, value: list.format(section.items.map(choiceText)) })),
    ],
    emptyText: 'Sem adicionais, frutas nem caldas.',
    unitCents: summary.unitCents,
  }
}

/** Resumo de um item das gavetas, com as escolhas feitas. */
export function extraSummary(item: ExtraItem, choices: Readonly<Record<string, string>>): ConfirmSummary {
  return { eyebrow: 'Produto', title: item.name, rows: choiceRows(item, choices), unitCents: extraPriceCents(item, choices) }
}
