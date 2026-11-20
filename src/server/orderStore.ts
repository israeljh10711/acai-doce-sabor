/**
 * O banco dos pedidos pela API REST do Supabase (função `pedido`, pedido de 2026-11-17), com a
 * chave de servidor que o próprio Supabase põe no ambiente da função (nunca no site).
 * Só `fetch`, sem pacote.
 */
import type { ChangeRow } from '../services/supabaseRest.ts'
import type { CustomerDeps, EventRecord, OrderRecord } from './customerOrders.ts'
import type { OrderDeps, OrderRow, StoredOrder } from './orderServer.ts'

export type OrderStoreConfig = { url: string; key: string }

const STORED_COLUMNS = 'id,code,message,total_cents,whatsapp,created_at,customer_user_id'
/** O que a função lê do pedido para o cliente (acompanhamento e acréscimo, 2026-11-20). */
const ORDER_COLUMNS =
  'id,code,created_at,updated_at,status,customer_user_id,fulfillment,address,delivery_fee,delivery_fee_cents,delivery_zone,payment_method,change_for_cents,subtotal_cents,total_cents,antecipado,items,message,additions'

export function createOrderStore(
  { url, key }: OrderStoreConfig,
  fetchImpl: typeof fetch,
): Pick<OrderDeps, 'readChanges' | 'findOrder' | 'nextNumber' | 'insertOrder'> & CustomerDeps {
  const base = url.replace(/\/+$/, '')
  // Chave nova (sb_secret_...) vai só no apikey; a antiga (um JWT) também como Bearer.
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    apikey: key,
    ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  })

  const request = async (path: string, init: RequestInit = {}): Promise<unknown> => {
    const response = await fetchImpl(`${base}${path}`, init)
    if (!response.ok) throw new Error(`Supabase respondeu ${response.status} em ${path.split('?')[0]}`)
    const text = await response.text()
    return text ? (JSON.parse(text) as unknown) : null
  }

  const firstStored = (value: unknown): StoredOrder | null => (Array.isArray(value) && value.length > 0 ? (value[0] as StoredOrder) : null)

  return {
    async readChanges() {
      const rows = await request('/rest/v1/catalog_changes?select=kind,id,data', { headers: headers() })
      return Array.isArray(rows) ? (rows as ChangeRow[]) : []
    },
    async findOrder(attemptKey) {
      const rows = await request(`/rest/v1/orders?select=${STORED_COLUMNS}&attempt_key=eq.${encodeURIComponent(attemptKey)}&limit=1`, { headers: headers() })
      return firstStored(rows)
    },
    async nextNumber() {
      const value = await request('/rest/v1/rpc/proximo_numero_pedido', { method: 'POST', headers: headers(), body: '{}' })
      const number = typeof value === 'string' ? Number(value) : value
      if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1) throw new Error('Número de pedido inválido vindo do banco.')
      return number
    },
    async insertOrder(row: OrderRow) {
      const rows = await request(`/rest/v1/orders?on_conflict=attempt_key&select=${STORED_COLUMNS}`, {
        method: 'POST',
        headers: headers({ Prefer: 'return=representation,resolution=ignore-duplicates' }),
        body: JSON.stringify(row),
      })
      return firstStored(rows)
    },
    /**
     * Confere a sessão do cliente no servidor de login (Supabase Auth). Token inválido, vencido
     * ou de outro projeto: `null` (nunca lança, nunca registra o token).
     */
    async verifyCustomer(token: string) {
      try {
        const response = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: 'application/json' } })
        if (!response.ok) return null
        const user = (await response.json()) as { id?: unknown }
        return typeof user.id === 'string' && user.id ? user.id : null
      } catch {
        return null
      }
    },
    async findOrderById(id: string) {
      const rows = await request(`/rest/v1/orders?select=${ORDER_COLUMNS}&id=eq.${encodeURIComponent(id)}&limit=1`, { headers: headers() })
      return Array.isArray(rows) && rows.length > 0 ? (rows[0] as OrderRecord) : null
    },
    async listCustomerOrders(customerId: string, since: string) {
      const params = new URLSearchParams({
        select: ORDER_COLUMNS,
        customer_user_id: `eq.${customerId}`,
        created_at: `gte.${since}`,
        order: 'created_at.desc',
        limit: '50',
      })
      const rows = await request(`/rest/v1/orders?${params.toString()}`, { headers: headers() })
      return Array.isArray(rows) ? (rows as OrderRecord[]) : []
    },
    async readEvents(orderId: string) {
      const rows = await request(`/rest/v1/order_events?select=kind,status,created_at&order_id=eq.${encodeURIComponent(orderId)}&order=id.asc`, { headers: headers() })
      return Array.isArray(rows) ? (rows as EventRecord[]) : []
    },
    async addItems(args) {
      return request('/rest/v1/rpc/adicionar_itens_pedido', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          p_order_id: args.orderId,
          p_customer_user_id: args.customerId,
          p_attempt_key: args.attemptKey,
          p_batch: args.batch,
          p_subtotal_cents: args.subtotalCents,
          p_change_for_cents: args.changeForCents,
          p_change_set: args.changeSet,
        }),
      })
    },
  }
}
