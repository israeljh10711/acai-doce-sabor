/**
 * Texto do pedido que vai para o WhatsApp da loja, no modelo pedido em 2026-11-14:
 * itens com tudo o que foi escolhido, total, forma de pagamento e troco.
 * Usa o negrito do WhatsApp (`*texto*`).
 */
import { formatBRL } from '../../utils/money.ts'
import { type Cart, cartTotalCents, choiceText, lineTotalCents, summarizeSelection } from '../cart/cart.ts'
import type { ToppingGroupId } from '../catalog/menu.ts'
import { type Payment, paymentLabel } from '../checkout/payment.ts'

const SEPARATOR = '-----------------------------------'

/** Nome do grupo na mensagem, quando é diferente do personalizador. */
const MESSAGE_GROUP_LABELS: Partial<Record<ToppingGroupId, string>> = { syrup: 'Caldas/Cremes' }

export type OrderMessageInfo = {
  /** Código do pedido, quando o banco de pedidos existir e devolver um. */
  code?: string
}

export function buildOrderMessage(cart: Cart, payment: Payment, { code }: OrderMessageInfo = {}): string {
  const totalCents = cartTotalCents(cart)
  const lines: string[] = ['*NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍨']
  if (code) lines.push(`Pedido ${code}`)
  lines.push('', '*ITENS DO PEDIDO:*')

  for (const item of cart.items) {
    const summary = summarizeSelection(item.slug, item.selection)
    const each = item.quantity > 1 ? ` (${formatBRL(summary.unitCents)} cada)` : ''
    lines.push(`*${item.quantity}x ${summary.productName} (${summary.sizeLabel})* — ${formatBRL(lineTotalCents(item))}${each}`)
    if (summary.flavorName) lines.push(`• Sabor: ${summary.flavorName}`)
    for (const section of summary.sections) {
      const label = MESSAGE_GROUP_LABELS[section.group] ?? section.label
      lines.push(`• ${label}: ${section.items.map(choiceText).join(', ')}`)
    }
    lines.push('')
  }

  lines.push(SEPARATOR, `*TOTAL DO PEDIDO: ${formatBRL(totalCents)}*`, `*FORMA DE PAGAMENTO:* ${paymentLabel(payment.method)}`)
  if (payment.method === 'dinheiro') {
    lines.push(
      payment.changeForCents === null
        ? '*TROCO:* Não preciso de troco (valor exato)'
        : `*TROCO PARA:* ${formatBRL(payment.changeForCents)} *(Levar troco de ${formatBRL(payment.changeForCents - totalCents)})*`,
    )
  }
  if (payment.method === 'pix') lines.push('Envio o comprovante do Pix nesta conversa.')
  return lines.join('\n')
}
