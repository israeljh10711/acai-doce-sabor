/**
 * Os pedidos que este aparelho acompanha (pedido 100% no site, 2026-11-20): só o necessário para
 * voltar ao acompanhamento depois de recarregar ou fechar o navegador. Nada de nome, telefone,
 * endereço ou pagamento; e nenhum token (a autorização é a sessão anônima, guardada à parte).
 *
 * Vários pedidos ficam guardados (um novo não apaga os anteriores). Os encerrados (concluído ou
 * cancelado) saem da lista de "em andamento", mas continuam consultáveis por 30 dias.
 */
import type { DeliveryType } from '../checkout/delivery.ts'
import { DELIVERY_TYPES } from '../checkout/delivery.ts'
import { ORDER_STATUSES, type OrderStatus } from '../orders/ordersPanel.ts'
import { RETENTION_MS } from './orderView.ts'

export type TrackedOrder = {
  id: string
  code: string
  createdAt: string
  status: OrderStatus
  fulfillment: DeliveryType | null
  /** Pedido do modo de demonstração (guardado só neste navegador, nunca enviado à loja). */
  demo: boolean
  /** O pedido ficou ligado à sessão do cliente (sem isso, não dá para acompanhar ao vivo). */
  tracked: boolean
}

export const TRACKED_KEY = 'acai_doce_sabor_meus_pedidos_v1'
export const MAX_TRACKED = 20
const FINAL: readonly OrderStatus[] = ['concluido', 'cancelado']

export const isActive = (order: Pick<TrackedOrder, 'status'>) => !FINAL.includes(order.status)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function parseTracked(raw: unknown): TrackedOrder | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.code !== 'string' || typeof raw.createdAt !== 'string') return null
  const status = ORDER_STATUSES.find((candidate) => candidate === raw.status) ?? 'novo'
  return {
    id: raw.id,
    code: raw.code,
    createdAt: raw.createdAt,
    status,
    fulfillment: DELIVERY_TYPES.find((candidate) => candidate === raw.fulfillment) ?? null,
    demo: raw.demo === true,
    tracked: raw.tracked !== false,
  }
}

export type TrackedStore = ReturnType<typeof createTrackedOrders>

export function createTrackedOrders(storage: Pick<Storage, 'getItem' | 'setItem'> | null, now: () => number) {
  let memory: TrackedOrder[] = []
  let cache: { raw: string | null; memory: TrackedOrder[]; list: TrackedOrder[] } | null = null
  const listeners = new Set<() => void>()

  const readRaw = (): string | null => {
    try {
      return storage?.getItem(TRACKED_KEY) ?? null
    } catch {
      return null
    }
  }
  const list = (): TrackedOrder[] => {
    const raw = readRaw()
    // A mesma lista enquanto nada muda (a tela compara pela referência).
    if (cache && cache.raw === raw && cache.memory === memory) return cache.list
    let parsed: TrackedOrder[] = memory
    if (raw !== null) {
      try {
        const data: unknown = JSON.parse(raw)
        parsed = Array.isArray(data) ? data.flatMap((entry) => parseTracked(entry) ?? []) : []
      } catch {
        parsed = []
      }
    }
    const fresh = parsed
      .filter((order) => now() - Date.parse(order.createdAt) <= RETENTION_MS)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    cache = { raw, memory, list: fresh }
    return fresh
  }
  const save = (next: TrackedOrder[]) => {
    memory = next.slice(0, MAX_TRACKED)
    try {
      storage?.setItem(TRACKED_KEY, JSON.stringify(memory))
    } catch {
      // Sem armazenamento: vale só nesta tela.
    }
    cache = null
    for (const listener of listeners) listener()
  }

  return {
    list,
    active: () => list().filter(isActive),
    find: (codeOrId: string) => list().find((order) => order.code === codeOrId || order.id === codeOrId) ?? null,
    /** Guarda (ou atualiza) um pedido; os outros continuam. */
    upsert(order: TrackedOrder) {
      save([order, ...list().filter((candidate) => candidate.id !== order.id)])
    },
    /** A situação mais nova vista no acompanhamento. */
    setStatus(id: string, status: OrderStatus) {
      const current = list()
      const order = current.find((candidate) => candidate.id === id)
      if (!order || order.status === status) return
      save(current.map((candidate) => (candidate.id === id ? { ...candidate, status } : candidate)))
    },
    remove(id: string) {
      save(list().filter((candidate) => candidate.id !== id))
    },
    /** Outra aba mudou a lista: avisa quem está olhando. */
    changed() {
      cache = null
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
