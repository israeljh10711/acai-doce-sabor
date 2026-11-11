/**
 * Categorias da área "Monte seu Pedido", na ordem definida pelo proprietário.
 *
 * - `slug` é o trecho usado no endereço da página de cada categoria.
 * - `summary` resume o que a categoria oferece, com fatos do cardápio confirmado
 *   em 2026-11-11. Por enquanto o texto é fixo; na Fase 3 passa a ser montado a
 *   partir dos dados do cardápio.
 * - `actionLabel` é o texto do botão que leva ao personalizador.
 */
export const CATEGORIES = [
  {
    slug: 'acai-oca',
    name: 'Açaí Oca',
    summary: 'Em pote, copo ou isopor, a partir de 200 ml.',
    actionLabel: 'Montar açaí Oca',
  },
  {
    slug: 'acai-tradicional',
    name: 'Açaí Tradicional',
    summary: 'Em pote, copo ou isopor, a partir de 150 ml.',
    actionLabel: 'Montar açaí Tradicional',
  },
  {
    slug: 'milk-shake',
    name: 'Milk-shake',
    summary: 'De 400 ml ou 500 ml, em 13 sabores.',
    actionLabel: 'Montar milk-shake',
  },
] as const

export type Category = (typeof CATEGORIES)[number]
export type CategorySlug = Category['slug']

export function findCategoryBySlug(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug)
}
