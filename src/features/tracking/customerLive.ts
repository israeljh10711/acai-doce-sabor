/**
 * O acompanhamento ao vivo do cliente (pedido 100% no site, 2026-11-20): uma escuta por aba para os
 * pedidos deste aparelho, usada pela faixa "📦 Acompanhar pedido" e pela tela de acompanhamento.
 *
 * O Realtime só avisa que algo mudou (no Supabase: um evento em `order_events`, que o RLS entrega
 * só ao dono); o estado oficial vem sempre da consulta à função (`api.lookup`). Sem a conexão ao
 * vivo, consulta sozinho a cada 20 s; ao reconectar e ao voltar para a aba, confere de novo.
 * Consultas do mesmo pedido não se sobrepõem (avisos repetidos viram uma consulta a mais, no máximo).
 */
import type { OrderView } from './orderView.ts'
import type { TrackedStore } from './trackedOrders.ts'
import type { TrackingApi } from './trackingApi.ts'

export type CustomerLiveState = 'off' | 'connecting' | 'live' | 'offline'

export type CustomerLiveSnapshot = {
  views: Readonly<Record<string, OrderView>>
  /** O motivo da última consulta que falhou, por pedido (`falha`, `nao-encontrado`, `expirado`...). */
  errors: Readonly<Record<string, string>>
  live: CustomerLiveState
}

/** A escuta por fora: chama `onChange` com o id do pedido que mudou (ou `null`: confira todos). */
export type CustomerListen = (onChange: (orderId: string | null) => void, onState: (state: Exclude<CustomerLiveState, 'off'>) => void) => () => void

type Timers = { setInterval(callback: () => void, ms: number): number; clearInterval(id: number): void }

export const CUSTOMER_POLL_OFFLINE_MS = 20_000
export const CUSTOMER_POLL_LIVE_MS = 60_000

export type CustomerLive = ReturnType<typeof createCustomerLive>

export function createCustomerLive({
  api,
  tracked,
  listen,
  timers,
  visible = () => true,
}: {
  api: TrackingApi
  tracked: Pick<TrackedStore, 'active' | 'setStatus'>
  listen: CustomerListen
  timers: Timers
  visible?: () => boolean
}) {
  let users = 0
  let stopListening: (() => void) | null = null
  let timer: number | null = null
  let timerMs = 0
  let snapshot: CustomerLiveSnapshot = { views: {}, errors: {}, live: 'off' }
  const watched = new Map<string, number>()
  const running = new Map<string, Promise<void>>()
  const again = new Set<string>()
  const listeners = new Set<() => void>()

  const emit = (patch: Partial<CustomerLiveSnapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  const schedule = (ms: number) => {
    if (timer !== null && timerMs === ms) return
    if (timer !== null) timers.clearInterval(timer)
    timerMs = ms
    timer = timers.setInterval(() => {
      if (visible()) void live.refreshAll()
    }, ms)
  }

  const fetchOne = async (id: string) => {
    const result = await api.lookup(id)
    if (result.ok) {
      const errors = { ...snapshot.errors }
      delete errors[id]
      emit({ views: { ...snapshot.views, [id]: result.order }, errors })
      tracked.setStatus(id, result.order.status)
    } else {
      emit({ errors: { ...snapshot.errors, [id]: result.reason } })
    }
  }

  const connect = () => {
    let current = true
    const stopThis = listen(
      (orderId) => {
        if (current) void (orderId ? live.refresh(orderId) : live.refreshAll())
      },
      (state) => {
        if (!current || users === 0) return
        const before = snapshot.live
        schedule(state === 'live' ? CUSTOMER_POLL_LIVE_MS : CUSTOMER_POLL_OFFLINE_MS)
        emit({ live: state })
        // Voltou a conexão: o que mudou enquanto ela estava caída chega pela consulta.
        if (state === 'live' && before === 'offline') void live.refreshAll()
      },
    )
    stopListening = () => {
      current = false
      stopThis()
    }
  }

  const ids = () => new Set([...tracked.active().filter((order) => order.tracked || order.demo).map((order) => order.id), ...watched.keys()])

  const live = {
    /** Liga a escuta (a faixa e a tela usam juntas; desliga quando as duas largam). */
    start() {
      users++
      if (users > 1) return
      emit({ live: 'connecting' })
      schedule(CUSTOMER_POLL_OFFLINE_MS)
      connect()
      void live.refreshAll()
    },
    /** A sessão do cliente mudou (o primeiro pedido criou a sessão): escuta de novo, já com ela. */
    restart() {
      if (users === 0) return
      stopListening?.()
      emit({ live: 'connecting' })
      connect()
      void live.refreshAll()
    },
    stop() {
      if (users === 0) return
      users--
      if (users > 0) return
      stopListening?.()
      stopListening = null
      if (timer !== null) timers.clearInterval(timer)
      timer = null
      emit({ live: 'off' })
    },
    /** A tela de um pedido pede que ele seja conferido (mesmo encerrado). */
    watch(id: string) {
      watched.set(id, (watched.get(id) ?? 0) + 1)
      // Já ligada: confere agora (desligada, a consulta sai junto com as outras ao ligar).
      if (users > 0) void live.refresh(id)
      return () => {
        const count = (watched.get(id) ?? 1) - 1
        if (count <= 0) watched.delete(id)
        else watched.set(id, count)
      }
    },
    /** Consulta um pedido; se já houver uma consulta dele andando, faz mais uma depois dela. */
    refresh(id: string): Promise<void> {
      const current = running.get(id)
      if (current) {
        again.add(id)
        return current
      }
      const run = (async () => {
        try {
          await fetchOne(id)
          while (again.delete(id)) await fetchOne(id)
        } finally {
          running.delete(id)
        }
      })()
      running.set(id, run)
      return run
    },
    async refreshAll() {
      await Promise.all([...ids()].map((id) => live.refresh(id)))
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return live
}
