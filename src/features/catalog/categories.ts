/**
 * Categorias do cardápio, na ordem definida pelo proprietário (briefing de 2026-11-12):
 * Açaí Oca, Açaí Tradicional, Açaí Batido e Milk-shake.
 *
 * - `slug` é o trecho usado no endereço da página de cada categoria.
 * - `summary` resume o que a categoria oferece, com fatos do cardápio.
 * - `tagline` é a frase curta da vitrine. Só fatos: nada de ingrediente que não esteja no cardápio.
 * - `actionLabel` é o texto do botão que leva ao personalizador.
 * - `badges` são os selos pedidos pelo proprietário. Só o Açaí Oca tem.
 * - `keywords` são sinônimos para a busca do cardápio (pedido de 2026-11-15: "batida" acha o
 *   Açaí Batido).
 */
const BASE = [
  {
    slug: 'acai-oca',
    name: 'Açaí Oca',
    summary: 'Em pote, copo ou isopor, a partir de 200 ml.',
    tagline: 'A especialidade da casa, montada com os adicionais, as frutas e as coberturas que você quiser.',
    actionLabel: 'Montar açaí Oca',
    badges: ['Especialidade da casa', 'O mais pedido'],
    keywords: ['oca', 'especialidade'],
  },
  {
    slug: 'acai-tradicional',
    name: 'Açaí Tradicional',
    summary: 'Em pote, copo ou isopor, a partir de 150 ml.',
    tagline: 'Do seu jeito: adicionais grátis conforme o tamanho, mais frutas e coberturas à vontade.',
    actionLabel: 'Montar açaí Tradicional',
    badges: [],
    keywords: ['tradicional'],
  },
  {
    slug: 'acai-batido',
    name: 'Açaí Batido',
    summary: 'De 300 ml ou 500 ml, em 3 sabores.',
    tagline: 'Açaí batido com leite condensado, puro, com amendoim ou com paçoca.',
    actionLabel: 'Montar açaí Batido',
    badges: [],
    keywords: ['batida', 'batido'],
  },
  {
    slug: 'milk-shake',
    name: 'Milk-shake',
    summary: 'De 400 ml ou 500 ml, em 13 sabores.',
    tagline: 'Cremoso e gelado, em 13 sabores, com coberturas se quiser.',
    actionLabel: 'Montar milk-shake',
    badges: [],
    keywords: ['milkshake', 'milk shake', 'shake'],
  },
] as const

export type CategorySlug = (typeof BASE)[number]['slug']
export type CategoryBadge = (typeof BASE)[number]['badges'][number]

export type Category = {
  slug: CategorySlug
  name: string
  summary: string
  tagline: string
  actionLabel: string
  badges: readonly CategoryBadge[]
  keywords: readonly string[]
  /** Foto enviada pelo vendedor (endereço), no lugar da foto da loja (modo vendedor, 2026-11-16). */
  photo?: string
}

/** As categorias como estão no código (a base das mudanças do vendedor). */
export const BASE_CATEGORIES: readonly Category[] = BASE

/** As categorias como aparecem agora (base com as mudanças do vendedor). Ligação viva. */
export let CATEGORIES: readonly Category[] = BASE_CATEGORIES

/** Troca as categorias (só `catalogStore.ts` chama). */
export function setCategories(categories: readonly Category[]): void {
  CATEGORIES = categories
}

export function findCategoryBySlug(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug)
}
