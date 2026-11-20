/**
 * As operações do cliente na função `pedido` (pedido 100% no site, 2026-11-20): consultar o
 * próprio pedido, listar os próprios pedidos e acrescentar itens a um pedido ainda em `novo` ou
 * `preparando`.
 *
 * Quem é o cliente vem da sessão anônima dele (Supabase Auth), já conferida pelo servidor de login
 * (`verifyCustomer`). O código ADS-0001 nunca autoriza nada: pedido de outra sessão responde
 * "nao-encontrado", sem dizer que existe. Os preços do acréscimo vêm do cardápio no servidor; o
 * site só manda os itens e o valor que viu. A gravação é a função SQL `adicionar_itens_pedido`
 * (transação com o pedido travado: dono, situação, repetição e troco conferidos lá também).
 */
import { cartItemProblem, cartTotalCents, parseCart, serializeCart } from '../features/cart/cart.ts'
import { getStoreSettings, setCatalogChanges } from '../features/catalog/catalogState.ts'
import { parseReais } from '../features/checkout/payment.ts'
import { itemsBlockLines } from '../features/orders/orderMessage.ts'
import { itemName, itemSnapshots } from '../features/orders/orderRow.ts'
import { ADDABLE_STATUSES, type EventRecord, type OrderRecord, type OrderView, RETENTION_MS, customerView } from '../features/tracking/orderView.ts'
import type { OrderStatus } from '../features/orders/ordersPanel.ts'

export type { EventRecord, OrderRecord } from '../features/tracking/orderView.ts'
import { effectiveStatus } from '../features/store-hours/hours.ts'
import { changesFromRows } from '../services/supabaseBackend.ts'
import { ATTEMPT_ID, MAX_CART_LENGTH, MAX_LINES, type OrderDeps, type RejectReason, cartLines, parsePayment } from './orderServer.ts'

export type AddItemsArgs = {
  orderId: string
  customerId: string
  attemptKey: string
  batch: { items: unknown; cart: unknown; itemsBlock: string }
  subtotalCents: number
  changeForCents: number | null
  changeSet: boolean
}

export type CustomerDeps = {
  /** O id da sessão (anônima ou não) dona do token; token inválido ou vencido: `null`. */
  verifyCustomer(token: string): Promise<string | null>
  findOrderById(id: string): Promise<OrderRecord | null>
  listCustomerOrders(customerId: string, since: string): Promise<OrderRecord[]>
  readEvents(orderId: string): Promise<EventRecord[]>
  /** A função SQL `adicionar_itens_pedido` (devolve o objeto JSON dela). */
  addItems(args: AddItemsArgs): Promise<unknown>
}

export type PedidoDeps = OrderDeps & CustomerDeps

type Rejection = { ok: false; reason: RejectReason; detail?: string; totalCents?: number }
const reject = (reason: RejectReason, detail?: string): Rejection => (detail ? { ok: false, reason, detail } : { ok: false, reason })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
/** Ids de pedido (uuid no Supabase): só letras, números e hífen, para ir seguro no endereço. */
const ORDER_ID = /^[A-Za-z0-9-]{1,64}$/

function orderIdOf(raw: unknown): string | null {
  return isRecord(raw) && typeof raw.orderId === 'string' && ORDER_ID.test(raw.orderId) ? raw.orderId : null
}

/** O pedido existe, é desta sessão e ainda está no prazo de consulta? */
async function ownOrder(raw: unknown, deps: PedidoDeps, customerId: string | null): Promise<OrderRecord | Rejection> {
  if (!customerId) return reject('sem-sessao')
  const id = orderIdOf(raw)
  if (!id) return reject('pedido-invalido')
  const order = await deps.findOrderById(id)
  if (!order || !order.customer_user_id || order.customer_user_id !== customerId) return reject('nao-encontrado')
  if (deps.now() - Date.parse(order.created_at) > RETENTION_MS) return reject('expirado')
  return order
}

export async function lookupOrder(raw: unknown, deps: PedidoDeps, customerId: string | null): Promise<{ ok: true; order: OrderView } | Rejection> {
  const order = await ownOrder(raw, deps, customerId)
  if ('ok' in order) return order
  return { ok: true, order: customerView(order, await deps.readEvents(order.id)) }
}

export type OrderSummary = { id: string; code: string; createdAt: string; status: string; fulfillment: string; totalCents: number }

export async function listOrders(deps: PedidoDeps, customerId: string | null): Promise<{ ok: true; orders: OrderSummary[] } | Rejection> {
  if (!customerId) return reject('sem-sessao')
  const rows = await deps.listCustomerOrders(customerId, new Date(deps.now() - RETENTION_MS).toISOString())
  return {
    ok: true,
    orders: rows.map((row) => ({ id: row.id, code: row.code, createdAt: row.created_at, status: row.status, fulfillment: row.fulfillment, totalCents: row.total_cents })),
  }
}

export type AddResponse = { ok: true; totalCents: number; subtotalCents: number; changeForCents: number | null; repeated: boolean } | Rejection

/** Acrescenta itens ao pedido do próprio cliente. Erro do banco sobe (a função responde 500). */
export async function addItems(raw: unknown, deps: PedidoDeps, customerId: string | null): Promise<AddResponse> {
  if (!isRecord(raw)) return reject('pedido-invalido')
  const { attemptId, cart, expectedSubtotalCents } = raw
  if (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId)) return reject('pedido-invalido')
  if (typeof cart !== 'string' || cart.length > MAX_CART_LENGTH) return reject('pedido-invalido')
  if (typeof expectedSubtotalCents !== 'number' || !Number.isSafeInteger(expectedSubtotalCents) || expectedSubtotalCents < 0) return reject('pedido-invalido')

  const order = await ownOrder(raw, deps, customerId)
  if ('ok' in order) return order
  const attemptKey = await deps.sha256(`acrescimo:${order.id}:${attemptId}`)
  // O mesmo acréscimo mandado de novo: já foi feito, mesmo que o pedido tenha mudado depois.
  if (Array.isArray(order.additions) && order.additions.some((entry) => isRecord(entry) && entry.attempt_key === attemptKey)) {
    return { ok: true, totalCents: order.total_cents, subtotalCents: order.subtotal_cents, changeForCents: order.change_for_cents, repeated: true }
  }
  if (!ADDABLE_STATUSES.includes(order.status as OrderStatus)) return reject('situacao', order.status)

  const rows = await deps.readChanges()
  // Daqui até o lote ficar pronto, nada de await: o cardápio é um estado do módulo.
  setCatalogChanges(changesFromRows(rows))
  const lines = cartLines(cart)
  if (lines > MAX_LINES) return reject('pedido-invalido')
  const parsed = parseCart(cart)
  if (parsed.items.length === 0) return reject(lines === 0 ? 'carrinho-vazio' : 'item-indisponivel')
  if (parsed.items.length !== lines) return reject('item-indisponivel')
  const soldOut = parsed.items.flatMap((item) => {
    const problem = cartItemProblem(item)
    if (!problem) return []
    return problem.kind === 'item' ? [itemName(item)] : problem.names
  })
  if (soldOut.length > 0) return reject('esgotado', soldOut.join(', '))
  const settings = getStoreSettings()
  const status = effectiveStatus(deps.now(), settings)
  if (!status.open && settings.closedOrders === 'bloquear') return reject('loja-fechada', status.reopenText ?? undefined)
  const subtotalCents = cartTotalCents(parsed)
  if (subtotalCents !== expectedSubtotalCents) return { ok: false, reason: 'total-mudou', totalCents: subtotalCents }

  // Dinheiro: o troco novo, quando o cliente informou (a conferência com o total fica no banco).
  let changeForCents: number | null = null
  let changeSet = false
  const payment = isRecord(raw.payment) ? parsePayment(raw.payment) : null
  if (order.payment_method === 'dinheiro' && payment && (payment.exact || payment.changeFor.trim())) {
    changeSet = true
    if (!payment.exact) {
      changeForCents = parseReais(payment.changeFor)
      if (changeForCents === null) return reject('pagamento-invalido', 'Digite o valor em reais, por exemplo 50,00.')
    }
  }

  const result = await deps.addItems({
    orderId: order.id,
    customerId: customerId as string,
    attemptKey,
    batch: { items: itemSnapshots(parsed), cart: JSON.parse(serializeCart(parsed)) as unknown, itemsBlock: itemsBlockLines(parsed).join('\n').trimEnd() },
    subtotalCents,
    changeForCents,
    changeSet,
  })
  if (!isRecord(result)) throw new Error('Resposta inesperada do banco ao acrescentar itens.')
  if (result.ok === true) {
    return {
      ok: true,
      totalCents: Number(result.total_cents),
      subtotalCents: Number(result.subtotal_cents),
      changeForCents: typeof result.change_for_cents === 'number' ? result.change_for_cents : null,
      repeated: result.repeated === true,
    }
  }
  switch (result.reason) {
    case 'situacao':
      return reject('situacao', typeof result.status === 'string' ? result.status : undefined)
    case 'troco':
      return { ok: false, reason: 'troco', totalCents: Number(result.total_cents) }
    case 'nao-encontrado':
      return reject('nao-encontrado')
    default:
      return reject('pedido-invalido')
  }
}
