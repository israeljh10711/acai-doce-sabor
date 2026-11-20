/**
 * A loja de pedidos do painel ao vivo (2026-11-20): carrega os pedidos, junta as mudanças que
 * chegam na hora (Realtime no Supabase, abas no modo local), decide quando tocar o aviso e muda a
 * situação. A faixa do vendedor (contador) e a página "Pedidos" leem daqui.
 *
 * Regras do aviso sonoro: nunca para os pedidos da carga inicial, nunca para `UPDATE`, nunca duas
 * vezes para o mesmo `id`. Pedido "novo" que aparece depois da carga (pelo Realtime ou pela
 * consulta de reserva, quando a conexão cai) toca uma vez.
 *
 * A escuta começa ANTES da carga: o que chega enquanto ela anda fica guardado e é juntado depois,
 * sem repetir o que a carga já trouxe. Parar remove a inscrição e apaga os pedidos da memória.
 */
import { OPEN_STATUSES, type OrderStatus, type PanelOrder, parseOrderRow, storeDayStart } from './ordersPanel.ts'
import type { LiveState, OrderChange, OrdersSource } from './ordersSource.ts'

export type OrdersSnapshot = {
  kind: OrdersSource['kind']
  /** Os mais novos primeiro. */
  orders: PanelOrder[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** `off`: parada (vendedor fora do Modo Vendedor). */
  live: LiveState | 'off'
  updatedAt: number | null
  /** Pedidos na situação "novo" (o selo vermelho da faixa). */
  newCount: number
}

export type OrdersLive = {
  start(): void
  stop(): void
  refresh(): Promise<void>
  setStatus(order: PanelOrder, status: OrderStatus): Promise<{ ok: true } | { ok: false; message: string }>
  getSnapshot(): OrdersSnapshot
  subscribe(listener: () => void): () => void
}

type Timers = { setInterval(callback: () => void, ms: number): number; clearInterval(id: number): void }

/** Consulta de reserva: espaçada com a conexão ao vivo, mais frequente quando ela cai. */
export const POLL_LIVE_MS = 60_000
export const POLL_OFFLINE_MS = 15_000

const browserTimers: Timers = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (id) => window.clearInterval(id),
}

const byNewest = (a: PanelOrder, b: PanelOrder) => b.createdAt - a.createdAt || b.number - a.number

export function createOrdersLive({
  source,
  alert,
  timers = browserTimers,
  visible = () => true,
  now = () => Date.now(),
}: {
  source: OrdersSource
  alert: { play(): boolean }
  timers?: Timers
  visible?: () => boolean
  now?: () => number
}): OrdersLive {
  let users = 0
  let generation = 0
  let orders = new Map<string, PanelOrder>()
  let initialized = false
  let buffer: OrderChange[] = []
  let stopListening: (() => void) | null = null
  let timer: number | null = null
  let timerMs = 0
  let loading = false
  let snapshot: OrdersSnapshot = { kind: source.kind, orders: [], status: 'idle', live: 'off', updatedAt: null, newCount: 0 }
  const listeners = new Set<() => void>()

  const emit = (patch: Partial<OrdersSnapshot> = {}) => {
    const list = [...orders.values()].sort(byNewest)
    snapshot = { ...snapshot, ...patch, orders: list, newCount: list.filter((order) => order.status === 'novo').length }
    for (const listener of listeners) listener()
  }

  /** Junta uma mudança. Só `INSERT` de um id nunca visto, na situação "novo", toca o aviso. */
  const apply = (change: OrderChange): boolean => {
    const order = parseOrderRow(change.row)
    if (!order) return false
    const known = orders.has(order.id)
    orders.set(order.id, order)
    if (change.type === 'INSERT' && !known && order.status === 'novo') alert.play()
    return true
  }

  const onChange = (change: OrderChange) => {
    if (users === 0) return
    if (!initialized) {
      buffer.push(change)
      return
    }
    if (apply(change)) emit()
  }

  const schedule = (ms: number) => {
    if (timer !== null && timerMs === ms) return
    if (timer !== null) timers.clearInterval(timer)
    timerMs = ms
    timer = timers.setInterval(() => {
      if (visible()) void live.refresh()
    }, ms)
  }

  const onState = (state: LiveState) => {
    if (users === 0) return
    schedule(state === 'live' ? POLL_LIVE_MS : POLL_OFFLINE_MS)
    emit({ live: state })
  }

  const live: OrdersLive = {
    start() {
      users++
      if (users > 1) return
      generation++
      orders = new Map()
      initialized = false
      buffer = []
      loading = false
      emit({ status: 'loading', live: 'connecting', updatedAt: null })
      schedule(POLL_OFFLINE_MS)
      // Escuta primeiro: o que chegar durante a carga não se perde.
      stopListening = source.listen(onChange, onState)
      void live.refresh()
    },

    stop() {
      if (users === 0) return
      users--
      if (users > 0) return
      generation++
      stopListening?.()
      stopListening = null
      if (timer !== null) timers.clearInterval(timer)
      timer = null
      orders = new Map()
      initialized = false
      buffer = []
      loading = false
      emit({ status: 'idle', live: 'off', updatedAt: null })
    },

    async refresh() {
      if (users === 0 || loading) return
      loading = true
      const run = generation
      try {
        const rows = await source.load()
        if (run !== generation) return
        const loaded = new Map<string, PanelOrder>()
        for (const raw of rows) {
          const order = parseOrderRow(raw)
          if (order) loaded.set(order.id, order)
        }
        if (!initialized) {
          initialized = true
          orders = loaded
          const pending = buffer
          buffer = []
          for (const change of pending) apply(change)
        } else {
          // Consulta de reserva: o que ainda não estava aqui e está "novo" chegou agora.
          for (const [id, order] of loaded) if (!orders.has(id) && order.status === 'novo') alert.play()
          // Fica o que a consulta trouxe, mais o que chegou depois dela e ainda vale para o painel.
          const dayStart = storeDayStart(now())
          for (const [id, order] of orders) {
            if (!loaded.has(id) && (order.createdAt >= dayStart || OPEN_STATUSES.includes(order.status))) loaded.set(id, order)
          }
          orders = loaded
        }
        emit({ status: 'ready', updatedAt: now() })
      } catch {
        if (run === generation) emit({ status: 'error' })
      } finally {
        if (run === generation) loading = false
      }
    },

    async setStatus(order, status) {
      try {
        const raw = await source.setStatus(order.id, status)
        const updated = raw === null ? null : parseOrderRow(raw)
        if (!updated) return { ok: false, message: 'O pedido não foi encontrado. Atualize a lista.' }
        if (users > 0) {
          orders.set(updated.id, updated)
          emit()
        }
        return { ok: true }
      } catch {
        return { ok: false, message: 'Não foi possível mudar a situação. Confira a internet e tente de novo.' }
      }
    },

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return live
}
