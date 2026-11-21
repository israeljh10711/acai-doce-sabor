import { createBrowserRouter } from 'react-router'
import { AppLayout } from './components/layout/AppLayout.tsx'
import { BuildOrderPage } from './pages/BuildOrderPage.tsx'
import { CartPage } from './pages/CartPage.tsx'
import { ErrorPage } from './pages/ErrorPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { PageLoading } from './pages/PageLoading.tsx'
import { routePatterns } from './paths.ts'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: HomePage },
      { path: routePatterns.buildOrder, Component: BuildOrderPage },
      { path: routePatterns.cart, Component: CartPage },
      {
        // Os créditos (com a lista das fontes de cada foto) também só carregam quando abertos.
        path: routePatterns.credits,
        HydrateFallback: PageLoading,
        lazy: async () => ({ Component: (await import('./pages/CreditsPage.tsx')).CreditsPage }),
      },
      {
        // Painel de pedidos do Modo Vendedor (2026-11-20): só o vendedor abre, carregado sob demanda.
        path: routePatterns.orders,
        HydrateFallback: PageLoading,
        lazy: async () => ({ Component: (await import('./pages/OrdersPage.tsx')).OrdersPage }),
      },
      {
        // Acompanhamento do pedido pelo cliente (pedido 100% no site, 2026-11-20), carregado sob demanda.
        path: routePatterns.track,
        HydrateFallback: PageLoading,
        lazy: async () => ({ Component: (await import('./pages/TrackOrderPage.tsx')).TrackOrderPage }),
      },
      {
        path: routePatterns.trackOrder,
        HydrateFallback: PageLoading,
        lazy: async () => ({ Component: (await import('./pages/TrackOrderPage.tsx')).TrackOrderPage }),
      },
      {
        // O personalizador é carregado só quando aberto, para a página inicial abrir mais rápido.
        path: routePatterns.configurator,
        HydrateFallback: PageLoading,
        lazy: async () => ({
          Component: (await import('./pages/ConfiguratorPage.tsx')).ConfiguratorPage,
        }),
      },
      {
        // Painel do vendedor (cardápio dinâmico, 2026-11-21), carregado só quando aberto.
        path: routePatterns.admin,
        HydrateFallback: PageLoading,
        lazy: async () => ({ Component: (await import('./pages/SellerAdminPage.tsx')).SellerAdminPage }),
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
