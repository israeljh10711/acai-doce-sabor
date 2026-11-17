/**
 * Texto do pedido que vai para o WhatsApp da loja, no modelo pedido em 2026-11-14:
 * itens com tudo o que foi escolhido, total, forma de pagamento e troco.
 * Usa o negrito do WhatsApp (`*texto*`). Os itens das gavetas (picolés, bebidas, doces...)
 * entram com o sabor escolhido (pedido de 2026-11-15).
 */
import { formatBRL } from '../../utils/money.ts'
import {
  type Cart,
  type CartItem,
  cartTotalCents,
  choiceText,
  describeExtra,
  lineTotalCents,
  summarizeSelection,
  unitPriceCents,
} from '../cart/cart.ts'
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

  for (const item of cart.items) lines.push(...itemLines(item), '')

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

/** Linhas de um item: título com quantidade e valor, e o que foi escolhido. */
function itemLines(item: CartItem): string[] {
  const each = item.quantity > 1 ? ` (${formatBRL(unitPriceCents(item))} cada)` : ''
  const price = `${formatBRL(lineTotalCents(item))}${each}`

  if (item.kind === 'extra') {
    const { name, rows } = describeExtra(item)
    return [`*${item.quantity}x ${name}* — ${price}`, ...rows.map((row) => `• ${row.label}: ${row.value}`)]
  }

  const summary = summarizeSelection(item.slug, item.selection)
  const title = summary.sizeLabel ? `${summary.productName} (${summary.sizeLabel})` : summary.productName
  const lines = [`*${item.quantity}x ${title}* — ${price}`]
  // Completo (pedido de 2026-11-16): logo abaixo do título, com o que o cliente tirou.
  if (summary.montagem) lines.push(`• Montagem: ${summary.montagem}`)
  if (summary.flavorName) lines.push(`• ${summary.flavorLabel}: ${summary.flavorName}`)
  for (const section of summary.sections) {
    const label = MESSAGE_GROUP_LABELS[section.group] ?? section.label
    lines.push(`• ${label}: ${section.items.map(choiceText).join(', ')}`)
  }
  return lines
}
