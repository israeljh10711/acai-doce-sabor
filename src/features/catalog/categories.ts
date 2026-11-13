/**
 * Categorias do cardápio, na ordem definida pelo proprietário (briefing de 2026-11-12):
 * Açaí Oca, Açaí Tradicional, Açaí Batido e Milk-shake.
 *
 * - `slug` é o trecho usado no endereço da página de cada categoria.
 * - `summary` resume o que a categoria oferece, com fatos do cardápio.
 * - `tagline` é a frase curta da vitrine. Só fatos: nada de ingrediente que não esteja no cardápio.
 * - `actionLabel` é o texto do botão que leva ao personalizador.
 * - `badges` são os selos pedidos pelo proprietário. Só o Açaí Oca tem.
 */
export const CATEGORIES = [
  {
    slug: 'acai-oca',
    name: 'Açaí Oca',
    summary: 'Em pote, copo ou isopor, a partir de 200 ml.',
    tagline: 'A especialidade da casa, montada com os adicionais, as frutas e as coberturas que você quiser.',
    actionLabel: 'Montar açaí Oca',
    badges: ['Especialidade da casa', 'O mais pedido'],
  },
  {
    slug: 'acai-tradicional',
    name: 'Açaí Tradicional',
    summary: 'Em pote, copo ou isopor, a partir de 150 ml.',
    tagline: 'Do seu jeito: adicionais grátis conforme o tamanho, mais frutas e coberturas à vontade.',
    actionLabel: 'Montar açaí Tradicional',
    badges: [],
  },
  {
    slug: 'acai-batido',
    name: 'Açaí Batido',
    summary: 'De 300 ml ou 500 ml, em 3 sabores.',
    tagline: 'Açaí batido com leite condensado, puro, com amendoim ou com paçoca.',
    actionLabel: 'Montar açaí Batido',
    badges: [],
  },
  {
    slug: 'milk-shake',
    name: 'Milk-shake',
    summary: 'De 400 ml ou 500 ml, em 13 sabores.',
    tagline: 'Cremoso e gelado, em 13 sabores, com coberturas se quiser.',
    actionLabel: 'Montar milk-shake',
    badges: [],
  },
] as const

export type Category = (typeof CATEGORIES)[number]
export type CategorySlug = Category['slug']

export function findCategoryBySlug(slug: string | undefined): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug)
}
