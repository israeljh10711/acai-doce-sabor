import type { ProductSlug } from './features/catalog/menu.ts'

/** Padrões usados na definição das rotas. */
export const routePatterns = {
  home: '/',
  buildOrder: '/monte-seu-pedido',
  configurator: '/monte-seu-pedido/:categoria',
  cart: '/carrinho',
  account: '/minha-conta',
  credits: '/creditos',
  /** Painel de pedidos do Modo Vendedor (2026-11-20). */
  orders: '/pedidos',
  /** Acompanhamento do pedido pelo cliente (pedido 100% no site, 2026-11-20). */
  track: '/acompanhar',
  trackOrder: '/acompanhar/:codigo',
  /** Painel do vendedor: cardápio, ofertas e configurações da loja (cardápio dinâmico, 2026-11-21). */
  admin: '/vendedor',
  /** Painel do Modo Vendedor (2026-11-23): operação, loja e cardápio, segurança e sessão. */
  panel: '/painel',
} as const

/** Abas do painel do vendedor (`?aba=`). */
export const ADMIN_TABS = ['catalogo', 'categorias', 'produtos', 'complementos', 'ofertas', 'loja'] as const
export type AdminTab = (typeof ADMIN_TABS)[number]

/** Endereços prontos para usar em links. */
export const paths = {
  home: routePatterns.home,
  buildOrder: routePatterns.buildOrder,
  /** Personalizador. Com `itemId`, abre um item do carrinho para editar. */
  configurator: (slug: ProductSlug, itemId?: string) =>
    `${routePatterns.buildOrder}/${slug}${itemId ? `?item=${encodeURIComponent(itemId)}` : ''}`,
  cart: routePatterns.cart,
  account: routePatterns.account,
  credits: routePatterns.credits,
  orders: routePatterns.orders,
  panel: routePatterns.panel,
  /** Sem código, a lista dos pedidos deste aparelho; com o código, aquele pedido. */
  track: (code?: string) => (code ? `${routePatterns.track}/${encodeURIComponent(code)}` : routePatterns.track),
  /** Painel do vendedor, numa aba. */
  admin: (tab?: AdminTab) => (tab && tab !== 'catalogo' ? `${routePatterns.admin}?aba=${tab}` : routePatterns.admin),
} as const
