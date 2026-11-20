import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Container } from '../../components/layout/Container.tsx'
import { ArrowRight } from '../../components/ui/icons.tsx'
import { paths, routePatterns } from '../../paths.ts'
import { cartCount } from '../cart/cart.ts'
import { useCart } from '../cart/cartStore.ts'
import type { AddMode } from './addMode.ts'
import { CUSTOMER_STATUS_LABEL } from './timeline.ts'
import { isActive } from './trackedOrders.ts'
import { getAddMode, useAddMode, useCustomerConnection, useTrackedOrders } from './trackingRuntime.ts'

/**
 * A faixa logo abaixo do cabeçalho (pedido 100% no site, 2026-11-20). No celular estreito o
 * cabeçalho não tem espaço para mais um botão, então:
 * - com pedido em andamento neste aparelho: "📦 Acompanhar pedido #ADS-0001 · Preparando" (a
 *   situação muda ao vivo; some na própria tela de acompanhamento);
 * - no modo de adição: "➕ Adicionando itens ao pedido #…", com "Cancelar adição".
 */
export function TrackingBar() {
  const { pathname } = useLocation()
  const addMode = useAddMode()
  const orders = useTrackedOrders()
  const active = useMemo(() => orders.filter(isActive), [orders])
  const onTracking = pathname === routePatterns.track || pathname.startsWith(`${routePatterns.track}/`)
  // O painel do vendedor não mostra a faixa do cliente.
  const showStrip = !addMode && !onTracking && pathname !== routePatterns.orders && active.length > 0
  useCustomerConnection(showStrip && active.some((order) => order.tracked || order.demo))

  if (addMode) return <AddModeBanner mode={addMode} onCart={pathname === routePatterns.cart} />
  if (!showStrip) return null
  const single = active.length === 1 ? active[0] : null
  return (
    <div data-tracking-strip="" className="border-b border-gold-400 bg-gold-100">
      <Container>
        <Link
          to={single ? paths.track(single.code) : paths.track()}
          className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm font-bold text-acai-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
        >
          <span className="min-w-0">
            <span className="font-extrabold">📦 Acompanhar pedido</span>
            {single ? (
              <span className="nums">
                {' '}
                #{single.code} · <span data-strip-status={single.status}>{CUSTOMER_STATUS_LABEL[single.status]}</span>
              </span>
            ) : (
              <span> ({active.length} em andamento)</span>
            )}
          </span>
          <ArrowRight className="size-4 shrink-0 text-acai-800" />
        </Link>
      </Container>
    </div>
  )
}

function AddModeBanner({ mode, onCart }: { mode: AddMode; onCart: boolean }) {
  const navigate = useNavigate()
  const count = cartCount(useCart())
  const cancel = () => {
    getAddMode().stop()
    void navigate(paths.track(mode.code))
  }
  const button =
    'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white'
  return (
    <div data-add-mode-banner={mode.code} role="region" aria-label={`Adicionando itens ao pedido ${mode.code}`} className="bg-acai-950 text-white">
      <Container className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="nums font-display text-base leading-tight font-extrabold">➕ Adicionando itens ao pedido #{mode.code}</p>
          <p className="text-sm text-white/85">Escolha os produtos que deseja acrescentar ao seu pedido.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!onCart && (
            <Link to={paths.cart} data-add-mode-review="" className={`${button} btn-gold flex-1 sm:flex-none`}>
              {count > 0 ? `Revisar e confirmar (${count})` : 'Ver carrinho'}
            </Link>
          )}
          <button type="button" data-add-mode-cancel="" onClick={cancel} className={`${button} flex-1 ring-1 ring-white/60 hover:bg-white/10 sm:flex-none`}>
            Cancelar adição
          </button>
        </div>
      </Container>
    </div>
  )
}
