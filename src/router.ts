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
        // O personalizador é carregado só quando aberto, para a página inicial abrir mais rápido.
        path: routePatterns.configurator,
        HydrateFallback: PageLoading,
        lazy: async () => ({
          Component: (await import('./pages/ConfiguratorPage.tsx')).ConfiguratorPage,
        }),
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
