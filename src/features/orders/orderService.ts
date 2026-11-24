/**
 * Envio do pedido: ponto único que o carrinho usa.
 *
 * Desde o pedido 100% no site (2026-11-20), o pedido é finalizado aqui, sem WhatsApp: o site manda
 * o pedido à função `pedido`, que confere os preços e as regras no servidor, grava com o código
 * (ADS-0001) e liga o pedido à sessão anônima do cliente (o token vai no `Authorization`). Só com
 * a resposta do servidor o site diz que o pedido foi recebido. `attemptId` identifica a tentativa:
 * mandar de novo (falha de internet, toque duplo) devolve o mesmo pedido, nunca grava outro.
 */
import type { RejectReason } from '../../server/orderServer.ts'
import { type Cart, serializeCart } from '../cart/cart.ts'
import type { CustomerDraft } from '../checkout/delivery.ts'
import type { PaymentDraft } from '../checkout/payment.ts'

/** O que o carrinho manda à função: o servidor confere tudo de novo. */
export type OrderSubmission = { cart: Cart; customer: CustomerDraft; payment: PaymentDraft; expectedTotalCents: number; attemptId?: string }

/** `token`: a sessão anônima do cliente (sem ela, o pedido é gravado, mas sem acompanhamento). */
export type FunctionConfig = { url: string; key: string; token?: string | null; requireSession?: boolean }

export type SubmitResult =
  | { kind: 'registered'; id: string | null; code: string; createdAt: string | null; tracked: boolean; totalCents: number; repeated: boolean }
  | { kind: 'rejected'; reason: RejectReason; detail?: string; totalCents?: number }
  | { kind: 'failed'; why: 'rede' | 'servidor' | 'tempo' | 'resposta' }

/** Recusas que o cliente resolve no carrinho; as outras viram falha (o cliente tenta de novo). */
const FIXABLE: readonly RejectReason[] = ['esgotado', 'loja-fechada', 'dados-invalidos', 'pagamento-invalido', 'total-mudou', 'item-indisponivel', 'sem-sessao']

/** Tempo máximo esperando a função antes de dizer que não deu para confirmar. */
export const SUBMIT_TIMEOUT_MS = 15_000

export function orderFunctionUrl({ url }: FunctionConfig): string {
  return `${url.replace(/\/+$/, '')}/functions/v1/pedido`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** O `Authorization`: a sessão do cliente; sem ela, a chave anon antiga (JWT) ou nada (publishable). */
function authorization(config: FunctionConfig): Record<string, string> {
  if (config.token) return { Authorization: `Bearer ${config.token}` }
  return config.key.startsWith('eyJ') ? { Authorization: `Bearer ${config.key}` } : {}
}

/** Manda o pedido à função `pedido` do Supabase e diz o que aconteceu. Nunca lança erro. */
export async function submitOrder(
  order: OrderSubmission,
  config: FunctionConfig,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  timeoutMs = SUBMIT_TIMEOUT_MS,
): Promise<SubmitResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(orderFunctionUrl(config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.key, ...authorization(config) },
      body: JSON.stringify({
        op: 'criar',
        ...(config.requireSession ? { requireSession: true } : {}),
        cart: serializeCart(order.cart),
        customer: order.customer,
        payment: order.payment,
        expectedTotalCents: order.expectedTotalCents,
        ...(order.attemptId ? { attemptId: order.attemptId } : {}),
      }),
      signal: controller.signal,
    })
    if (!response.ok) return { kind: 'failed', why: 'servidor' }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      return { kind: 'failed', why: 'resposta' }
    }
    if (!isRecord(body)) return { kind: 'failed', why: 'resposta' }
    if (body.ok === true && typeof body.code === 'string' && typeof body.totalCents === 'number') {
      const id = typeof body.id === 'string' ? body.id : null
      return {
        kind: 'registered',
        id,
        code: body.code,
        createdAt: typeof body.createdAt === 'string' ? body.createdAt : null,
        // Sem o id (função antiga), não dá para acompanhar, mesmo com a sessão.
        tracked: body.tracked === true && id !== null,
        totalCents: body.totalCents,
        repeated: body.repeated === true,
      }
    }
    if (body.ok === false && FIXABLE.includes(body.reason as RejectReason)) {
      return {
        kind: 'rejected',
        reason: body.reason as RejectReason,
        ...(typeof body.detail === 'string' ? { detail: body.detail } : {}),
        ...(typeof body.totalCents === 'number' ? { totalCents: body.totalCents } : {}),
      }
    }
    return { kind: 'failed', why: 'resposta' }
  } catch {
    return { kind: 'failed', why: controller.signal.aborted ? 'tempo' : 'rede' }
  } finally {
    clearTimeout(timer)
  }
}
