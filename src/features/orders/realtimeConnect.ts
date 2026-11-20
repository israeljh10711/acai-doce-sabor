/**
 * A conexão de verdade com o Supabase Realtime (painel ao vivo, 2026-11-20), pelo cliente oficial
 * `@supabase/realtime-js`. Só o código do vendedor importa este arquivo: quem compra não baixa.
 *
 * Inscrição: `postgres_changes` da tabela escolhida (`orders` no painel do vendedor; `order_events`
 * filtrado pela sessão no acompanhamento do cliente, 2026-11-20), com a chave pública e o token da
 * sessão: o Realtime aplica o RLS, e cada um só recebe o que pode ler.
 *
 * O token é buscado e entregue ANTES de entrar no canal: a biblioteca manda a entrada assim que
 * pode, e um canal que entra sem token é tratado como visitante (o RLS não entrega nenhum pedido).
 * Depois, a própria biblioteca renova o token pelo `accessToken`.
 */
import { type RealtimeChannel, RealtimeClient } from '@supabase/realtime-js'
import type { RealtimeConnect } from './supabaseOrdersSource.ts'

export const connectRealtime: RealtimeConnect = ({ endpoint, apikey, accessToken, onChange, onStatus, table = 'orders', filter, channel: channelName = 'pedidos-do-painel' }) => {
  const client = new RealtimeClient(endpoint, { params: { apikey }, accessToken })
  let channel: RealtimeChannel | null = null
  let stopped = false

  void (async () => {
    try {
      await client.setAuth(await accessToken())
    } catch {
      // Sem token: o canal entra como visitante e o painel segue pela consulta (que avisa o erro).
    }
    if (stopped) return
    channel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => onChange(payload.eventType, payload.new))
      .subscribe((status) => onStatus(status))
  })()

  return {
    stop() {
      stopped = true
      const leaving = channel ? client.removeChannel(channel).catch(() => undefined) : Promise.resolve()
      void leaving.finally(() => void client.disconnect())
    },
  }
}
