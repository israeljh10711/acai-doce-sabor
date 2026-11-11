/**
 * Categorias da área "Monte seu Pedido", na ordem definida pelo proprietário.
 * O slug é o trecho usado no endereço da página de cada categoria.
 */
export const CATEGORIES = [
  { slug: 'acai-oca', name: 'Açaí Oca' },
  { slug: 'acai-tradicional', name: 'Açaí Tradicional' },
  { slug: 'milk-shake', name: 'Milk-shake' },
] as const

export type Category = (typeof CATEGORIES)[number]
export type CategorySlug = Category['slug']

export function findCategoryBySlug(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug)
}
