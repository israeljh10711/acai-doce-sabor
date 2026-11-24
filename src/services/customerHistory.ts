import { type CustomerDraft, DELIVERY_TYPES, type DeliveryType } from '../features/checkout/delivery.ts'
import { ORDER_STATUSES, type OrderStatus } from '../features/orders/ordersPanel.ts'
import { supabaseConfig } from '../features/seller/sellerBackend.ts'
import { getCustomerSession } from '../features/tracking/trackingRuntime.ts'

export type CustomerAddress = Pick<CustomerDraft, 'street' | 'number' | 'district' | 'zoneId' | 'reference'>
export type CustomerHistoryOrder = {
  id: string
  code: string
  createdAt: string
  status: OrderStatus
  fulfillment: DeliveryType
  totalCents: number
  carts: string[]
  items: { name: string; quantity: number }[]
}

const accountError = () => new Error('Entre novamente para acessar sua conta.')
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

async function accountRequest(build: (userId: string) => { path: string; init?: RequestInit }): Promise<unknown> {
  const config = supabaseConfig()
  const session = getCustomerSession()
  const userId = session?.userId()
  if (!config || !session?.account() || !userId) throw accountError()
  const token = await session.token({ create: false })
  const isCurrent = () => session.userId() === userId && Boolean(session.account())
  if (!token || !isCurrent()) throw accountError()
  const { path, init } = build(userId)
  const response = await fetch(`${config.url.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...init,
    cache: 'no-store',
    headers: { apikey: config.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw new Error('Não foi possível acessar os dados da conta.')
  const body = await response.text()
  if (!isCurrent()) throw accountError()
  return body ? JSON.parse(body) as unknown : null
}

export async function loadCustomerAddress(): Promise<CustomerAddress | null> {
  const rows = await accountRequest(userId => ({
    path: `customer_addresses?select=street,number,district,zone_id,reference&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  }))
  if (!Array.isArray(rows)) throw new Error('Resposta inesperada ao carregar o endereço.')
  if (!rows.length) return null
  const row: unknown = rows[0]
  if (!isRecord(row) || typeof row.street !== 'string' || typeof row.number !== 'string' || typeof row.district !== 'string' || typeof row.reference !== 'string') {
    throw new Error('Endereço inválido na conta.')
  }
  return { street: row.street, number: row.number, district: row.district, zoneId: typeof row.zone_id === 'string' ? row.zone_id : null, reference: row.reference }
}

export async function saveCustomerAddress(address: CustomerAddress): Promise<void> {
  await accountRequest(userId => ({
    path: 'customer_addresses?on_conflict=user_id',
    init: {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId, street: address.street.trim(), number: address.number.trim(), district: address.district.trim(),
        zone_id: address.zoneId, reference: address.reference.trim(),
      }),
    },
  }))
}

export async function removeCustomerAddress(): Promise<void> {
  await accountRequest(userId => ({ path: `customer_addresses?user_id=eq.${encodeURIComponent(userId)}`, init: { method: 'DELETE' } }))
}

export async function listCustomerHistory(offset = 0): Promise<CustomerHistoryOrder[]> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Página de pedidos inválida.')
  const rows = await accountRequest(() => ({
    path: 'rpc/historico_cliente',
    init: { method: 'POST', body: JSON.stringify({ p_offset: offset }) },
  }))
  if (!Array.isArray(rows)) throw new Error('Resposta inesperada ao carregar os pedidos.')
  return rows.map((row: unknown) => {
    if (!isRecord(row)) throw new Error('Pedido inválido no histórico.')
    const status = ORDER_STATUSES.find(status => status === row.status)
    const fulfillment = DELIVERY_TYPES.find(kind => kind === row.fulfillment)
    if (!status || !fulfillment || typeof row.id !== 'string' || typeof row.code !== 'string' || typeof row.created_at !== 'string' || typeof row.total_cents !== 'number') {
      throw new Error('Pedido inválido no histórico.')
    }
    return {
      id: row.id, code: row.code, createdAt: row.created_at, status, fulfillment, totalCents: row.total_cents,
      carts: Array.isArray(row.carts) ? row.carts.filter(cart => isRecord(cart) && Array.isArray(cart.items)).map(cart => JSON.stringify(cart)) : [],
      items: Array.isArray(row.items) ? row.items.flatMap(item => isRecord(item) && typeof item.name === 'string' && typeof item.quantity === 'number'
        ? [{ name: item.name, quantity: item.quantity }] : []) : [],
    }
  })
}
