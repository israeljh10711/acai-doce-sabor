import { type ReactNode, useState } from 'react'
import { Container } from '../components/layout/Container.tsx'
import { ClipboardList, LockOpen, RotateCcw } from '../components/ui/icons.tsx'
import { OrderCard } from '../features/orders/OrderCard.tsx'
import { soundAlert } from '../features/orders/orderAlert.ts'
import type { OrdersSnapshot } from '../features/orders/ordersLive.ts'
import { ORDER_FILTERS, type OrderFilter, type OrderStatus, type PanelOrder, STATUS_LABEL, filterCounts, filterOrders } from '../features/orders/ordersPanel.ts'
import { getOrdersLive, useOrders, useOrdersConnection, useSoundState } from '../features/orders/ordersRuntime.ts'
import { useSellerMode } from '../features/seller/sellerModeContext.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'

const withoutKey = <T,>(record: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))

const toolButton =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-sm font-bold ring-1 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold-400'

/**
 * Painel de pedidos ao vivo do Modo Vendedor (2026-11-20), para deixar aberto no balcão: os
 * pedidos chegam sozinhos (Supabase Realtime, ou as abas no modo de demonstração local), com
 * aviso sonoro, filtros rápidos e o fluxo de situação de cada modalidade. Só para o vendedor.
 */
export function OrdersPage() {
  const seller = useSellerMode()
  const { newCount } = useOrders()
  // Fora dos buscadores sempre; o título mostra quantos pedidos estão como "novo".
  usePageTitle(newCount > 0 ? `(${newCount}) Pedidos` : 'Pedidos', { noindex: true })
  if (!seller.active) {
    return (
      <Shell>
        <Notice title="Esta página é do Modo Vendedor">
          Entre com a senha do vendedor para ver e atender os pedidos.
          <button
            type="button"
            data-orders-login=""
            onClick={seller.openAuth}
            className="btn-gold mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <LockOpen className="size-5" />
            Entrar no Modo Vendedor
          </button>
        </Notice>
      </Shell>
    )
  }
  return <Board />
}

function liveText(snapshot: OrdersSnapshot): string {
  if (snapshot.kind === 'local') return 'Modo de demonstração local: pedidos guardados só neste navegador, sem o Supabase.'
  switch (snapshot.live) {
    case 'live':
      return '🟢 Ao vivo: os pedidos chegam sozinhos.'
    case 'offline':
      return 'Sem a conexão ao vivo agora: o painel confere sozinho a cada 15 segundos.'
    default:
      return 'Conectando ao vivo…'
  }
}

function Board() {
  useOrdersConnection()
  const snapshot = useOrders()
  const sound = useSoundState()
  const [filter, setFilter] = useState<OrderFilter>('todos')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [announcement, setAnnouncement] = useState('')

  const counts = filterCounts(snapshot.orders)
  const shown = filterOrders(snapshot.orders, filter)
  // "Hoje" para os cartões: o dia da última consulta (os cartões só aparecem depois dela).
  const now = snapshot.updatedAt ?? 0

  const changeStatus = async (order: PanelOrder, status: OrderStatus) => {
    if (busy[order.id]) return
    setBusy((current) => ({ ...current, [order.id]: true }))
    setErrors((current) => withoutKey(current, order.id))
    const result = await getOrdersLive().setStatus(order, status)
    if (result.ok) setAnnouncement(`Pedido ${order.code}: ${STATUS_LABEL[status]}.`)
    else setErrors((current) => ({ ...current, [order.id]: result.message }))
    setBusy((current) => withoutKey(current, order.id))
  }

  const updatedText = snapshot.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(snapshot.updatedAt)
    : null

  return (
    <Shell
      tools={
        <div className="mt-4 flex flex-col gap-3">
          <p data-orders-live={snapshot.kind === 'local' ? 'local' : snapshot.live} className="text-sm font-semibold text-white/90">
            {snapshot.kind === 'local' && (
              <span className="mr-2 inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-extrabold tracking-wide text-gold-300 uppercase ring-1 ring-white/25">
                Modo de demonstração local
              </span>
            )}
            {liveText(snapshot)}
            {updatedText && <span className="text-white/75"> Atualizado às {updatedText}.</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-orders-refresh="" onClick={() => void getOrdersLive().refresh()} className={`${toolButton} text-white ring-white/30 hover:bg-white/10`}>
              <RotateCcw className="size-4" />
              Atualizar agora
            </button>
            <div role="group" aria-label="Som do aviso de pedido novo" className="inline-flex gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/20">
              <button
                type="button"
                data-orders-sound-on=""
                aria-pressed={sound === 'on'}
                onClick={() => soundAlert.setOn(true)}
                className={`${toolButton} min-h-10 ring-0 ${sound === 'on' ? 'bg-gold-400 text-acai-950' : 'text-white hover:bg-white/10'}`}
              >
                {sound === 'blocked' ? '🔔 Ativar som' : '🔔 Som Ativo'}
              </button>
              <button
                type="button"
                data-orders-sound-off=""
                aria-pressed={sound === 'off'}
                onClick={() => soundAlert.setOn(false)}
                className={`${toolButton} min-h-10 ring-0 ${sound === 'off' ? 'bg-white text-acai-800' : 'text-white hover:bg-white/10'}`}
              >
                🔕 Silenciar
              </button>
            </div>
          </div>
          {sound === 'blocked' && (
            <p data-orders-sound-hint="" className="text-sm text-gold-300">
              O navegador só libera o som depois de um toque: toque em "🔔 Ativar som" (ou em qualquer lugar da página) para ouvir o aviso de pedido novo.
            </p>
          )}
        </div>
      }
    >
      {snapshot.status === 'error' && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
          Não foi possível buscar os pedidos agora. A lista abaixo é a última que chegou; o painel tenta de novo sozinho.
        </p>
      )}

      <div role="group" aria-label="Filtrar pedidos" className="mb-5 flex flex-wrap gap-2">
        {ORDER_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-orders-filter={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ring-1 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 ${
              filter === id ? 'bg-acai-800 text-white ring-acai-800' : 'bg-white text-acai-800 ring-line hover:bg-acai-50'
            }`}
          >
            {label}
            <span className={`nums rounded-full px-1.5 text-xs ${filter === id ? 'bg-white/20' : 'bg-acai-100'}`}>{counts[id]}</span>
          </button>
        ))}
      </div>

      {snapshot.status === 'loading' || snapshot.status === 'idle' ? (
        <p className="text-ink-soft">Carregando os pedidos…</p>
      ) : shown.length === 0 ? (
        <p data-orders-empty="" className="rounded-2xl bg-acai-50 p-6 text-center font-semibold text-acai-950 ring-1 ring-line">
          {filter === 'todos' ? 'Nenhum pedido hoje ainda.' : 'Nenhum pedido neste filtro.'}
        </p>
      ) : (
        <div data-orders-list="" className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              busy={Boolean(busy[order.id])}
              error={errors[order.id] ?? null}
              onStatus={(status) => void changeStatus(order, status)}
            />
          ))}
        </div>
      )}
      <p aria-live="polite" className="sr-only" data-orders-announcement="">
        {announcement}
      </p>
    </Shell>
  )
}

function Shell({ children, tools }: { children: ReactNode; tools?: ReactNode }) {
  return (
    <>
      <div className="bg-acai-800 bg-[radial-gradient(ellipse_at_80%_20%,#6a1650_0%,#4a0e36_50%,#3b072a_100%)] text-white">
        <Container className="pt-6 pb-8 sm:pt-8 sm:pb-10">
          <h1 className="flex items-center gap-3 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">
            <ClipboardList className="size-9 text-gold-400" />
            Pedidos
          </h1>
          <p className="mt-2 text-lg text-white/85">Os pedidos de hoje e os que ainda estão em andamento.</p>
          {tools}
        </Container>
      </div>
      <Container className="py-6 sm:py-10">{children}</Container>
    </>
  )
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-orders-notice="" className="mx-auto max-w-xl rounded-3xl bg-acai-50 p-6 text-acai-950 ring-1 ring-line">
      <h2 className="font-display text-xl font-extrabold text-acai-800">{title}</h2>
      <div className="mt-2 leading-relaxed">{children}</div>
    </div>
  )
}
