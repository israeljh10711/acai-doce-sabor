/**
 * Envio do pedido: ponto único que a tela de finalização usa.
 *
 * Regra do projeto (nota "Pedidos" no Obsidian): o pedido é gravado no banco, com os preços
 * conferidos no servidor, ANTES de o cliente ser levado ao WhatsApp. O banco (Supabase) entra
 * na Fase 6 e ainda não está configurado, então o envio fica desligado e a tela avisa.
 *
 * Quando o banco existir, `submitOrder` grava o pedido e devolve o código; a tela monta a
 * mensagem com `buildOrderMessage` e abre o WhatsApp oficial com `buildWhatsAppUrl`.
 */
import type { Cart } from '../cart/cart.ts'

export type SubmitResult = { ok: true; code: string } | { ok: false; reason: 'not-configured' | 'empty-cart' }

/** O envio pelo site só liga quando o banco de pedidos estiver configurado. */
export const ORDER_SUBMISSION_AVAILABLE = false

export async function submitOrder(cart: Cart): Promise<SubmitResult> {
  if (cart.items.length === 0) return { ok: false, reason: 'empty-cart' }
  return { ok: false, reason: 'not-configured' }
}
