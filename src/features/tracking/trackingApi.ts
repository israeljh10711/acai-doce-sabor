/**
 * O acompanhamento pelo site (pedido 100% no site, 2026-11-20): consultar o próprio pedido e
 * acrescentar itens. Duas fontes com a mesma forma:
 * - Supabase: a função `pedido` (`consultar` e `adicionar`), com o token da sessão anônima;
 * - demonstração (sem Supabase): o `localStorage` deste navegador, com as mesmas regras.
 */
import type { CustomerSession } from '../../services/customerSession.ts'
import { type Cart, cartTotalCents, serializeCart } from '../cart/cart.ts'
import { parseReais } from '../checkout/payment.ts'
import { type LocalDeps, addDemoItems, findDemoOrder } from '../orders/localOrdersSource.ts'
import { type OrderRecord, type OrderView, customerView, parseOrderView } from './orderView.ts'

export type Rejection = { ok: false; reason: string; detail?: string; totalCents?: number }
/** `falha`: internet, servidor fora do ar ou resposta estranha (nada foi confirmado). */
export type Failure = { ok: false; reason: 'falha' }
export type LookupResult = { ok: true; order: OrderView } | Rejection | Failure
export type AddRequest = { attemptId: string; cart: Cart; expectedSubtotalCents: number; payment?: { changeFor: string; exact: boolean } }
export type AddResult = { ok: true; totalCents: number; subtotalCents: number; changeForCents: number | null; repeated: boolean } | Rejection | Failure

export type TrackingApi = {
  kind: 'supabase' | 'demo'
  lookup(orderId: string): Promise<LookupResult>
  add(orderId: string, request: AddRequest): Promise<AddResult>
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export const TRACKING_TIMEOUT_MS = 15_000

export function createSupabaseTracking({
  url,
  key,
  session,
  fetchImpl = (input, init) => fetch(input, init),
  timeoutMs = TRACKING_TIMEOUT_MS,
}: {
  url: string
  key: string
  session: Pick<CustomerSession, 'token'>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): TrackingApi {
  const endpoint = `${url.replace(/\/+$/, '')}/functions/v1/pedido`
  const call = async (body: Record<string, unknown>): Promise<unknown> => {
    const token = await session.token({ create: false })
    if (!token) return { ok: false, reason: 'sem-sessao' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!response.ok) return { ok: false, reason: 'falha' }
      return (await response.json()) as unknown
    } catch {
      return { ok: false, reason: 'falha' }
    } finally {
      clearTimeout(timer)
    }
  }
  const rejection = (body: unknown): Rejection | Failure =>
    isRecord(body) && body.ok === false && typeof body.reason === 'string'
      ? {
          ok: false,
          reason: body.reason,
          ...(typeof body.detail === 'string' ? { detail: body.detail } : {}),
          ...(typeof body.totalCents === 'number' ? { totalCents: body.totalCents } : {}),
        }
      : { ok: false, reason: 'falha' }

  return {
    kind: 'supabase',
    async lookup(orderId) {
      const body = await call({ op: 'consultar', orderId })
      if (isRecord(body) && body.ok === true) {
        const order = parseOrderView(body.order)
        return order ? { ok: true, order } : { ok: false, reason: 'falha' }
      }
      return rejection(body)
    },
    async add(orderId, request) {
      const body = await call({
        op: 'adicionar',
        orderId,
        attemptId: request.attemptId,
        cart: serializeCart(request.cart),
        expectedSubtotalCents: request.expectedSubtotalCents,
        ...(request.payment ? { payment: request.payment } : {}),
      })
      if (isRecord(body) && body.ok === true && typeof body.totalCents === 'number') {
        return {
          ok: true,
          totalCents: body.totalCents,
          subtotalCents: typeof body.subtotalCents === 'number' ? body.subtotalCents : 0,
          changeForCents: typeof body.changeForCents === 'number' ? body.changeForCents : null,
          repeated: body.repeated === true,
        }
      }
      return rejection(body)
    },
  }
}

/** O modo de demonstração: o mesmo caminho, com os pedidos deste navegador. */
export function createDemoTracking(deps: LocalDeps): TrackingApi {
  return {
    kind: 'demo',
    async lookup(orderId) {
      const row = findDemoOrder(orderId, deps)
      if (!row) return { ok: false, reason: 'nao-encontrado' }
      const events = (row.events ?? []).map((event) => ({ kind: event.kind, status: event.status, created_at: event.created_at }))
      return { ok: true, order: customerView(row as unknown as OrderRecord, events) }
    },
    async add(orderId, request) {
      if (cartTotalCents(request.cart) !== request.expectedSubtotalCents) return { ok: false, reason: 'total-mudou', totalCents: cartTotalCents(request.cart) }
      let changeForCents: number | null = null
      let changeSet = false
      if (request.payment && (request.payment.exact || request.payment.changeFor.trim())) {
        changeSet = true
        if (!request.payment.exact) {
          changeForCents = parseReais(request.payment.changeFor)
          if (changeForCents === null) return { ok: false, reason: 'pagamento-invalido', detail: 'Digite o valor em reais, por exemplo 50,00.' }
        }
      }
      return addDemoItems(orderId, { attemptId: request.attemptId, cart: request.cart, changeForCents, changeSet }, deps)
    },
  }
}
