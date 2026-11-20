/**
 * Modo de demonstração local do painel de pedidos (painel ao vivo, 2026-11-20): sem o Supabase
 * configurado, o pedido enviado pelo carrinho também fica guardado no `localStorage` DESTE
 * navegador, com a mesma estrutura da tabela `orders` e o código `DEMO-0001`, e o painel do
 * vendedor o mostra.
 *
 * Só serve para testar o fluxo no mesmo navegador: nada vai para o Supabase, e os pedidos de
 * demonstração nunca são migrados para lá. As outras abas do mesmo navegador são avisadas pelo
 * `BroadcastChannel` (e pelo evento `storage`, quando não houver). O mesmo pedido mandado de novo
 * (toque duplo) não vira outro.
 */
import { serializeCart } from '../cart/cart.ts'
import { getStoreSettings } from '../catalog/catalogState.ts'
import { toWhatsAppNumber } from '../../utils/whatsapp.ts'
import { type OrderDraft, buildOrderMessage } from './orderMessage.ts'
import { type OrderRow, orderRowFields } from './orderRow.ts'
import { OPEN_STATUSES, type OrderStatus, ordersSince } from './ordersPanel.ts'
import type { OrderChange, OrdersSource } from './ordersSource.ts'

export const DEMO_KEY = 'acai_doce_sabor_pedidos_demo_v1'
export const DEMO_CHANNEL = 'acai-doce-sabor-pedidos-demo'
/** Quantos pedidos de demonstração ficam guardados (os mais antigos saem). */
export const MAX_DEMO_ORDERS = 200

export type DemoRow = OrderRow & { id: string; created_at: string; status: OrderStatus }
type DemoData = { seq: number; orders: DemoRow[] }

/** Um canal com o nome do modo de demonstração (o `BroadcastChannel` do navegador). */
export type DemoChannel = { postMessage(message: unknown): void; onMessage(listener: () => void): void; close(): void }

export type LocalDeps = {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  now(): number
  randomId(): string
  /** Sem `BroadcastChannel`, `null`. */
  openChannel(): DemoChannel | null
  /** O evento `storage` (outras abas mudaram o `localStorage`). */
  onStorage(listener: (key: string | null) => void): () => void
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Os pedidos de demonstração guardados (o que não dá para ler vira vazio). */
export function readDemo(storage: LocalDeps['storage']): DemoData {
  try {
    const data: unknown = JSON.parse(storage.getItem(DEMO_KEY) ?? 'null')
    if (!isRecord(data) || !Array.isArray(data.orders)) return { seq: 0, orders: [] }
    const orders = data.orders.filter((row): row is DemoRow => isRecord(row) && typeof row.id === 'string' && typeof row.code === 'string')
    return { seq: typeof data.seq === 'number' && Number.isSafeInteger(data.seq) ? data.seq : orders.length, orders }
  } catch {
    return { seq: 0, orders: [] }
  }
}

function writeDemo(deps: LocalDeps, data: DemoData): boolean {
  try {
    deps.storage.setItem(DEMO_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/** Avisa as outras abas e os outros ouvintes desta aba. */
function announce(deps: LocalDeps, message: unknown) {
  const channel = deps.openChannel()
  if (!channel) return
  channel.postMessage(message)
  channel.close()
}

/** Resumo curto e estável do pedido (FNV-1a), para não guardar o mesmo pedido duas vezes. */
function attemptKey(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `demo-${hash.toString(16).padStart(8, '0')}-${text.length}`
}

/**
 * Guarda o pedido enviado pelo carrinho no modo local. O mesmo pedido de novo devolve o que já
 * estava guardado (`created: false`). Sem armazenamento, `null` (o WhatsApp abre do mesmo jeito).
 */
export function saveDemoOrder(draft: OrderDraft, deps: LocalDeps): { code: string; created: boolean } | null {
  const { cart, customer, payment, antecipado } = draft
  const key = attemptKey(JSON.stringify([serializeCart(cart), customer, payment, antecipado]))
  const data = readDemo(deps.storage)
  const existing = data.orders.find((row) => row.attempt_key === key)
  if (existing) return { code: existing.code, created: false }

  const number = data.seq + 1
  const row: DemoRow = {
    ...orderRowFields({
      cart,
      customer,
      payment,
      antecipado,
      message: buildOrderMessage(draft),
      whatsapp: toWhatsAppNumber(getStoreSettings().contact.whatsapp),
    }),
    id: deps.randomId(),
    number,
    code: `DEMO-${String(number).padStart(4, '0')}`,
    attempt_key: key,
    created_at: new Date(deps.now()).toISOString(),
    status: 'novo',
  }
  const orders = [...data.orders, row].slice(-MAX_DEMO_ORDERS)
  if (!writeDemo(deps, { seq: number, orders })) return null
  announce(deps, { type: 'INSERT', id: row.id })
  return { code: row.code, created: true }
}

export function createLocalOrdersSource(deps: LocalDeps): OrdersSource {
  return {
    kind: 'local',
    async load() {
      const since = ordersSince(deps.now())
      return readDemo(deps.storage).orders.filter((row) => row.created_at >= since || OPEN_STATUSES.includes(row.status))
    },
    async setStatus(id, status) {
      const data = readDemo(deps.storage)
      const row = data.orders.find((candidate) => candidate.id === id)
      if (!row) return null
      const updated: DemoRow = { ...row, status }
      if (!writeDemo(deps, { ...data, orders: data.orders.map((candidate) => (candidate.id === id ? updated : candidate)) })) {
        throw new Error('Não deu para guardar no navegador.')
      }
      announce(deps, { type: 'UPDATE', id })
      return updated
    },
    listen(onChange, onState) {
      // O que esta aba já viu: pedido que aparece é INSERT; situação que muda é UPDATE.
      let seen = new Map(readDemo(deps.storage).orders.map((row) => [row.id, row.status]))
      const check = () => {
        const changes: OrderChange[] = []
        const rows = readDemo(deps.storage).orders
        for (const row of rows) {
          const before = seen.get(row.id)
          if (before === undefined) changes.push({ type: 'INSERT', row })
          else if (before !== row.status) changes.push({ type: 'UPDATE', row })
        }
        seen = new Map(rows.map((row) => [row.id, row.status]))
        for (const change of changes) onChange(change)
      }
      const channel = deps.openChannel()
      channel?.onMessage(check)
      const stopStorage = deps.onStorage((key) => {
        if (key === DEMO_KEY || key === null) check()
      })
      onState('live')
      return () => {
        channel?.close()
        stopStorage()
      }
    },
  }
}

/** As peças do navegador para o modo de demonstração. */
export function browserDemoDeps(): LocalDeps {
  return {
    storage: window.localStorage,
    now: () => Date.now(),
    randomId: () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),
    openChannel: () => {
      if (typeof BroadcastChannel === 'undefined') return null
      const channel = new BroadcastChannel(DEMO_CHANNEL)
      return {
        postMessage: (message) => channel.postMessage(message),
        onMessage: (listener) => channel.addEventListener('message', () => listener()),
        close: () => channel.close(),
      }
    },
    onStorage: (listener) => {
      const handler = (event: StorageEvent) => listener(event.key)
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
