import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseRest } from '../../services/supabaseRest.ts'
import { serverNow } from '../store-hours/serverClock.ts'
import { type PanelOrder, newOrders, ordersSince, parseOrderRow } from './ordersPanel.ts'

/** De quanto em quanto tempo o painel busca pedidos novos (com a página visível). */
export const ORDERS_REFRESH_MS = 15_000

export type OrdersFeed = {
  orders: PanelOrder[]
  /** `loading`: primeira carga; `error`: a última busca falhou (a lista é a anterior). */
  status: 'loading' | 'ready' | 'error'
  /** Hora da última busca que deu certo (ms). */
  updatedAt: number | null
  refresh(): Promise<void>
  /** Troca um pedido na lista (depois de mudar a situação). */
  replace(order: PanelOrder): void
}

const byNewest = (a: PanelOrder, b: PanelOrder) => b.createdAt - a.createdAt || b.number - a.number

/**
 * Os pedidos do painel (pedido de 2026-11-20, etapa 2): busca ao abrir, a cada 15 s enquanto a
 * página está visível e ao voltar para a aba. Pedido "novo" que aparece depois da primeira carga
 * chama `onNew` (o aviso sonoro). Uma busca de cada vez.
 */
export function useOrdersFeed(rest: SupabaseRest, onNew: (orders: PanelOrder[]) => void): OrdersFeed {
  const [orders, setOrders] = useState<PanelOrder[]>([])
  const [status, setStatus] = useState<OrdersFeed['status']>('loading')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const known = useRef<Set<string> | null>(null)
  const busy = useRef(false)
  const alive = useRef(true)
  const notify = useRef(onNew)

  useEffect(() => {
    notify.current = onNew
  }, [onNew])

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const rows = await rest.readOrders(ordersSince(serverNow()))
      if (!alive.current) return
      const next = rows.flatMap((row) => parseOrderRow(row) ?? []).sort(byNewest)
      if (known.current) {
        const arrived = newOrders(known.current, next)
        if (arrived.length > 0) notify.current(arrived)
      }
      known.current = new Set([...(known.current ?? []), ...next.map((order) => order.id)])
      setOrders(next)
      setStatus('ready')
      setUpdatedAt(Date.now())
    } catch {
      if (alive.current) setStatus('error')
    } finally {
      busy.current = false
    }
  }, [rest])

  useEffect(() => {
    alive.current = true
    const first = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, ORDERS_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const replace = useCallback((order: PanelOrder) => {
    setOrders((current) => current.map((item) => (item.id === order.id ? order : item)))
  }, [])

  return { orders, status, updatedAt, refresh, replace }
}
