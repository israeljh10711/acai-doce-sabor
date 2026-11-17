import { Outlet, ScrollRestoration } from 'react-router'
import { LightboxProvider } from '../../features/lightbox/LightboxProvider.tsx'
import { SellerBarSlot } from '../../features/seller/SellerAccess.tsx'
import { SellerModeProvider } from '../../features/seller/SellerModeProvider.tsx'
import { SiteFooter } from './SiteFooter.tsx'
import { SiteHeader } from './SiteHeader.tsx'

export function AppLayout() {
  return (
    // A foto ampliada vale para o site todo: qualquer foto de produto ou ingrediente abre nela.
    <LightboxProvider>
      {/* Modo vendedor (pedido de 2026-11-16): a faixa no topo e as telas de edição. */}
      <SellerModeProvider>
        <Layout />
      </SellerModeProvider>
    </LightboxProvider>
  )
}

function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-5 focus:py-3 focus:font-semibold focus:text-acai-800 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <SellerBarSlot />
      <SiteHeader />

      {/* Cada página cuida da própria largura, com o Container, para poder ter faixas de ponta a ponta. */}
      <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <SiteFooter />
      <ScrollRestoration />
    </div>
  )
}
