import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { Container } from '../components/layout/Container.tsx'
import { Bell, ClipboardList, LockOpen, RotateCcw } from '../components/ui/icons.tsx'
import { OrderCard } from '../features/orders/OrderCard.tsx'
import { loadSoundOn, playNewOrderSound, saveSoundOn, soundReady, unlockSound } from '../features/orders/orderAlert.ts'
import { ORDER_FILTERS, type OrderFilter, type OrderStatus, type PanelOrder, STATUS_LABEL, filterCounts, filterOrders, parseOrderRow } from '../features/orders/ordersPanel.ts'
import { ORDERS_REFRESH_MS, useOrdersFeed } from '../features/orders/useOrdersFeed.ts'
import { getSupabaseRest } from '../features/seller/sellerBackend.ts'
import { useSellerMode } from '../features/seller/sellerModeContext.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import type { SupabaseRest } from '../services/supabaseRest.ts'

const MODALITY_WORD: Record<string, string> = { entrega: 'Entrega', retirada: 'Retirar', local: 'Comer no Local' }

const withoutKey = <T,>(record: Record<string, T>, key: string): Record<string, T> => Object.fromEntries(Object.entries(record).filter(([name]) => name !== key))

const toolButton =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-sm font-bold ring-1 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold-400 disabled:cursor-wait disabled:opacity-60'

/**
 * Painel de pedidos do Modo Vendedor (pedido de 2026-11-20, etapa 2, opção B), para deixar aberto
 * no balcão: os pedidos do dia e os ainda em andamento, com o selo da modalidade, o GPS da
 * entrega, os itens e o pagamento; atualiza sozinho, filtra por situação, toca um aviso quando
 * chega pedido novo e avança a situação de cada pedido.
 *
 * Só com o Supabase ligado (sem ele, os pedidos não ficam guardados) e só para o vendedor logado.
 */
export function OrdersPage() {
  const seller = useSellerMode()
  const rest = getSupabaseRest()
  const [newCount, setNewCount] = useState(0)
  usePageTitle(newCount > 0 ? `(${newCount}) Pedidos` : 'Pedidos', { noindex: true })

  if (!rest) {
    return (
      <Shell>
        <Notice title="Os pedidos ficam guardados só com o Supabase ligado">
          Sem o Supabase, cada pedido vai direto para o WhatsApp da loja e não fica registrado em lugar nenhum. O passo a passo para ligar está em
          docs/supabase.md.
        </Notice>
      </Shell>
    )
  }
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
  return <Board rest={rest} onNewCount={setNewCount} />
}

function Board({ rest, onNewCount }: { rest: SupabaseRest; onNewCount: (count: number) => void }) {
  const [filter, setFilter] = useState<OrderFilter>('andamento')
  const [soundOn, setSoundOn] = useState(loadSoundOn)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onNew = useCallback(
    (arrived: PanelOrder[]) => {
      const names = arrived.map((order) => `${order.code}${order.deliveryType ? ` (${MODALITY_WORD[order.deliveryType]})` : ''}`).join(', ')
      setAnnouncement(`${arrived.length === 1 ? 'Novo pedido' : 'Novos pedidos'}: ${names}.`)
      if (soundOn && !playNewOrderSound()) setSoundBlocked(true)
    },
    [soundOn],
  )
  const feed = useOrdersFeed(rest, onNew)
  const counts = filterCounts(feed.orders)
  const shown = filterOrders(feed.orders, filter)
  // "Hoje" para os cartões: o dia da última busca (os cartões só aparecem depois dela).
  const now = feed.updatedAt ?? 0

  // O título da aba mostra quantos pedidos estão como "novo".
  useEffect(() => onNewCount(counts.novo), [counts.novo, onNewCount])
  useEffect(() => () => onNewCount(0), [onNewCount])

  // O navegador só libera o som depois de um toque: o primeiro toque na página libera.
  useEffect(() => {
    const unlock = () => {
      unlockSound()
      window.setTimeout(() => setSoundBlocked(!soundReady()), 300)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    saveSoundOn(next)
    if (next) {
      unlockSound()
      playNewOrderSound()
    }
  }

  const changeStatus = async (order: PanelOrder, status: OrderStatus) => {
    if (busy[order.id]) return
    setBusy((current) => ({ ...current, [order.id]: true }))
    setErrors((current) => withoutKey(current, order.id))
    try {
      const row = await rest.setOrderStatus(order.id, status)
      const updated = row === null ? null : parseOrderRow(row)
      if (!updated) {
        setErrors((current) => ({ ...current, [order.id]: 'O pedido não foi encontrado. Atualize a lista.' }))
        return
      }
      feed.replace(updated)
      setAnnouncement(`Pedido ${updated.code}: ${STATUS_LABEL[updated.status]}.`)
    } catch {
      setErrors((current) => ({ ...current, [order.id]: 'Não foi possível mudar a situação. Confira a internet e tente de novo.' }))
    } finally {
      setBusy((current) => withoutKey(current, order.id))
    }
  }

  const updatedText = feed.updatedAt
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(feed.updatedAt)
    : null

  return (
    <Shell
      tools={
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-orders-refresh=""
            onClick={() => void feed.refresh()}
            className={`${toolButton} text-white ring-white/30 hover:bg-white/10`}
          >
            <RotateCcw className="size-4" />
            Atualizar agora
          </button>
          <button
            type="button"
            data-orders-sound={soundOn ? 'ligado' : 'desligado'}
            aria-pressed={soundOn}
            onClick={toggleSound}
            className={`${toolButton} ${soundOn ? 'bg-gold-400 text-acai-950 ring-gold-400' : 'text-white ring-white/30 hover:bg-white/10'}`}
          >
            <Bell className="size-4" />
            {soundOn ? 'Som do aviso: ligado' : 'Som do aviso: desligado'}
          </button>
          <p className="text-sm text-white/85" data-orders-updated="">
            {updatedText ? `Atualizado às ${updatedText}.` : 'Carregando…'} Atualiza sozinho a cada {ORDERS_REFRESH_MS / 1000} segundos.
          </p>
        </div>
      }
    >
      {soundOn && soundBlocked && (
        <p className="mb-4 rounded-xl bg-gold-100 px-3 py-2.5 text-sm font-semibold text-acai-950 ring-1 ring-gold-400">
          O navegador ainda não liberou o som: toque em qualquer lugar da página para ouvir o aviso de pedido novo.
        </p>
      )}
      {feed.status === 'error' && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
          Não foi possível buscar os pedidos agora. A lista abaixo é a última que chegou; o painel tenta de novo sozinho.
        </p>
      )}

      <div role="group" aria-label="Filtrar por situação" className="mb-5 flex flex-wrap gap-2">
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

      {feed.status === 'loading' ? (
        <p className="text-ink-soft">Carregando os pedidos…</p>
      ) : shown.length === 0 ? (
        <p data-orders-empty="" className="rounded-2xl bg-acai-50 p-6 text-center font-semibold text-acai-950 ring-1 ring-line">
          {filter === 'andamento' ? 'Nenhum pedido em andamento agora.' : 'Nenhum pedido nesta situação.'}
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
