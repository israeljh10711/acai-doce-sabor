/**
 * Envio do pedido: ponto único que o carrinho usa.
 *
 * Hoje (pedido do responsável de 2026-11-14) o pedido vai só pela mensagem do WhatsApp: o
 * carrinho monta a comanda e abre a conversa com a loja, e o pedido só chega quando o cliente
 * toca em Enviar. Não há banco de pedidos ainda.
 *
 * A regra do briefing original (nota "Pedidos" no Obsidian) é gravar o pedido no banco, com os
 * preços conferidos no servidor, ANTES de abrir o WhatsApp. Quando o banco (Supabase) existir,
 * `submitOrder` grava e devolve o código, e o carrinho passa a chamá-lo antes de abrir o
 * WhatsApp, pondo o código na mensagem. Até lá, o proprietário confere os valores na conversa.
 */
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'
import type { Cart } from '../cart/cart.ts'
import { getStoreSettings } from '../catalog/catalogStore.ts'
import { type OrderDraft, buildOrderMessage } from './orderMessage.ts'

export type SubmitResult = { ok: true; code: string } | { ok: false; reason: 'not-configured' | 'empty-cart' }

/** O banco de pedidos ainda não existe. */
export const ORDER_DATABASE_AVAILABLE = false

export async function submitOrder(cart: Cart): Promise<SubmitResult> {
  if (cart.items.length === 0) return { ok: false, reason: 'empty-cart' }
  return { ok: false, reason: 'not-configured' }
}

/**
 * Link que abre a conversa com a loja já com a comanda escrita. Quem envia é o cliente.
 * O número é o WhatsApp da loja em "Horários e Contato" (pedido de 2026-11-17).
 */
export function orderWhatsAppUrl(order: OrderDraft): string {
  return buildWhatsAppUrl(getStoreSettings().contact.whatsapp, buildOrderMessage(order))
}
