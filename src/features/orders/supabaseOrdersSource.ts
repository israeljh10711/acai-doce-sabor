/**
 * Pedidos do Supabase para o painel ao vivo (2026-11-20): a carga e a mudança de situação pela
 * API REST (com o login do vendedor), e as mudanças na hora pelo Supabase Realtime.
 *
 * O Realtime entrega `INSERT` e `UPDATE` da tabela `orders` só para quem o RLS deixa ler (o
 * vendedor logado): o token do vendedor vai na inscrição. A tabela precisa estar na publicação
 * `supabase_realtime` (`20261120180000_painel_ao_vivo.sql`).
 */
import type { SupabaseRest } from '../../services/supabaseRest.ts'
import { ordersSince } from './ordersPanel.ts'
import type { LiveState, OrdersSource } from './ordersSource.ts'

/** A conexão com o Realtime, por fora (a biblioteca no site, uma de mentira nos testes). */
export type RealtimeConnect = (args: {
  endpoint: string
  apikey: string
  /** O token do vendedor, renovado quando precisa. */
  accessToken: () => Promise<string | null>
  onChange: (eventType: string, record: unknown) => void
  /** A tabela escutada (padrão: orders) e o filtro do Realtime (ex.: "customer_user_id=eq.<id>"). */
  table?: string
  filter?: string
  /** O nome do canal (cada tela o seu). */
  channel?: string
  /** "SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT" ou "CLOSED" (os estados da biblioteca). */
  onStatus: (status: string) => void
}) => { stop(): void }

/** `https://xyz.supabase.co` → `wss://xyz.supabase.co/realtime/v1`. */
export function realtimeEndpoint(url: string): string {
  return `${url.replace(/\/+$/, '').replace(/^http/i, 'ws')}/realtime/v1`
}

function liveState(status: string): LiveState {
  if (status === 'SUBSCRIBED') return 'live'
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') return 'offline'
  return 'connecting'
}

export function createSupabaseOrdersSource({
  rest,
  url,
  key,
  now,
  connect,
}: {
  rest: Pick<SupabaseRest, 'readOrders' | 'setOrderStatus' | 'sellerToken'>
  url: string
  key: string
  now: () => number
  connect: RealtimeConnect
}): OrdersSource {
  return {
    kind: 'supabase',
    load: () => rest.readOrders(ordersSince(now())),
    setStatus: (id, status) => rest.setOrderStatus(id, status),
    listen(onChange, onState) {
      onState('connecting')
      let stopped = false
      const connection = connect({
        endpoint: realtimeEndpoint(url),
        apikey: key,
        accessToken: () => rest.sellerToken().catch(() => null),
        onChange: (eventType, record) => {
          if (stopped) return
          if (eventType === 'INSERT' || eventType === 'UPDATE') onChange({ type: eventType, row: record })
        },
        onStatus: (status) => {
          if (!stopped) onState(liveState(status))
        },
      })
      return () => {
        if (stopped) return
        stopped = true
        connection.stop()
      }
    },
  }
}
