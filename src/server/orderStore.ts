/**
 * O banco dos pedidos pela API REST do Supabase (função `pedido`, pedido de 2026-11-17), com a
 * chave de servidor que o próprio Supabase põe no ambiente da função (nunca no site).
 * Só `fetch`, sem pacote.
 */
import type { ChangeRow } from '../services/supabaseRest.ts'
import type { OrderDeps, OrderRow, StoredOrder } from './orderServer.ts'

export type OrderStoreConfig = { url: string; key: string }

const STORED_COLUMNS = 'code,message,total_cents,whatsapp'

export function createOrderStore(
  { url, key }: OrderStoreConfig,
  fetchImpl: typeof fetch,
): Pick<OrderDeps, 'readChanges' | 'findOrder' | 'nextNumber' | 'insertOrder'> {
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
  }
}
