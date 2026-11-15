import type { ProductSlug } from './features/catalog/menu.ts'

/** Padrões usados na definição das rotas. */
export const routePatterns = {
  home: '/',
  buildOrder: '/monte-seu-pedido',
  configurator: '/monte-seu-pedido/:categoria',
  cart: '/carrinho',
  credits: '/creditos',
} as const

/** Endereços prontos para usar em links. */
export const paths = {
  home: routePatterns.home,
  buildOrder: routePatterns.buildOrder,
  /** Personalizador. Com `itemId`, abre um item do carrinho para editar. */
  configurator: (slug: ProductSlug, itemId?: string) =>
    `${routePatterns.buildOrder}/${slug}${itemId ? `?item=${encodeURIComponent(itemId)}` : ''}`,
  cart: routePatterns.cart,
  credits: routePatterns.credits,
} as const
