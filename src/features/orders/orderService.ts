/**
 * Envio do pedido: ponto único que o carrinho usa.
 *
 * - **Sem o Supabase ligado:** o pedido vai só pela mensagem do WhatsApp (como desde 2026-11-14).
 * - **Com o Supabase ligado (pedido de 2026-11-17, opção A):** antes do WhatsApp, o site manda o
 *   pedido à função `pedido`, que confere os preços e as regras no servidor, grava com o código
 *   (ADS-0001) e devolve a comanda com o código. Repetir o mesmo pedido devolve o mesmo código.
 * - **Falha de internet ou do servidor (opção 1):** o carrinho oferece "Tentar de novo" e "Enviar
 *   mesmo assim pelo WhatsApp", com a comanda marcada como não registrada.
 *
 * Em todos os casos o pedido só chega à loja quando o cliente toca em Enviar no WhatsApp.
 */
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'
import type { RejectReason } from '../../server/orderServer.ts'
import { type Cart, serializeCart } from '../cart/cart.ts'
import { getStoreSettings } from '../catalog/catalogStore.ts'
import type { CustomerDraft } from '../checkout/delivery.ts'
import type { PaymentDraft } from '../checkout/payment.ts'
import { type OrderDraft, buildOrderMessage } from './orderMessage.ts'

/** O que o carrinho manda à função: o servidor confere tudo de novo. */
export type OrderSubmission = { cart: Cart; customer: CustomerDraft; payment: PaymentDraft; expectedTotalCents: number }

export type FunctionConfig = { url: string; key: string }

export type SubmitResult =
  | { kind: 'registered'; code: string; message: string; whatsapp: string; totalCents: number }
  | { kind: 'rejected'; reason: RejectReason; detail?: string; totalCents?: number }
  | { kind: 'failed'; why: 'rede' | 'servidor' | 'tempo' | 'resposta' }

/** Recusas que o cliente resolve no carrinho; as outras viram falha (com o envio sem registro). */
const FIXABLE: readonly RejectReason[] = ['esgotado', 'loja-fechada', 'dados-invalidos', 'pagamento-invalido', 'total-mudou', 'item-indisponivel']

/** Tempo máximo esperando a função antes de oferecer o envio sem registro. */
export const SUBMIT_TIMEOUT_MS = 15_000

export function orderFunctionUrl({ url }: FunctionConfig): string {
  return `${url.replace(/\/+$/, '')}/functions/v1/pedido`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

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
      headers: {
        'Content-Type': 'application/json',
        apikey: config.key,
        // A chave anon antiga é um JWT: vale também como Bearer (a publishable, não).
        ...(config.key.startsWith('eyJ') ? { Authorization: `Bearer ${config.key}` } : {}),
      },
      body: JSON.stringify({ cart: serializeCart(order.cart), customer: order.customer, payment: order.payment, expectedTotalCents: order.expectedTotalCents }),
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
    if (body.ok === true && typeof body.code === 'string' && typeof body.message === 'string' && typeof body.whatsapp === 'string' && typeof body.totalCents === 'number') {
      return { kind: 'registered', code: body.code, message: body.message, whatsapp: body.whatsapp, totalCents: body.totalCents }
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

/**
 * Link que abre a conversa com a loja já com a comanda escrita (feita no aparelho). Quem envia é o
 * cliente. O número é o WhatsApp da loja em "Horários e Contato" (pedido de 2026-11-17).
 */
export function orderWhatsAppUrl(order: OrderDraft): string {
  return buildWhatsAppUrl(getStoreSettings().contact.whatsapp, buildOrderMessage(order))
}
