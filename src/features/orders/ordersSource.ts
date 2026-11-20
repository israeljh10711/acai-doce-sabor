/**
 * De onde vêm os pedidos do painel (painel ao vivo, 2026-11-20). A tela e a loja de pedidos
 * (`ordersLive.ts`) não sabem se é o Supabase ou o modo de demonstração local: as duas fontes têm
 * esta mesma forma, e as linhas têm a estrutura da tabela `orders`.
 */
import type { OrderStatus } from './ordersPanel.ts'

/** Uma mudança na tabela: pedido gravado (`INSERT`) ou mudado (`UPDATE`), com a linha nova. */
export type OrderChange = { type: 'INSERT' | 'UPDATE'; row: unknown }

/** A escuta das mudanças: conectando, ao vivo ou caída (o painel passa a consultar mais vezes). */
export type LiveState = 'connecting' | 'live' | 'offline'

export type OrdersSource = {
  kind: 'supabase' | 'local'
  /** Os pedidos do dia da loja e os de antes ainda em andamento (linhas da tabela). */
  load(): Promise<unknown[]>
  /** Muda só a situação; devolve a linha nova, ou `null` se o pedido não existe. Erro: lança. */
  setStatus(id: string, status: OrderStatus): Promise<unknown>
  /** Escuta as mudanças. Devolve a função que para de escutar (sem deixar inscrição para trás). */
  listen(onChange: (change: OrderChange) => void, onState: (state: LiveState) => void): () => void
}
