/**
 * Painel de pedidos do Modo Vendedor (pedido de 2026-11-20, etapa 2, opção B): regras puras.
 *
 * Lê com cuidado as linhas da tabela `orders` (pedidos antigos sem as colunas novas, campos
 * estranhos), decide o próximo passo de cada pedido, filtra por situação e monta os textos do
 * cartão. Em Retirar e Comer no Local, o painel nunca mostra endereço nem GPS, mesmo que a linha
 * traga; o link do GPS é sempre refeito das coordenadas validadas.
 */
import { formatBRL } from '../../utils/money.ts'
import { DELIVERY_TYPES, type DeliveryType } from '../checkout/delivery.ts'
import { type GpsPoint, gpsMapsUrl, parseGpsPoint } from '../checkout/gps.ts'
import { PAYMENT_METHODS, type PaymentMethod } from '../checkout/payment.ts'
import { brasiliaTime } from '../store-hours/hours.ts'

/** As situações da tabela `orders` (SQL de 2026-11-17). */
export type OrderStatus = 'novo' | 'confirmado' | 'preparando' | 'pronto' | 'saiu_para_entrega' | 'concluido' | 'cancelado'

export const ORDER_STATUSES: readonly OrderStatus[] = ['novo', 'confirmado', 'preparando', 'pronto', 'saiu_para_entrega', 'concluido', 'cancelado']

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  pronto: 'Pronto',
  saiu_para_entrega: 'Saiu para entrega',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

/** Ainda precisam da equipe: de "novo" até "saiu para entrega". */
export const OPEN_STATUSES: readonly OrderStatus[] = ['novo', 'confirmado', 'preparando', 'pronto', 'saiu_para_entrega']

export type PanelOrder = {
  id: string
  number: number
  code: string
  /** Quando o pedido foi gravado (ms); 0 se a linha não disser. */
  createdAt: number
  status: OrderStatus
  customerName: string
  customerPhone: string | null
  /** `null`: modalidade que o painel não conhece (não deveria acontecer). */
  deliveryType: DeliveryType | null
  /** Só na entrega. */
  address: { street: string; number: string; district: string; reference: string | null } | null
  /** Só na entrega, e só com coordenadas válidas. */
  gps: GpsPoint | null
  mapsUrl: string | null
  fee: { kind: string | null; cents: number; zone: string | null }
  paymentMethod: PaymentMethod | null
  changeForCents: number | null
  subtotalCents: number
  totalCents: number
  antecipado: boolean
  items: { name: string; quantity: number; totalCents: number; note: string | null }[]
  /** A comanda gravada (a mesma que foi para o WhatsApp). */
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const textOrNull = (value: unknown): string | null => text(value) || null
const cents = (value: unknown): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0)

function parseAddress(raw: unknown): PanelOrder['address'] {
  if (!isRecord(raw)) return null
  return { street: text(raw.street), number: text(raw.number), district: text(raw.district), reference: textOrNull(raw.reference) }
}

function parseItems(raw: unknown): PanelOrder['items'] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!isRecord(entry) || !text(entry.name)) return []
    const quantity = typeof entry.quantity === 'number' && Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1
    return [{ name: text(entry.name), quantity, totalCents: cents(entry.total_cents), note: textOrNull(entry.note) }]
  })
}

/** Uma linha da tabela `orders` → o pedido do painel. Sem id, código ou situação válida, `null`. */
export function parseOrderRow(raw: unknown): PanelOrder | null {
  if (!isRecord(raw)) return null
  const id = text(raw.id)
  const code = text(raw.code)
  const status = ORDER_STATUSES.find((candidate) => candidate === raw.status)
  if (!id || !code || !status) return null

  const deliveryType = DELIVERY_TYPES.find((candidate) => candidate === raw.fulfillment) ?? null
  const delivery = deliveryType === 'entrega'
  const gps = delivery ? parseGpsPoint({ lat: raw.customer_lat, lng: raw.customer_lng }) : null
  const createdAt = typeof raw.created_at === 'string' ? Date.parse(raw.created_at) : Number.NaN
  const change = raw.change_for_cents

  return {
    id,
    number: typeof raw.number === 'number' && Number.isSafeInteger(raw.number) ? raw.number : 0,
    code,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    status,
    customerName: text(raw.customer_name),
    customerPhone: textOrNull(raw.customer_phone),
    deliveryType,
    address: delivery ? parseAddress(raw.address) : null,
    gps,
    mapsUrl: gps ? gpsMapsUrl(gps) : null,
    fee: { kind: textOrNull(raw.delivery_fee), cents: cents(raw.delivery_fee_cents), zone: textOrNull(raw.delivery_zone) },
    paymentMethod: PAYMENT_METHODS.find((method) => method.id === raw.payment_method)?.id ?? null,
    changeForCents: typeof change === 'number' && Number.isSafeInteger(change) && change >= 0 ? change : null,
    subtotalCents: cents(raw.subtotal_cents),
    totalCents: cents(raw.total_cents),
    antecipado: raw.antecipado === true,
    items: parseItems(raw.items),
    message: typeof raw.message === 'string' ? raw.message : '',
  }
}

/** O próximo passo do pedido (o botão principal do cartão). Concluído ou cancelado: nenhum. */
export function nextStep(order: PanelOrder): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case 'novo':
      return { status: 'confirmado', label: 'Confirmar' }
    case 'confirmado':
      return { status: 'preparando', label: 'Preparando' }
    case 'preparando':
      return { status: 'pronto', label: 'Pronto' }
    case 'pronto':
      // Só a entrega sai da loja; retirar e comer no local terminam na mão do cliente.
      return order.deliveryType === 'entrega' ? { status: 'saiu_para_entrega', label: 'Saiu para entrega' } : { status: 'concluido', label: 'Concluído' }
    case 'saiu_para_entrega':
      return { status: 'concluido', label: 'Concluído' }
    default:
      return null
  }
}

/** Dá para cancelar até concluir. */
export function canCancel(order: PanelOrder): boolean {
  return OPEN_STATUSES.includes(order.status)
}

export type OrderFilter = 'andamento' | OrderStatus | 'todos'

export const ORDER_FILTERS: readonly { id: OrderFilter; label: string }[] = [
  { id: 'andamento', label: 'Em andamento' },
  { id: 'novo', label: 'Novos' },
  { id: 'confirmado', label: 'Confirmados' },
  { id: 'preparando', label: 'Preparando' },
  { id: 'pronto', label: 'Prontos' },
  { id: 'saiu_para_entrega', label: 'Saiu para entrega' },
  { id: 'concluido', label: 'Concluídos' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos' },
]

const matches = (order: PanelOrder, filter: OrderFilter) =>
  filter === 'todos' || (filter === 'andamento' ? OPEN_STATUSES.includes(order.status) : order.status === filter)

export function filterOrders(orders: readonly PanelOrder[], filter: OrderFilter): PanelOrder[] {
  return orders.filter((order) => matches(order, filter))
}

export function filterCounts(orders: readonly PanelOrder[]): Record<OrderFilter, number> {
  return Object.fromEntries(ORDER_FILTERS.map(({ id }) => [id, orders.filter((order) => matches(order, id)).length])) as Record<OrderFilter, number>
}

/** "Pix", "Cartão de crédito (levar maquininha)", "Dinheiro: troco para R$ 50,00 (levar R$ 16,00)". */
export function paymentText(order: PanelOrder): string {
  switch (order.paymentMethod) {
    case 'pix':
      return 'Pix'
    case 'credito':
    case 'debito': {
      const card = order.paymentMethod === 'credito' ? 'Cartão de crédito' : 'Cartão de débito'
      return order.deliveryType === 'entrega' ? `${card} (levar maquininha)` : card
    }
    case 'dinheiro': {
      if (order.changeForCents === null) return 'Dinheiro, sem troco'
      const base = `Dinheiro: troco para ${formatBRL(order.changeForCents)}`
      if (order.fee.kind === 'combinar') return `${base} (frete a combinar)`
      const due = order.changeForCents - order.totalCents
      return due > 0 ? `${base} (levar ${formatBRL(due)})` : base
    }
    default:
      return 'Não informado'
  }
}

/** A linha do frete no cartão, distinguindo grátis de a combinar. */
export function feeLine(order: PanelOrder): { label: string; value: string } {
  switch (order.fee.kind) {
    case 'retirada':
      return { label: 'Retirada na loja', value: 'Grátis' }
    case 'local':
      return { label: 'Consumo no local', value: 'Grátis' }
    case 'gratis':
      return { label: 'Frete', value: 'Grátis' }
    case 'combinar':
      return { label: 'Frete', value: 'A combinar' }
    case 'taxa':
      return { label: order.fee.zone ? `Frete (${order.fee.zone})` : 'Frete', value: order.fee.cents > 0 ? formatBRL(order.fee.cents) : 'Grátis' }
    default:
      return { label: 'Frete', value: order.fee.cents > 0 ? formatBRL(order.fee.cents) : '—' }
  }
}

/**
 * Os itens como saíram na comanda (montagem, "RETIRAR", extras, acompanhamentos, observação),
 * sem as marcas de negrito e itálico do WhatsApp. Sem a parte dos itens, nada.
 */
export function comandaItems(message: string): string[] {
  const lines = message.split('\n')
  const start = lines.findIndex((line) => line.includes('ITENS DO PEDIDO'))
  if (start === -1) return []
  const end = lines.findIndex((line, index) => index > start && line.startsWith('━'))
  const block = lines.slice(start + 1, end === -1 ? undefined : end).map((line) => line.replace(/[*_]/g, '').trimEnd())
  while (block.length > 0 && !block[0]) block.shift()
  while (block.length > 0 && !block.at(-1)) block.pop()
  return block
}

/** Os pedidos que chegaram agora: ainda não vistos e na situação "novo". */
export function newOrders(known: ReadonlySet<string>, orders: readonly PanelOrder[]): PanelOrder[] {
  return orders.filter((order) => order.status === 'novo' && !known.has(order.id))
}

/** O dia da loja vira às 5h de Brasília (a madrugada ainda é o dia anterior). */
const DAY_TURN = 5 * 60

/** Início do dia da loja do instante dado (ms). */
export function storeDayStart(now: number): number {
  const { minutes, seconds } = brasiliaTime(now)
  const sinceTurn = ((minutes - DAY_TURN + 1440) % 1440) * 60_000 + seconds * 1000 + (now % 1000)
  return now - sinceTurn
}

/** Desde quando o painel lê os pedidos: o começo do dia da loja (ISO, para o filtro do banco). */
export function ordersSince(now: number): string {
  return new Date(storeDayStart(now)).toISOString()
}
