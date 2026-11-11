import type { CategorySlug } from './features/catalog/categories.ts'

/** Padrões usados na definição das rotas. */
export const routePatterns = {
  home: '/',
  buildOrder: '/monte-seu-pedido',
  configurator: '/monte-seu-pedido/:categoria',
} as const

/** Endereços prontos para usar em links. */
export const paths = {
  home: routePatterns.home,
  buildOrder: routePatterns.buildOrder,
  configurator: (slug: CategorySlug) => `${routePatterns.buildOrder}/${slug}`,
} as const
