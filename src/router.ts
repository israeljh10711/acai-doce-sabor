import { createBrowserRouter } from 'react-router'
import { AppLayout } from './components/layout/AppLayout.tsx'
import { BuildOrderPage } from './pages/BuildOrderPage.tsx'
import { ConfiguratorPage } from './pages/ConfiguratorPage.tsx'
import { ErrorPage } from './pages/ErrorPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { routePatterns } from './paths.ts'

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    ErrorBoundary: ErrorPage,
    children: [
      { index: true, Component: HomePage },
      { path: routePatterns.buildOrder, Component: BuildOrderPage },
      { path: routePatterns.configurator, Component: ConfiguratorPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
