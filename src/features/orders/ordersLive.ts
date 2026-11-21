/**
 * A loja de pedidos do painel ao vivo (2026-11-20): carrega os pedidos, junta as mudanças que
 * chegam na hora (Realtime no Supabase, abas no modo local), decide quando tocar o aviso e muda a
 * situação. A faixa do vendedor (contador e avisos) e a página "Pedidos" leem daqui.
 *
 * Regras do aviso de pedido novo: nunca para os pedidos da carga inicial, nunca para `UPDATE`, nunca
 * duas vezes para o mesmo `id`. Pedido "novo" que aparece depois da carga (pelo Realtime ou pela
 * consulta de reserva, quando a conexão cai) toca uma vez.
 *
 * Aviso de itens acrescentados (2026-11-20): cada lote em `additions` tem um id único gravado pelo
 * servidor (`attempt_key`), e só a função do banco escreve nessa coluna, depois de conferir a sessão
 * do cliente (o vendedor só muda `status`). Por isso um lote com id nunca visto, num pedido que o
 * painel já conhecia, é sempre um acréscimo real e confirmado do cliente: toca o "ding-dong", destaca
 * o cartão e mostra o aviso, uma vez por lote. Mudança de situação, cancelamento, evento repetido,
 * coluna que não veio (TOAST) e a carga inicial não trazem lote novo: nada toca. O contador de
 * pedidos novos não muda (ele conta a situação "novo", que o acréscimo não altera).
 *
 * A escuta começa ANTES da carga: o que chega enquanto ela anda fica guardado e é juntado depois,
 * sem repetir o que a carga já trouxe. Parar remove a inscrição e apaga da memória os pedidos, os
 * lotes vistos, os destaques e os avisos.
 *
 * Num UPDATE, o Realtime do Supabase não repete as colunas grandes que não mudaram (guardadas à
 * parte pelo Postgres, TOAST): no ADS-0003 de teste (2026-11-20), a mudança de situação chegou sem
 * a comanda (`message`). Por isso o UPDATE é juntado à última linha conhecida do pedido: o que
 * não veio fica como estava.
 */
import { OPEN_STATUSES, type OrderStatus, type PanelOrder, parseOrderRow, storeDayStart } from './ordersPanel.ts'
import type { LiveState, OrderChange, OrdersSource } from './ordersSource.ts'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Um aviso de itens acrescentados (o balão que aparece em qualquer página do Modo Vendedor). */
export type AddedNotice = { id: string; orderId: string; code: string; batches: number; at: number }

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
  /** Pedidos com itens acrescentados ainda não vistos pelo vendedor: id do pedido → quando chegou. */
  highlighted: Readonly<Record<string, number>>
  /** Avisos de itens acrescentados, os mais antigos primeiro. */
  notices: readonly AddedNotice[]
}

export type OrdersLive = {
  start(): void
  stop(): void
  refresh(): Promise<void>
  setStatus(order: PanelOrder, status: OrderStatus): Promise<{ ok: true } | { ok: false; message: string }>
  /** O vendedor viu os itens acrescentados do pedido: some o destaque e os avisos dele. */
  markSeen(orderId: string): void
  /** Fecha um aviso (pelo ✕ ou porque o tempo dele acabou). */
  dismissNotice(id: string): void
  getSnapshot(): OrdersSnapshot
  subscribe(listener: () => void): () => void
}

type Timers = {
  setInterval(callback: () => void, ms: number): number
  clearInterval(id: number): void
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(id: number): void
}

/** Consulta de reserva: espaçada com a conexão ao vivo, mais frequente quando ela cai. */
export const POLL_LIVE_MS = 60_000
export const POLL_OFFLINE_MS = 15_000
/** Quanto tempo o cartão fica destacado se o vendedor não tocar em "Visto" nem mexer no pedido. */
export const HIGHLIGHT_MS = 10 * 60_000
/** Quantos avisos ficam empilhados (os mais antigos saem). */
export const MAX_NOTICES = 4

const browserTimers: Timers = {
  setInterval: (callback, ms) => window.setInterval(callback, ms),
  clearInterval: (id) => window.clearInterval(id),
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (id) => window.clearTimeout(id),
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
  alert: { play(): boolean; playAdded(): boolean }
  timers?: Timers
  visible?: () => boolean
  now?: () => number
}): OrdersLive {
  let users = 0
  let generation = 0
  let orders = new Map<string, PanelOrder>()
  /** A última linha inteira de cada pedido (para juntar os UPDATE que chegam sem algumas colunas). */
  let rows = new Map<string, Record<string, unknown>>()
  /** Os lotes acrescentados que o painel já conhece ("id do pedido|id do lote"). */
  let seenBatches = new Set<string>()
  let highlighted: Record<string, number> = {}
  let notices: AddedNotice[] = []
  let noticeSeq = 0
  const highlightTimers = new Map<string, number>()
  let initialized = false
  let buffer: OrderChange[] = []
  let stopListening: (() => void) | null = null
  let timer: number | null = null
  let timerMs = 0
  let loading = false
  let snapshot: OrdersSnapshot = { kind: source.kind, orders: [], status: 'idle', live: 'off', updatedAt: null, newCount: 0, highlighted: {}, notices: [] }
  const listeners = new Set<() => void>()

  const emit = (patch: Partial<OrdersSnapshot> = {}) => {
    const list = [...orders.values()].sort(byNewest)
    snapshot = { ...snapshot, ...patch, orders: list, newCount: list.filter((order) => order.status === 'novo').length, highlighted, notices }
    for (const listener of listeners) listener()
  }

  /** Marca os lotes do pedido como conhecidos e diz quantos eram novos. */
  const markBatches = (order: PanelOrder): number => {
    let fresh = 0
    for (const addition of order.additions) {
      const id = `${order.id}|${addition.key}`
      if (seenBatches.has(id)) continue
      seenBatches.add(id)
      fresh++
    }
    return fresh
  }

  const clearHighlight = (orderId: string) => {
    const pending = highlightTimers.get(orderId)
    if (pending !== undefined) timers.clearTimeout(pending)
    highlightTimers.delete(orderId)
    if (!(orderId in highlighted)) return false
    const rest = { ...highlighted }
    delete rest[orderId]
    highlighted = rest
    return true
  }

  /** Itens acrescentados pelo cliente num pedido que o painel já conhecia: som, destaque e aviso. */
  const addedItems = (order: PanelOrder, batches: number) => {
    alert.playAdded()
    clearHighlight(order.id)
    highlighted = { ...highlighted, [order.id]: now() }
    highlightTimers.set(
      order.id,
      timers.setTimeout(() => {
        highlightTimers.delete(order.id)
        if (clearHighlight(order.id)) emit()
      }, HIGHLIGHT_MS),
    )
    noticeSeq++
    notices = [...notices, { id: `${order.id}#${noticeSeq}`, orderId: order.id, code: order.code, batches, at: now() }].slice(-MAX_NOTICES)
  }

  /**
   * Junta uma mudança. Só `INSERT` de um id nunca visto, na situação "novo", toca o aviso de pedido
   * novo; só lote acrescentado nunca visto, num pedido já conhecido, toca o de itens acrescentados.
   */
  const apply = (change: OrderChange): boolean => {
    const incoming = isRecord(change.row) ? change.row : null
    const previous = change.type === 'UPDATE' && incoming && typeof incoming.id === 'string' ? rows.get(incoming.id) : undefined
    const row = previous && incoming ? { ...previous, ...incoming } : change.row
    const order = parseOrderRow(row)
    if (!order) return false
    const known = orders.has(order.id)
    orders.set(order.id, order)
    if (isRecord(row)) rows.set(order.id, row)
    const fresh = markBatches(order)
    if (change.type === 'INSERT' && !known && order.status === 'novo') alert.play()
    else if (known && fresh > 0) addedItems(order, fresh)
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

  /** Esquece tudo (ao ligar de novo e ao sair do Modo Vendedor). */
  const reset = () => {
    for (const pending of highlightTimers.values()) timers.clearTimeout(pending)
    highlightTimers.clear()
    orders = new Map()
    rows = new Map()
    seenBatches = new Set()
    highlighted = {}
    notices = []
    initialized = false
    buffer = []
    loading = false
  }

  const live: OrdersLive = {
    start() {
      users++
      if (users > 1) return
      generation++
      reset()
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
      reset()
      emit({ status: 'idle', live: 'off', updatedAt: null })
    },

    async refresh() {
      if (users === 0 || loading) return
      loading = true
      const run = generation
      try {
        const fetched = await source.load()
        if (run !== generation) return
        const loaded = new Map<string, PanelOrder>()
        const loadedRows = new Map<string, Record<string, unknown>>()
        for (const raw of fetched) {
          const order = parseOrderRow(raw)
          if (!order) continue
          loaded.set(order.id, order)
          if (isRecord(raw)) loadedRows.set(order.id, raw)
        }
        if (!initialized) {
          initialized = true
          orders = loaded
          rows = loadedRows
          // A carga inicial: os lotes que já existiam são conhecidos, sem aviso.
          for (const order of loaded.values()) markBatches(order)
          const pending = buffer
          buffer = []
          for (const change of pending) apply(change)
        } else {
          for (const [id, order] of loaded) {
            const fresh = markBatches(order)
            if (!orders.has(id)) {
              // Consulta de reserva: o que ainda não estava aqui e está "novo" chegou agora.
              if (order.status === 'novo') alert.play()
            } else if (fresh > 0) addedItems(order, fresh)
          }
          // Fica o que a consulta trouxe, mais o que chegou depois dela e ainda vale para o painel.
          const dayStart = storeDayStart(now())
          for (const [id, order] of orders) {
            if (!loaded.has(id) && (order.createdAt >= dayStart || OPEN_STATUSES.includes(order.status))) {
              loaded.set(id, order)
              const kept = rows.get(id)
              if (kept) loadedRows.set(id, kept)
            }
          }
          orders = loaded
          rows = loadedRows
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
          const known = orders.has(updated.id)
          orders.set(updated.id, updated)
          if (isRecord(raw)) rows.set(updated.id, raw)
          // A linha que voltou pode trazer um lote que o Realtime ainda não entregou: avisa igual.
          const fresh = markBatches(updated)
          if (known && fresh > 0) addedItems(updated, fresh)
          // O vendedor mexeu no pedido: viu o que foi acrescentado antes.
          else clearHighlight(updated.id)
          emit()
        }
        return { ok: true }
      } catch {
        return { ok: false, message: 'Não foi possível mudar a situação. Confira a internet e tente de novo.' }
      }
    },

    markSeen(orderId) {
      const changed = clearHighlight(orderId)
      const before = notices.length
      notices = notices.filter((notice) => notice.orderId !== orderId)
      if (changed || notices.length !== before) emit()
    },

    dismissNotice(id) {
      const before = notices.length
      notices = notices.filter((notice) => notice.id !== id)
      if (notices.length !== before) emit()
    },

    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return live
}
