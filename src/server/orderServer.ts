/**
 * Registro do pedido no servidor (função `pedido` do Supabase, pedido de 2026-11-17, opção A).
 *
 * Recebe o carrinho do jeito que o site guarda, os dados do cliente e o pagamento. Lê as mudanças
 * do vendedor no banco e refaz tudo com as mesmas regras do site: itens que existem, esgotados,
 * loja aberta ou fechada, dados do cliente, frete do bairro, troco e preços. Só grava quando o
 * total bate com o que o cliente viu; o código sai em sequência (ADS-0001, ADS-0002...).
 *
 * A chave de repetição vem do id da tentativa sorteado no aparelho (2026-11-20; antes, do conteúdo do pedido): o mesmo pedido
 * enviado de novo (toque duplo, página recarregada) devolve o mesmo código, e ninguém consegue
 * ler um pedido gravado sem saber o conteúdo dele inteiro (que inclui ids sorteados no aparelho).
 *
 * Funções puras com o banco por fora (`OrderDeps`): testadas sem Supabase.
 */
import { cartItemProblem, cartTotalCents, lineTotalCents, parseCart } from '../features/cart/cart.ts'
import { getStoreSettings } from '../features/catalog/catalogState.ts'
import { type CustomerDraft, checkCustomer, feeCents, parseCustomerDraft } from '../features/checkout/delivery.ts'
import { EMPTY_PAYMENT, PAYMENT_METHODS, type PaymentDraft, allowedMethods, checkPayment, paymentLabel, paymentProblemText } from '../features/checkout/payment.ts'
import { buildOrderMessage } from '../features/orders/orderMessage.ts'
import { type OrderRow, itemName, orderRowFields } from '../features/orders/orderRow.ts'
import { effectiveStatus } from '../features/store-hours/hours.ts'
import type { ChangeRow } from '../services/supabaseRest.ts'
import { toWhatsAppNumber } from '../utils/whatsapp.ts'
import { changedSelection, loadServerCatalog } from './serverCatalog.ts'

/** Tamanho máximo do carrinho recebido (texto), e de linhas nele. */
export const MAX_CART_LENGTH = 200_000
export const MAX_LINES = 60

/** Marca do código na comanda, trocada pelo código de verdade depois de sair o número. */
const CODE_MARK = '{{CODIGO_DO_PEDIDO}}'

export type { ItemSnapshot, OrderRow } from '../features/orders/orderRow.ts'

/** O que volta do banco para responder ao cliente. */
export type StoredOrder = {
  id: string
  code: string
  message: string
  total_cents: number
  whatsapp: string
  created_at: string
  customer_user_id: string | null
}

export type OrderDeps = {
  /** As mudanças do vendedor (tabela `catalog_changes`). */
  readChanges(): Promise<ChangeRow[]>
  /** O cardápio do banco: `catalogo_publico()` com a chave de servidor (2026-11-21). */
  readCatalog(): Promise<unknown>
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
  // Acompanhamento e acréscimo (2026-11-20).
  | 'sem-sessao'
  | 'nao-encontrado'
  | 'expirado'
  | 'situacao'
  | 'troco'
  | 'carrinho-vazio'
  | 'item-indisponivel'
  | 'esgotado'
  | 'loja-fechada'
  | 'dados-invalidos'
  | 'pagamento-invalido'
  | 'total-mudou'

export type OrderResponse =
  | {
      ok: true
      /** O id do pedido (para o acompanhamento) e se ele ficou ligado à sessão do cliente. */
      id: string
      code: string
      createdAt: string
      tracked: boolean
      totalCents: number
      repeated: boolean
      /** A comanda e o WhatsApp da loja: só o site antigo (antes de 2026-11-20) usa. */
      message: string
      whatsapp: string
    }
  | {
      ok: false
      reason: RejectReason
      detail?: string
      totalCents?: number
      /** Preço mudou (2026-11-21): cada item com o preço de agora, para o cliente conferir. */
      items?: { name: string; quantity: number; totalCents: number }[]
    }

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

type OrderInput = { cart: string; customer: CustomerDraft; payment: PaymentDraft; expectedTotalCents: number; attemptId: string | null }

/** O id de uma tentativa de finalização, sorteado no aparelho (2026-11-20). */
export const ATTEMPT_ID = /^[A-Za-z0-9-]{16,64}$/

function parseInput(raw: unknown): OrderInput | null {
  if (!isRecord(raw)) return null
  const { cart, expectedTotalCents, attemptId } = raw
  if (typeof cart !== 'string' || cart.length > MAX_CART_LENGTH) return null
  if (typeof expectedTotalCents !== 'number' || !Number.isSafeInteger(expectedTotalCents) || expectedTotalCents < 0) return null
  if (attemptId !== undefined && (typeof attemptId !== 'string' || !ATTEMPT_ID.test(attemptId))) return null
  return {
    cart,
    customer: parseCustomerDraft(raw.customer),
    payment: parsePayment(raw.payment),
    expectedTotalCents,
    attemptId: typeof attemptId === 'string' ? attemptId : null,
  }
}

/** O pagamento como o site manda (também no acréscimo). */
export { parsePayment }

/** Quantas linhas o carrinho recebido diz ter: usado também no acréscimo. */
export function cartLines(cart: string): number {
  return declaredLines(cart)
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

type Prepared = { ok: true; row: Omit<OrderRow, 'attempt_key' | 'number' | 'code' | 'customer_user_id'> }

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
  // Escolha que não vale mais como foi enviada (limite do grupo, complemento fora do produto).
  const changed = changedSelection(input.cart, cart)
  if (changed) return reject('item-indisponivel', changed)

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
  // Forma de pagamento desligada nas Configurações da loja (2026-11-21).
  if (!allowedMethods(settings.payments, settings.pix.enabled).includes(paymentCheck.payment.method)) {
    return reject('pagamento-invalido', `A loja não está aceitando ${paymentLabel(paymentCheck.payment.method)} agora. Escolha outra forma de pagamento.`)
  }
  if (totalCents !== input.expectedTotalCents) {
    return { ok: false, reason: 'total-mudou', totalCents, items: cart.items.map((item) => ({ name: itemName(item), quantity: item.quantity, totalCents: lineTotalCents(item) })) }
  }

  const { payment } = paymentCheck
  const antecipado = !status.open
  const message = buildOrderMessage({ cart, customer, payment, sentAt: now, antecipado, code: CODE_MARK })
  return { ok: true, row: orderRowFields({ cart, customer, payment, antecipado, message, whatsapp: toWhatsAppNumber(settings.contact.whatsapp) }) }
}

const accepted = (order: StoredOrder, repeated: boolean): OrderResponse => ({
  ok: true,
  id: order.id,
  code: order.code,
  createdAt: order.created_at,
  tracked: order.customer_user_id !== null,
  totalCents: order.total_cents,
  repeated,
  message: order.message,
  whatsapp: order.whatsapp,
})

/**
 * A chave de repetição: com o id da tentativa que o site sorteou (2026-11-20), o mesmo pedido
 * reenviado por toque duplo ou internet caída devolve o mesmo código, e um pedido igual feito
 * depois é outro pedido. Sem o id (site antigo), o resumo do conteúdo, como antes.
 */
async function attemptKeyOf(input: OrderInput, deps: OrderDeps): Promise<string> {
  return deps.sha256(input.attemptId ? `tentativa:${input.attemptId}` : JSON.stringify([input.cart, input.customer, input.payment]))
}

/**
 * Confere e grava o pedido. `customerId`: a sessão anônima do cliente, já conferida (o pedido fica
 * ligado a ela para o acompanhamento); sem sessão, o pedido é gravado do mesmo jeito, sem
 * acompanhamento. Erro do banco (rede, chave) sobe: a função responde 500.
 */
export async function handleOrder(raw: unknown, deps: OrderDeps, customerId: string | null = null): Promise<OrderResponse> {
  const input = parseInput(raw)
  if (!input) return reject('pedido-invalido')

  const attemptKey = await attemptKeyOf(input, deps)
  const existing = await deps.findOrder(attemptKey)
  if (existing) {
    // A mesma tentativa vinda de outra sessão: não devolve o pedido de ninguém.
    if (existing.customer_user_id && customerId && existing.customer_user_id !== customerId) return reject('pedido-invalido')
    return accepted(existing, true)
  }

  // O cardápio e as configurações do banco (2026-11-21). Daqui até a comanda ficar pronta, nada de
  // await: o cardápio é um estado do módulo.
  await loadServerCatalog(deps)
  const prepared = prepare(input, deps.now())
  if (!prepared.ok) return prepared

  const number = await deps.nextNumber()
  const code = orderCode(number)
  const row: OrderRow = {
    ...prepared.row,
    attempt_key: attemptKey,
    number,
    code,
    message: prepared.row.message.replace(CODE_MARK, code),
    customer_user_id: customerId,
  }
  const stored = (await deps.insertOrder(row)) ?? (await deps.findOrder(attemptKey))
  if (!stored) throw new Error('O pedido não foi gravado.')
  return accepted(stored, stored.code !== code)
}
