import { Suspense, lazy } from 'react'
import { NavLink } from 'react-router'
import { paths } from '../../paths.ts'
import { useSellerMode } from './sellerModeContext.ts'

// O selo de pedidos novos precisa da escuta dos pedidos, que é pesada: carrega só com o Modo Vendedor.
const TabWithBadge = lazy(() => import('./SellerPanelTabBadge.tsx'))

/**
 * Aba "Painel" do topo, ao lado de "Cardápio" e "Carrinho" (2026-11-23). Só aparece com o Modo
 * Vendedor ligado; a bolinha verde mostra que o modo está ativo. Enquanto o selo de pedidos novos
 * carrega, a aba já está na tela, sem o número.
 */
export function SellerPanelTab() {
  const seller = useSellerMode()
  if (!seller.active) return null
  return (
    <Suspense fallback={<PanelLink count={0} />}>
      <TabWithBadge />
    </Suspense>
  )
}

export function PanelLink({ count }: { count: number }) {
  return (
    <NavLink
      to={paths.panel}
      data-seller-panel-link=""
      aria-label={count > 0 ? `Painel do vendedor, Modo Vendedor ativo (${count} ${count === 1 ? 'pedido novo' : 'pedidos novos'})` : 'Painel do vendedor, Modo Vendedor ativo'}
      className="group inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-acai-800 transition-colors duration-150 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 sm:px-3"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-emerald-600" />
      <span className="border-b-2 border-transparent pb-0.5 group-aria-[current=page]:border-orchid-500">Painel</span>
      {count > 0 && (
        <span data-orders-badge={count} className="nums grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-xs leading-5 font-black text-white">
          <span aria-hidden="true">{count}</span>
        </span>
      )}
    </NavLink>
  )
}
