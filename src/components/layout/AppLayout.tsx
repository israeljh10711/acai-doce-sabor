import { Outlet, ScrollRestoration } from 'react-router'
import { SiteFooter } from './SiteFooter.tsx'
import { SiteHeader } from './SiteHeader.tsx'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-brand-900 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 focus:outline-none sm:px-6 sm:py-12"
      >
        <Outlet />
      </main>

      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
