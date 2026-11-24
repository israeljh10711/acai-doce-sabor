import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Container } from '../components/layout/Container.tsx'
import { ClipboardList, Close, LockOpen, RotateCcw, Search } from '../components/ui/icons.tsx'
import { OrderCard } from '../features/orders/OrderCard.tsx'
import { soundAlert } from '../features/orders/orderAlert.ts'
import { onOrderFocus, scrollToOrderCard } from '../features/orders/orderFocus.ts'
import type { OrdersSnapshot } from '../features/orders/ordersLive.ts'
import {
  DEFAULT_FILTER,
  OPEN_STATUSES,
  ORDER_FILTERS,
  type OrderFilter,
  type OrderStatus,
  type PanelOrder,
  STATUS_LABEL,
  elapsedText,
  filterCounts,
  filterOrders,
  isLate,
  queueOrder,
  searchOrders,
} from '../features/orders/ordersPanel.ts'
import { getOrdersLive, useOrders, useOrdersConnection, useSoundState } from '../features/orders/ordersRuntime.ts'
import { useScreenWakeLock } from '../features/orders/wakeLock.ts'
import { useStoreSettings } from '../features/catalog/catalogStore.ts'
import { serverNow } from '../features/store-hours/serverClock.ts'
import { deliveryWindow } from '../features/store/deliveryTime.ts'
import { useSellerMode } from '../features/seller/sellerModeContext.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'

const withoutId = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => new Set([...set].filter((item) => item !== id))
const withoutKey = <T,>(record: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))

const toolButton =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-sm font-bold ring-1 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orchid-400'

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
            className="btn-primary mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
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
  // A tela do balcão não apaga enquanto o painel está aberto (2026-11-21).
  useScreenWakeLock(true)
  const snapshot = useOrders()
  const sound = useSoundState()
  const settings = useStoreSettings()
  // O painel abre na fila de trabalho (2026-11-21); o vendedor troca quando quiser.
  const [filter, setFilter] = useState<OrderFilter>(DEFAULT_FILTER)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<Record<string, string>>({})
  // Cartões que o vendedor acabou de concluir ou cancelar: ficam na lista atual até o aviso sumir
  // ou até ele trocar de filtro.
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set())
  const [announcement, setAnnouncement] = useState('')
  const flashTimers = useRef(new Map<string, number>())
  // "Há 12 min": o relógio do painel anda a cada 30 s (sem consultar o banco).
  const [clock, setClock] = useState(() => serverNow())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(serverNow()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const timers = flashTimers.current
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  // "Ver pedido" num aviso de itens acrescentados (2026-11-20): mostra o cartão, em qualquer filtro.
  useEffect(
    () =>
      onOrderFocus((code) => {
        setFilter('todos')
        setQuery('')
        setKept(new Set())
        scrollToOrderCard(code)
      }),
    [],
  )

  const counts = filterCounts(snapshot.orders)
  // A fila: do pedido que entrou primeiro para o mais novo; a busca filtra sem mudar a ordem. O
  // cartão que o vendedor acabou de concluir ou cancelar fica alguns segundos na tela (com o aviso e
  // o "↩ Voltar etapa"), mesmo que já não seja do filtro: um toque errado tem volta ali mesmo.
  const inFilter = queueOrder([...filterOrders(snapshot.orders, filter), ...snapshot.orders.filter((order) => kept.has(order.id) && !filterOrders([order], filter).length)])
  const shown = searchOrders(inFilter, query)
  // O único tempo que a loja configura é o de entrega: o alerta de atraso vale para as entregas.
  const lateAfter = deliveryWindow(settings.deliveryTime)?.max ?? null

  const showFlash = (orderId: string, text: string) => {
    setFlash((current) => ({ ...current, [orderId]: text }))
    window.clearTimeout(flashTimers.current.get(orderId))
    flashTimers.current.set(
      orderId,
      window.setTimeout(() => {
        flashTimers.current.delete(orderId)
        setFlash((current) => withoutKey(current, orderId))
        setKept((current) => withoutId(current, orderId))
      }, 8000),
    )
  }

  const changeStatus = async (order: PanelOrder, status: OrderStatus, kind: 'next' | 'back' = 'next') => {
    if (busy[order.id]) return
    setBusy((current) => ({ ...current, [order.id]: true }))
    setErrors((current) => withoutKey(current, order.id))
    const result = await getOrdersLive().setStatus(order, status)
    if (result.ok) {
      setAnnouncement(kind === 'back' ? `Pedido ${order.code}: etapa restaurada (${STATUS_LABEL[status]}).` : `Pedido ${order.code}: ${STATUS_LABEL[status]}.`)
      if (kind === 'back') showFlash(order.id, `↩ Etapa restaurada: ${STATUS_LABEL[status]}`)
      else if (status === 'concluido' || status === 'cancelado') {
        showFlash(order.id, status === 'concluido' ? '✅ Pedido concluído' : '❌ Pedido cancelado')
        setKept((current) => new Set(current).add(order.id))
      }
    } else setErrors((current) => ({ ...current, [order.id]: result.message }))
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
              <span className="mr-2 inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-extrabold tracking-wide text-orchid-300 uppercase ring-1 ring-white/25">
                Modo de demonstração local
              </span>
            )}
            {liveText(snapshot)}
            {updatedText && <span className="text-white/75"> Atualizado às {updatedText} (horário de Brasília).</span>}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-orders-refresh="" onClick={() => void getOrdersLive().refresh()} className={`${toolButton} text-white ring-white/30 hover:bg-white/10`}>
              <RotateCcw className="size-4" />
              Atualizar agora
            </button>
            <div role="group" aria-label="Som dos avisos de pedido novo e de itens acrescentados" className="inline-flex gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/20">
              <button
                type="button"
                data-orders-sound-on=""
                aria-pressed={sound === 'on'}
                onClick={() => soundAlert.setOn(true)}
                className={`${toolButton} min-h-10 ring-0 ${sound === 'on' ? 'bg-orchid-400 text-acai-950' : 'text-white hover:bg-white/10'}`}
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
        </div>
      }
    >
      {snapshot.status === 'error' && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
          Não foi possível buscar os pedidos agora. A lista abaixo é a última que chegou; o painel tenta de novo sozinho.
        </p>
      )}

      {/* Busca rápida (2026-11-21): na lista que já está na tela, sem consultar o banco. */}
      <div className="mb-4 flex items-center rounded-xl bg-white ring-1 ring-line focus-within:ring-2 focus-within:ring-acai-700">
        <Search className="ml-3 size-5 shrink-0 text-ink-soft" />
        <label htmlFor="busca-pedidos" className="sr-only">
          Buscar pedido por código ou nome do cliente
        </label>
        <input
          id="busca-pedidos"
          data-orders-search=""
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Buscar pedido por código ou nome do cliente..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setQuery('')
          }}
          className="min-h-12 w-full min-w-0 bg-transparent px-3 text-base text-acai-950 outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            data-orders-search-clear=""
            aria-label="Limpar a busca"
            onClick={() => setQuery('')}
            className="mr-1 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-acai-800 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <Close className="size-4" />
          </button>
        )}
      </div>

      <div role="group" aria-label="Filtrar pedidos" className="mb-5 flex flex-wrap gap-2">
        {ORDER_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-orders-filter={id}
            aria-pressed={filter === id}
            onClick={() => {
              setFilter(id)
              setKept(new Set())
            }}
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
        <div data-orders-empty="" className="rounded-2xl bg-acai-50 p-6 text-center font-semibold text-acai-950 ring-1 ring-line">
          {query.trim() ? (
            <>
              <p>
                Nenhum pedido encontrado para “{query.trim()}”{filter === 'todos' ? '' : ' neste filtro'}.
              </p>
              <button
                type="button"
                data-orders-search-reset=""
                onClick={() => setQuery('')}
                className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-white px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                Limpar busca
              </button>
            </>
          ) : filter === 'todos' ? (
            'Nenhum pedido hoje ainda.'
          ) : filter === 'andamento' ? (
            'Nenhum pedido em andamento agora.'
          ) : (
            'Nenhum pedido neste filtro.'
          )}
        </div>
      ) : (
        <div data-orders-list="" className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={clock}
              busy={Boolean(busy[order.id])}
              error={errors[order.id] ?? null}
              onStatus={(status) => void changeStatus(order, status)}
              onBack={(status) => void changeStatus(order, status, 'back')}
              elapsed={OPEN_STATUSES.includes(order.status) ? elapsedText(order.createdAt, clock) : null}
              late={isLate(order, clock, lateAfter)}
              flash={flash[order.id] ?? null}
              added={order.id in snapshot.highlighted}
              onSeen={() => getOrdersLive().markSeen(order.id)}
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
      <div className="bg-brand text-white">
        <Container className="pt-6 pb-8 sm:pt-8 sm:pb-10">
          <h1 className="flex items-center gap-3 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">
            <ClipboardList className="size-9 text-orchid-400" />
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
