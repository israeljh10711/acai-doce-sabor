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

/**
 * As situações da tabela `orders`. Desde o painel ao vivo (2026-11-20), cada modalidade tem o seu
 * "pronto": `saiu_para_entrega` (out_for_delivery), `pronto_retirada` (ready_for_pickup) e
 * `pronto_consumo` (ready_for_dine_in). `confirmado` e `pronto` são do fluxo anterior e continuam
 * lidos nos pedidos antigos.
 */
export type OrderStatus =
  | 'novo'
  | 'confirmado'
  | 'preparando'
  | 'pronto'
  | 'pronto_retirada'
  | 'pronto_consumo'
  | 'saiu_para_entrega'
  | 'concluido'
  | 'cancelado'

export const ORDER_STATUSES: readonly OrderStatus[] = ['novo', 'confirmado', 'preparando', 'pronto', 'pronto_retirada', 'pronto_consumo', 'saiu_para_entrega', 'concluido', 'cancelado']

export const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  pronto: 'Pronto',
  pronto_retirada: 'Pronto para retirada',
  pronto_consumo: 'Pronto para consumo',
  saiu_para_entrega: 'Saiu para entrega',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

/** Ainda precisam da equipe: tudo menos concluído e cancelado. */
export const OPEN_STATUSES: readonly OrderStatus[] = ['novo', 'confirmado', 'preparando', 'pronto', 'pronto_retirada', 'pronto_consumo', 'saiu_para_entrega']

/** "Saiu / Pronto": o pedido já está com o entregador ou esperando o cliente. */
const READY_STATUSES: readonly OrderStatus[] = ['saiu_para_entrega', 'pronto', 'pronto_retirada', 'pronto_consumo']

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
  /** A comanda gravada no momento da compra. */
  message: string
  /** Os itens que o cliente acrescentou depois (2026-11-20), cada lote com a hora e o valor. */
  additions: OrderAddition[]
}

/**
 * Um lote acrescentado pelo cliente. `key`: o id único do lote, gravado pelo servidor (`attempt_key`,
 * a mesma tentativa nunca grava dois lotes); o painel o usa para avisar uma vez só por acréscimo.
 */
export type OrderAddition = { key: string; createdAt: number; subtotalCents: number; itemsBlock: string; items: PanelOrder['items'] }

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
    additions: parseAdditions(raw.additions),
  }
}

/** Os lotes acrescentados pelo cliente; o que não dá para ler fica de fora. */
function parseAdditions(raw: unknown): OrderAddition[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry, index) => {
    if (!isRecord(entry)) return []
    const at = typeof entry.created_at === 'string' ? Date.parse(entry.created_at) : Number.NaN
    // Sem a chave (não deveria acontecer): a hora e a posição identificam o lote.
    const key = text(entry.attempt_key) || `lote-${String(entry.created_at ?? '')}-${index}`
    return [{ key, createdAt: Number.isFinite(at) ? at : 0, subtotalCents: cents(entry.subtotal_cents), itemsBlock: typeof entry.itemsBlock === 'string' ? entry.itemsBlock : '', items: parseItems(entry.items) }]
  })
}

/**
 * O próximo passo do pedido (o botão principal do cartão), pelo fluxo do painel ao vivo
 * (2026-11-20): Novo → "Aceitar / Preparar" → Preparando → o "pronto" da modalidade → "✅ Concluir".
 * Retirar e Comer no Local nunca passam por "saiu para entrega". Concluído ou cancelado: nenhum.
 */
export function nextStep(order: PanelOrder): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case 'novo':
    case 'confirmado':
      return { status: 'preparando', label: 'Aceitar / Preparar' }
    case 'preparando':
      switch (order.deliveryType) {
        case 'entrega':
          return { status: 'saiu_para_entrega', label: '🛵 Saiu para Entrega' }
        case 'retirada':
          return { status: 'pronto_retirada', label: '🛍️ Pronto para Retirada' }
        case 'local':
          return { status: 'pronto_consumo', label: '🍨 Pronto para Consumo' }
        default:
          return { status: 'pronto', label: 'Pronto' }
      }
    case 'pronto':
    case 'pronto_retirada':
    case 'pronto_consumo':
    case 'saiu_para_entrega':
      return { status: 'concluido', label: '✅ Concluir' }
    default:
      return null
  }
}

/** Dá para cancelar até concluir. */
export function canCancel(order: PanelOrder): boolean {
  return OPEN_STATUSES.includes(order.status)
}

/** O "pronto" de cada modalidade (o passo antes de concluir). */
const READY_BY_TYPE: Record<DeliveryType, OrderStatus> = { entrega: 'saiu_para_entrega', retirada: 'pronto_retirada', local: 'pronto_consumo' }

/**
 * "↩ Voltar etapa" (2026-11-21): a etapa imediatamente anterior no mesmo fluxo de `nextStep`,
 * para desfazer um toque errado. Preparando volta para Novo; o "pronto" da modalidade volta para
 * Preparando; Concluído volta para o "pronto" da modalidade. Novo não tem etapa anterior, e um
 * cancelamento nunca é desfeito por aqui. Só situações que já existem e que o banco aceita para a
 * modalidade (`orders_status_modalidade_check`).
 */
export function previousStep(order: PanelOrder): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case 'preparando':
      return { status: 'novo', label: STATUS_LABEL.novo }
    case 'pronto':
    case 'pronto_retirada':
    case 'pronto_consumo':
    case 'saiu_para_entrega':
      return { status: 'preparando', label: STATUS_LABEL.preparando }
    case 'concluido': {
      const ready = order.deliveryType ? READY_BY_TYPE[order.deliveryType] : 'pronto'
      return { status: ready, label: STATUS_LABEL[ready] }
    }
    default:
      return null
  }
}

/**
 * A fila de produção (2026-11-21): do pedido que entrou primeiro para o mais novo, pela hora em que
 * foi feito (nunca pela última mudança). Pedido sem hora válida vai para o fim.
 */
export function queueOrder(orders: readonly PanelOrder[]): PanelOrder[] {
  const key = (order: PanelOrder) => (order.createdAt > 0 ? order.createdAt : Number.MAX_SAFE_INTEGER)
  return [...orders].sort((a, b) => key(a) - key(b) || a.number - b.number)
}

/** Para comparar sem acento, maiúsculas, espaços nem pontuação do código ("ads 0003" acha ADS-0003). */
const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
const compact = (value: string) => plain(value).replace(/[^a-z0-9]/g, '')

/**
 * Busca rápida do painel (2026-11-21), na lista que já está na tela (nenhuma consulta ao banco):
 * pelo código inteiro ou por parte dele, e pelo nome do cliente inteiro ou por parte dele. Mantém
 * a ordem recebida. Busca vazia: a lista inteira.
 */
export function searchOrders(orders: readonly PanelOrder[], query: string): PanelOrder[] {
  const words = plain(query)
  if (!words) return [...orders]
  const code = compact(query)
  return orders.filter((order) => plain(order.customerName).includes(words) || (code.length > 0 && compact(order.code).includes(code)))
}

/** "Há 12 min", "Há 1 h 05 min" desde que o pedido entrou (`null`: sem hora válida). */
export function elapsedText(createdAt: number, now: number): string | null {
  if (!createdAt || !Number.isFinite(createdAt) || !Number.isFinite(now)) return null
  const minutes = Math.max(0, Math.floor((now - createdAt) / 60_000))
  if (minutes < 1) return 'Há menos de 1 min'
  if (minutes < 60) return `Há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `Há ${hours} h` : `Há ${hours} h ${String(rest).padStart(2, '0')} min`
}

/**
 * O pedido passou do tempo que a loja configurou? (2026-11-21) O único tempo configurado é o
 * "Tempo" de entrega da loja (`deliveryTime`), então o alerta vale só para entregas em andamento,
 * e só quando esse tempo dá para ler em minutos (`limitMinutes`). Sem isso, nenhum alerta.
 */
export function isLate(order: PanelOrder, now: number, limitMinutes: number | null): boolean {
  if (limitMinutes === null || order.deliveryType !== 'entrega' || !OPEN_STATUSES.includes(order.status) || !order.createdAt) return false
  return now - order.createdAt > limitMinutes * 60_000
}

/** Os filtros rápidos do topo do painel (2026-11-20). Cancelado só aparece em "Todos". */
export type OrderFilter = 'andamento' | 'todos' | 'novos' | 'preparando' | 'saiu_pronto' | 'concluidos'

/** O filtro com que o painel abre (2026-11-21): a fila de trabalho, sem concluídos nem cancelados. */
export const DEFAULT_FILTER: OrderFilter = 'andamento'

export const ORDER_FILTERS: readonly { id: OrderFilter; label: string }[] = [
  { id: 'andamento', label: '⏳ Em andamento' },
  { id: 'todos', label: 'Todos' },
  { id: 'novos', label: '🆕 Novos' },
  { id: 'preparando', label: '🍨 Preparando' },
  { id: 'saiu_pronto', label: '🛵 Saiu / Pronto' },
  { id: 'concluidos', label: '✅ Concluídos' },
]

function matches(order: PanelOrder, filter: OrderFilter): boolean {
  switch (filter) {
    case 'andamento':
      return OPEN_STATUSES.includes(order.status)
    case 'todos':
      return true
    case 'novos':
      return order.status === 'novo'
    case 'preparando':
      return order.status === 'preparando' || order.status === 'confirmado'
    case 'saiu_pronto':
      return READY_STATUSES.includes(order.status)
    case 'concluidos':
      return order.status === 'concluido'
  }
}

export function filterOrders(orders: readonly PanelOrder[], filter: OrderFilter): PanelOrder[] {
  return orders.filter((order) => matches(order, filter))
}

export function filterCounts(orders: readonly PanelOrder[]): Record<OrderFilter, number> {
  return Object.fromEntries(ORDER_FILTERS.map(({ id }) => [id, orders.filter((order) => matches(order, id)).length])) as Record<OrderFilter, number>
}

/** "💠 Pix", "💳 Cartão de crédito (levar maquininha)", "💵 Dinheiro — Troco para R$ 50,00 (levar R$ 16,00)". */
export function paymentText(order: Pick<PanelOrder, 'paymentMethod' | 'changeForCents' | 'fee' | 'totalCents' | 'deliveryType'>): string {
  switch (order.paymentMethod) {
    case 'pix':
      return '💠 Pix'
    case 'credito':
    case 'debito': {
      const card = order.paymentMethod === 'credito' ? '💳 Cartão de crédito' : '💳 Cartão de débito'
      return order.deliveryType === 'entrega' ? `${card} (levar maquininha)` : card
    }
    case 'dinheiro': {
      // O troco só aparece quando o cliente informou.
      if (order.changeForCents === null) return '💵 Dinheiro'
      const base = `💵 Dinheiro — Troco para ${formatBRL(order.changeForCents)}`
      if (order.fee.kind === 'combinar') return `${base} (frete a combinar)`
      const due = order.changeForCents - order.totalCents
      return due > 0 ? `${base} (levar ${formatBRL(due)})` : base
    }
    default:
      return 'Não informado'
  }
}

/** A linha do frete no cartão, distinguindo grátis de a combinar. */
export function feeLine(order: Pick<PanelOrder, 'fee'>): { label: string; value: string } {
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

/** Um item da comanda, organizado para o cartão. */
export type ComandaItem = {
  quantity: number
  name: string
  /** "Isopor M", "Sabor: Nutella", "Copo 300 ml · Sabor: …". */
  details: string | null
  total: string
  /** "COMPLETO" ou "COMPLETO (todos os acompanhamentos)". */
  montagem: string | null
  /** O que o cliente tirou do Completo. */
  removed: string[]
  /** Cremes e extras pagos, com o valor. */
  paid: string | null
  /** Acompanhamentos grátis, por grupo. */
  included: { label: string; names: string }[]
  /** Escolhas dos itens das seções com mais de uma ("Sabor do sorvete", "Sabor da cobertura"). */
  rows: { label: string; value: string }[]
  note: string | null
}

const KEYCAP = '(?:[0-9]\\uFE0F\\u20E3|\\u{1F51F})+'
const ITEM_LINE = new RegExp(`^${KEYCAP} \\*(\\d+)x (.+?)\\*(?: \\((.+)\\))? — \\*(.+)\\*$`, 'u')
const unmark = (text: string) => text.replace(/[*_]/g, '').trim()
/** "✨ *Montagem:* COMPLETO" → ["Montagem", "COMPLETO"] (sem o emoji e as marcas). */
const labeled = (line: string, emoji: string): string | null => {
  if (!line.startsWith(emoji)) return null
  const rest = line.slice(emoji.length)
  const colon = rest.indexOf(':*')
  return colon === -1 ? null : unmark(rest.slice(colon + 2))
}

/**
 * Os itens da comanda gravada, organizados (painel ao vivo, 2026-11-20): quantidade, nome,
 * tamanho e sabor, Completo, o que foi tirado ("SEM"), pagos, acompanhamentos e observação. A
 * comanda é a do momento da compra, a mesma que foi para o WhatsApp. Linha que não é de item fica
 * de fora. Sem a parte dos itens, nada (o cartão usa a lista gravada).
 */
export function parseComandaItems(message: string): ComandaItem[] {
  const lines = message.split('\n')
  const start = lines.findIndex((line) => line.includes('ITENS DO PEDIDO'))
  if (start === -1) return []
  const items: ComandaItem[] = []
  for (const raw of lines.slice(start + 1)) {
    if (raw.startsWith('━')) break
    const header = ITEM_LINE.exec(raw)
    if (header) {
      items.push({
        quantity: Number(header[1]),
        name: unmark(header[2]),
        details: header[3] ? unmark(header[3]) : null,
        total: unmark(header[4]),
        montagem: null,
        removed: [],
        paid: null,
        included: [],
        rows: [],
        note: null,
      })
      continue
    }
    const item = items.at(-1)
    const line = raw.trim()
    if (!item || !line) continue
    const montagem = labeled(line, '✨')
    const removed = labeled(line, '🚫')
    const paid = labeled(line, '➕')
    const note = labeled(line, '📝')
    if (montagem !== null) item.montagem = montagem
    else if (removed !== null) item.removed = removed.split(', ').filter(Boolean)
    else if (paid !== null) item.paid = paid
    else if (note !== null) item.note = note
    else if (line.startsWith('• *')) {
      const colon = line.indexOf(':*')
      if (colon !== -1) item.rows.push({ label: unmark(line.slice(2, colon)), value: unmark(line.slice(colon + 2)) })
    } else if (line.startsWith('• ')) {
      const colon = line.indexOf(':')
      if (colon !== -1) item.included.push({ label: line.slice(2, colon).trim(), names: line.slice(colon + 1).trim() })
    }
  }
  return items
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
