/**
 * Registro do pedido no servidor (função `pedido` do Supabase, pedido de 2026-11-17, opção A).
 *
 * Recebe o carrinho do jeito que o site guarda, os dados do cliente e o pagamento. Lê as mudanças
 * do vendedor no banco e refaz tudo com as mesmas regras do site: itens que existem, esgotados,
 * loja aberta ou fechada, dados do cliente, frete do bairro, troco e preços. Só grava quando o
 * total bate com o que o cliente viu; o código sai em sequência (ADS-0001, ADS-0002...).
 *
 * A chave de repetição é calculada aqui, a partir do conteúdo inteiro do pedido: o mesmo pedido
 * enviado de novo (toque duplo, página recarregada) devolve o mesmo código, e ninguém consegue
 * ler um pedido gravado sem saber o conteúdo dele inteiro (que inclui ids sorteados no aparelho).
 *
 * Funções puras com o banco por fora (`OrderDeps`): testadas sem Supabase.
 */
import { type Cart, type CartItem, cartItemProblem, cartTotalCents, describeExtra, lineTotalCents, parseCart, serializeCart, summarizeSelection, unitPriceCents } from '../features/cart/cart.ts'
import { getStoreSettings, setCatalogChanges } from '../features/catalog/catalogState.ts'
import { type CustomerDraft, type DeliveryFee, type DeliveryType, checkCustomer, feeCents, parseCustomerDraft } from '../features/checkout/delivery.ts'
import { gpsMapsUrl } from '../features/checkout/gps.ts'
import { EMPTY_PAYMENT, PAYMENT_METHODS, type PaymentDraft, type PaymentMethod, checkPayment, paymentProblemText } from '../features/checkout/payment.ts'
import { buildOrderMessage } from '../features/orders/orderMessage.ts'
import { effectiveStatus } from '../features/store-hours/hours.ts'
import { changesFromRows } from '../services/supabaseBackend.ts'
import type { ChangeRow } from '../services/supabaseRest.ts'
import { toWhatsAppNumber } from '../utils/whatsapp.ts'

/** Tamanho máximo do carrinho recebido (texto), e de linhas nele. */
export const MAX_CART_LENGTH = 200_000
export const MAX_LINES = 60

/** Marca do código na comanda, trocada pelo código de verdade depois de sair o número. */
const CODE_MARK = '{{CODIGO_DO_PEDIDO}}'

export type ItemSnapshot = { name: string; quantity: number; unit_cents: number; total_cents: number; note?: string }

/** A linha gravada na tabela `orders` (cópia de nomes e preços do momento da compra). */
export type OrderRow = {
  attempt_key: string
  number: number
  code: string
  message: string
  whatsapp: string
  customer_name: string
  customer_phone: string | null
  /** A modalidade (pedido de 2026-11-20): entrega, retirada (levar) ou local (comer na loja). */
  fulfillment: DeliveryType
  address: { street: string; number: string; district: string; reference: string | null } | null
  delivery_fee: DeliveryFee['kind']
  delivery_fee_cents: number
  delivery_zone: string | null
  /** GPS anexado pelo cliente: só na entrega, os três juntos ou nenhum. */
  customer_lat: number | null
  customer_lng: number | null
  maps_url: string | null
  payment_method: PaymentMethod
  change_for_cents: number | null
  subtotal_cents: number
  total_cents: number
  antecipado: boolean
  items: ItemSnapshot[]
  cart: unknown
}

/** O que volta do banco para responder ao cliente. */
export type StoredOrder = { code: string; message: string; total_cents: number; whatsapp: string }

export type OrderDeps = {
  /** As mudanças do vendedor (tabela `catalog_changes`). */
  readChanges(): Promise<ChangeRow[]>
  findOrder(attemptKey: string): Promise<StoredOrder | null>
  /** O próximo número da sequência dos pedidos. */
  nextNumber(): Promise<number>
  /** Grava; `null` quando a mesma chave já foi gravada (duas tentativas iguais ao mesmo tempo). */
  insertOrder(row: OrderRow): Promise<StoredOrder | null>
  now(): number
  sha256(text: string): Promise<string>
}

export type RejectReason =
  | 'pedido-invalido'
  | 'carrinho-vazio'
  | 'item-indisponivel'
  | 'esgotado'
  | 'loja-fechada'
  | 'dados-invalidos'
  | 'pagamento-invalido'
  | 'total-mudou'

export type OrderResponse =
  | { ok: true; code: string; message: string; totalCents: number; whatsapp: string; repeated: boolean }
  | { ok: false; reason: RejectReason; detail?: string; totalCents?: number }

type Rejection = Extract<OrderResponse, { ok: false }>

const reject = (reason: RejectReason, detail?: string): Rejection => (detail ? { ok: false, reason, detail } : { ok: false, reason })

/** "ADS-0001": o número do pedido com pelo menos 4 dígitos. */
export function orderCode(number: number): string {
  return `ADS-${String(number).padStart(4, '0')}`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function parsePayment(raw: unknown): PaymentDraft {
  if (!isRecord(raw)) return EMPTY_PAYMENT
  const method = PAYMENT_METHODS.find((candidate) => candidate.id === raw.method)?.id ?? null
  return { method, changeFor: typeof raw.changeFor === 'string' ? raw.changeFor.slice(0, 20) : '', exact: raw.exact === true }
}

type OrderInput = { cart: string; customer: CustomerDraft; payment: PaymentDraft; expectedTotalCents: number }

function parseInput(raw: unknown): OrderInput | null {
  if (!isRecord(raw)) return null
  const { cart, expectedTotalCents } = raw
  if (typeof cart !== 'string' || cart.length > MAX_CART_LENGTH) return null
  if (typeof expectedTotalCents !== 'number' || !Number.isSafeInteger(expectedTotalCents) || expectedTotalCents < 0) return null
  return { cart, customer: parseCustomerDraft(raw.customer), payment: parsePayment(raw.payment), expectedTotalCents }
}

/** Quantas linhas o carrinho recebido diz ter (para saber se alguma ficou de fora na leitura). */
function declaredLines(cart: string): number {
  try {
    const data: unknown = JSON.parse(cart)
    return isRecord(data) && Array.isArray(data.items) ? data.items.length : 0
  } catch {
    return 0
  }
}

function itemName(item: CartItem): string {
  if (item.kind === 'extra') return describeExtra(item).name
  const summary = summarizeSelection(item.slug, item.selection)
  return summary.sizeLabel ? `${summary.productName} (${summary.sizeLabel})` : summary.productName
}

function snapshot(cart: Cart): ItemSnapshot[] {
  return cart.items.map((item) => ({
    name: itemName(item),
    quantity: item.quantity,
    unit_cents: unitPriceCents(item),
    total_cents: lineTotalCents(item),
    ...(item.note ? { note: item.note } : {}),
  }))
}

type Prepared = { ok: true; row: Omit<OrderRow, 'attempt_key' | 'number' | 'code'> }

/**
 * Confere o pedido com o cardápio em uso e monta a linha e a comanda (com a marca do código).
 * Tudo síncrono: o cardápio é um estado do módulo, e outra chamada não pode trocá-lo no meio.
 */
function prepare(input: OrderInput, now: number): Prepared | Rejection {
  const lines = declaredLines(input.cart)
  if (lines > MAX_LINES) return reject('pedido-invalido')
  const cart = parseCart(input.cart)
  if (cart.items.length === 0) return reject(lines === 0 ? 'carrinho-vazio' : 'item-indisponivel')
  if (cart.items.length !== lines) return reject('item-indisponivel')

  const soldOut = cart.items.flatMap((item) => {
    const problem = cartItemProblem(item)
    if (!problem) return []
    return problem.kind === 'item' ? [itemName(item)] : problem.names
  })
  if (soldOut.length > 0) return reject('esgotado', soldOut.join(', '))

  const settings = getStoreSettings()
  const status = effectiveStatus(now, settings)
  if (!status.open && settings.closedOrders === 'bloquear') return reject('loja-fechada', status.reopenText ?? undefined)

  const customerCheck = checkCustomer(input.customer, settings.delivery)
  if (!customerCheck.ok) return reject('dados-invalidos', Object.values(customerCheck.problems)[0])
  const { customer } = customerCheck

  const subtotalCents = cartTotalCents(cart)
  const totalCents = subtotalCents + feeCents(customer.fee)
  const paymentCheck = checkPayment(input.payment, totalCents)
  if (!paymentCheck.ok) return reject('pagamento-invalido', paymentProblemText(paymentCheck.problem, totalCents))
  if (totalCents !== input.expectedTotalCents) return { ok: false, reason: 'total-mudou', totalCents }

  const { payment } = paymentCheck
  const antecipado = !status.open
  const { fulfillment, fee } = customer
  // O GPS só existe na entrega (checkCustomer descarta nas outras), conferido e com o mesmo link da comanda.
  const gps = fulfillment.kind === 'entrega' ? fulfillment.gps : null
  return {
    ok: true,
    row: {
      message: buildOrderMessage({ cart, customer, payment, sentAt: now, antecipado, code: CODE_MARK }),
      whatsapp: toWhatsAppNumber(settings.contact.whatsapp),
      customer_name: customer.name,
      customer_phone: customer.phone,
      fulfillment: fulfillment.kind,
      address:
        fulfillment.kind === 'entrega'
          ? { street: fulfillment.street, number: fulfillment.number, district: fulfillment.district, reference: fulfillment.reference }
          : null,
      delivery_fee: fee.kind,
      delivery_fee_cents: feeCents(fee),
      delivery_zone: fee.kind === 'taxa' ? fee.zoneName : null,
      customer_lat: gps ? gps.lat : null,
      customer_lng: gps ? gps.lng : null,
      maps_url: gps ? gpsMapsUrl(gps) : null,
      payment_method: payment.method,
      change_for_cents: payment.method === 'dinheiro' ? payment.changeForCents : null,
      subtotal_cents: subtotalCents,
      total_cents: totalCents,
      antecipado,
      items: snapshot(cart),
      cart: JSON.parse(serializeCart(cart)) as unknown,
    },
  }
}

const accepted = (order: StoredOrder, repeated: boolean): OrderResponse => ({
  ok: true,
  code: order.code,
  message: order.message,
  totalCents: order.total_cents,
  whatsapp: order.whatsapp,
  repeated,
})

/** Confere e grava o pedido. Erro do banco (rede, chave) sobe: a função responde 500. */
export async function handleOrder(raw: unknown, deps: OrderDeps): Promise<OrderResponse> {
  const input = parseInput(raw)
  if (!input) return reject('pedido-invalido')

  const attemptKey = await deps.sha256(JSON.stringify([input.cart, input.customer, input.payment]))
  const existing = await deps.findOrder(attemptKey)
  if (existing) return accepted(existing, true)

  const rows = await deps.readChanges()
  // Daqui até a comanda ficar pronta, nada de await: o cardápio é um estado do módulo.
  setCatalogChanges(changesFromRows(rows))
  const prepared = prepare(input, deps.now())
  if (!prepared.ok) return prepared

  const number = await deps.nextNumber()
  const code = orderCode(number)
  const row: OrderRow = { ...prepared.row, attempt_key: attemptKey, number, code, message: prepared.row.message.replace(CODE_MARK, code) }
  const stored = (await deps.insertOrder(row)) ?? (await deps.findOrder(attemptKey))
  if (!stored) throw new Error('O pedido não foi gravado.')
  return accepted(stored, stored.code !== code)
}
