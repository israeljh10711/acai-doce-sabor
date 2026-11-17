/**
 * As 9 entradas da navegação do cardápio (pedido de 2026-11-16): a barra lateral do computador,
 * o menu deslizante e os botões da barra fixa do celular usam a mesma lista.
 *
 * - Grupo "Monte do seu jeito": os 4 produtos do personalizador, com uma dica tirada do cardápio.
 * - Grupo "Catálogo completo": as 5 seções, com o número de itens (o do resultado, na busca).
 */
import { formatBRL } from '../../utils/money.ts'
import { CATEGORIES, type CategorySlug } from './categories.ts'
import { CATEGORY_ICONS } from './emblems.ts'
import { DRAWERS, type DrawerId, EXTRA_ITEMS, type EmblemIcon, drawerById } from './extras.ts'
import { PRODUCTS } from './menu.ts'
import type { SearchResult } from './search.ts'
import { startingPriceCents } from './showcase.ts'

export type NavEntry = {
  id: CategorySlug | DrawerId
  /** Âncora da seção na página (sem o #). */
  anchor: string
  group: 'monte' | 'catalogo'
  /** Nome na barra lateral e no menu do celular. */
  label: string
  /** Nome curto, nos botões da barra fixa do celular. */
  shortLabel: string
  icon: EmblemIcon
  /** Linha abaixo do nome (só os 4 produtos): "Especialidade da casa", "A partir de R$ 6,00"... */
  hint: string | null
  /** Itens da seção (ou encontrados pela busca). Os 4 produtos não têm contagem. */
  count: number | null
  /** A seção está na página agora (a busca esconde as que não têm resultado). */
  available: boolean
}

/** Título do grupo dos 4 produtos (o vendedor pode renomear). Ligação viva. */
export let MONTE_TITLE = 'Monte do seu jeito'
export const BASE_MONTE_TITLE = MONTE_TITLE

/** Troca o título do grupo (só `catalogStore.ts` chama). */
export function setMonteTitle(title: string): void {
  MONTE_TITLE = title
}

export const MAIN_ANCHORS: Readonly<Record<CategorySlug, string>> = {
  'acai-oca': 'secao-acai-oca',
  'acai-tradicional': 'secao-acai-tradicional',
  'acai-batido': 'secao-acai-batido',
  'milk-shake': 'secao-milkshake',
}

const MAIN_SHORT_LABELS: Readonly<Record<CategorySlug, string>> = {
  'acai-oca': 'Açaí Oca',
  'acai-tradicional': 'Tradicional',
  'acai-batido': 'Batido',
  'milk-shake': 'Milk-shake',
}

/** Destino do atalho "Ver Ofertas & Combos". */
export const OFFERS_ANCHOR = drawerById('combos-e-ofertas').anchor

export const NAV_ANCHORS: readonly string[] = [
  ...CATEGORIES.map((category) => MAIN_ANCHORS[category.slug]),
  ...DRAWERS.map((drawer) => drawer.anchor),
]

/** Âncoras de antes de 2026-11-16 (os ids dos cartões e das gavetas) → as seções novas. */
export const LEGACY_ANCHORS: Readonly<Record<string, string>> = Object.fromEntries([
  ...CATEGORIES.map((category) => [category.slug, MAIN_ANCHORS[category.slug]]),
  ...DRAWERS.map((drawer) => [drawer.id, drawer.anchor]),
])

/** "300 ml e 500 ml", "a, b e c". */
const listText = (parts: readonly string[]) =>
  parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`

/** A dica de cada produto, com os dados do cardápio (pedido de 2026-11-16). */
function mainHint(slug: CategorySlug): string {
  switch (slug) {
    case 'acai-oca':
      return CATEGORIES[0].badges[0]
    case 'acai-tradicional':
      return `A partir de ${formatBRL(startingPriceCents(slug))}`
    case 'acai-batido':
      return listText(PRODUCTS[slug].sizes.map((size) => size.name))
    case 'milk-shake':
      return `${PRODUCTS[slug].flavors.length} sabores`
  }
}

export function navEntries(result: SearchResult): readonly NavEntry[] {
  const searching = result.query !== ''
  const main = CATEGORIES.map(
    (category): NavEntry => ({
      id: category.slug,
      anchor: MAIN_ANCHORS[category.slug],
      group: 'monte',
      label: category.name,
      shortLabel: MAIN_SHORT_LABELS[category.slug],
      icon: CATEGORY_ICONS[category.slug],
      hint: mainHint(category.slug),
      count: null,
      available: !searching || result.main.includes(category.slug),
    }),
  )
  const sections = DRAWERS.map(
    (drawer): NavEntry => ({
      id: drawer.id,
      anchor: drawer.anchor,
      group: 'catalogo',
      label: drawer.navLabel,
      shortLabel: drawer.pillLabel,
      icon: drawer.icon,
      hint: null,
      count: searching
        ? (result.drawers.get(drawer.id)?.length ?? 0)
        : EXTRA_ITEMS.filter((item) => item.drawer === drawer.id).length,
      available: !searching || result.drawers.has(drawer.id),
    }),
  )
  return [...main, ...sections]
}
