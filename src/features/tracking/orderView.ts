/**
 * O que o cliente vê do próprio pedido (acompanhamento, 2026-11-20): a visão reduzida que a função
 * `pedido` devolve. Sem nome, telefone, GPS nem dados internos; o endereço só na entrega. A mesma
 * forma vale no Supabase e no modo de demonstração, e o site a lê com cuidado (`parseOrderView`).
 */
import { DELIVERY_TYPES, type DeliveryType } from '../checkout/delivery.ts'
import { PAYMENT_METHODS, type PaymentMethod } from '../checkout/payment.ts'
import { orderItemsBlock } from '../orders/orderMessage.ts'
import { ORDER_STATUSES, type OrderStatus } from '../orders/ordersPanel.ts'

export type ViewItem = { name: string; quantity: number; totalCents: number; note: string | null }

export type OrderView = {
  id: string
  code: string
  createdAt: string
  updatedAt: string
  status: OrderStatus
  fulfillment: DeliveryType | null
  address: { street: string; number: string; district: string; reference: string | null } | null
  /** O bloco dos itens da comanda gravada (o painel e esta tela leem igual). */
  itemsBlock: string
  items: ViewItem[]
  additions: { createdAt: string; subtotalCents: number; itemsBlock: string; items: ViewItem[] }[]
  subtotalCents: number
  fee: { kind: string | null; cents: number; zone: string | null }
  totalCents: number
  paymentMethod: PaymentMethod | null
  changeForCents: number | null
  antecipado: boolean
  /** Cada situação e cada acréscimo, com o horário real registrado no banco. */
  events: { kind: 'status' | 'itens'; status: string; at: string }[]
}

/** Só nestas situações o cliente ainda pode acrescentar itens (conferido também no banco). */
export const ADDABLE_STATUSES: readonly OrderStatus[] = ['novo', 'preparando']

/** Quanto tempo o cliente ainda consulta um pedido. */
export const RETENTION_DAYS = 30
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const cents = (value: unknown) => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0)

function parseItems(raw: unknown): ViewItem[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!isRecord(entry) || !text(entry.name)) return []
    const quantity = typeof entry.quantity === 'number' && Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1
    return [{ name: text(entry.name), quantity, totalCents: cents(entry.totalCents ?? entry.total_cents), note: text(entry.note) || null }]
  })
}

/** Lê a visão vinda da função (ou do modo de demonstração). O que não dá para ler fica de fora. */
export function parseOrderView(raw: unknown): OrderView | null {
  if (!isRecord(raw)) return null
  const status = ORDER_STATUSES.find((candidate) => candidate === raw.status)
  if (!text(raw.id) || !text(raw.code) || !status) return null
  const address = isRecord(raw.address)
    ? { street: text(raw.address.street), number: text(raw.address.number), district: text(raw.address.district), reference: text(raw.address.reference) || null }
    : null
  const fee = isRecord(raw.fee) ? raw.fee : {}
  const change = raw.changeForCents
  return {
    id: text(raw.id),
    code: text(raw.code),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt) || text(raw.createdAt),
    status,
    fulfillment: DELIVERY_TYPES.find((candidate) => candidate === raw.fulfillment) ?? null,
    address: raw.fulfillment === 'entrega' ? address : null,
    itemsBlock: text(raw.itemsBlock),
    items: parseItems(raw.items),
    additions: Array.isArray(raw.additions)
      ? raw.additions.flatMap((entry) =>
          isRecord(entry) ? [{ createdAt: text(entry.createdAt), subtotalCents: cents(entry.subtotalCents), itemsBlock: text(entry.itemsBlock), items: parseItems(entry.items) }] : [],
        )
      : [],
    subtotalCents: cents(raw.subtotalCents),
    fee: { kind: text(fee.kind) || null, cents: cents(fee.cents), zone: text(fee.zone) || null },
    totalCents: cents(raw.totalCents),
    paymentMethod: PAYMENT_METHODS.find((method) => method.id === raw.paymentMethod)?.id ?? null,
    changeForCents: typeof change === 'number' && Number.isSafeInteger(change) && change >= 0 ? change : null,
    antecipado: raw.antecipado === true,
    events: Array.isArray(raw.events)
      ? raw.events.flatMap((entry) =>
          isRecord(entry) && (entry.kind === 'status' || entry.kind === 'itens') && text(entry.at) ? [{ kind: entry.kind, status: text(entry.status), at: text(entry.at) }] : [],
        )
      : [],
  }
}

/** Um pedido como a função lê do banco (com a chave de servidor). */
export type OrderRecord = {
  id: string
  code: string
  created_at: string
  updated_at: string | null
  status: string
  customer_user_id: string | null
  fulfillment: string
  address: unknown
  delivery_fee: string
  delivery_fee_cents: number
  delivery_zone: string | null
  payment_method: string
  change_for_cents: number | null
  subtotal_cents: number
  total_cents: number
  antecipado: boolean
  items: unknown
  message: string
  additions: unknown
}

export type EventRecord = { kind: string; status: string; created_at: string }

function viewItems(raw: unknown) {
  return Array.isArray(raw)
    ? raw.flatMap((entry) => (isRecord(entry) && typeof entry.name === 'string' ? [{ name: entry.name, quantity: entry.quantity, totalCents: entry.total_cents, note: entry.note ?? null }] : []))
    : []
}

/** A visão reduzida do pedido para o próprio cliente. */
export function customerView(order: OrderRecord, events: EventRecord[]): OrderView {
  const address = isRecord(order.address) ? order.address : null
  return {
    id: order.id,
    code: order.code,
    createdAt: order.created_at,
    updatedAt: order.updated_at ?? order.created_at,
    status: order.status as OrderStatus,
    fulfillment: order.fulfillment as OrderView['fulfillment'],
    address:
      order.fulfillment === 'entrega' && address
        ? { street: String(address.street ?? ''), number: String(address.number ?? ''), district: String(address.district ?? ''), reference: typeof address.reference === 'string' ? address.reference : null }
        : null,
    itemsBlock: orderItemsBlock(order.message),
    items: viewItems(order.items) as OrderView['items'],
    additions: (Array.isArray(order.additions) ? order.additions : []).flatMap((entry) =>
      isRecord(entry)
        ? [
            {
              createdAt: String(entry.created_at ?? ''),
              subtotalCents: typeof entry.subtotal_cents === 'number' ? entry.subtotal_cents : 0,
              itemsBlock: typeof entry.itemsBlock === 'string' ? entry.itemsBlock : '',
              items: viewItems(entry.items) as OrderView['items'],
            },
          ]
        : [],
    ),
    subtotalCents: order.subtotal_cents,
    fee: { kind: order.delivery_fee, cents: order.delivery_fee_cents, zone: order.delivery_zone },
    totalCents: order.total_cents,
    paymentMethod: order.payment_method as OrderView['paymentMethod'],
    changeForCents: order.change_for_cents,
    antecipado: order.antecipado,
    events: events.flatMap((event) => (event.kind === 'status' || event.kind === 'itens' ? [{ kind: event.kind, status: event.status, at: event.created_at }] : [])),
  }
}
