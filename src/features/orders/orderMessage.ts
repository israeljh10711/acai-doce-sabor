/**
 * Texto do pedido que vai para o WhatsApp da loja.
 *
 * Pronto para a finalização, mas ainda sem uso na tela: pela regra do projeto, o pedido é
 * gravado no banco antes de o cliente ser levado ao WhatsApp, e o banco (Fase 6) ainda não
 * existe. Ver `orderService.ts`.
 */
import { formatBRL } from '../../utils/money.ts'
import { type Cart, cartTotalCents, describeItem, lineTotalCents, unitPriceCents } from '../cart/cart.ts'

export type OrderMessageInfo = {
  /** Código devolvido pelo servidor ao gravar o pedido. */
  code: string
}

/** Mensagem do pedido: código, itens com tudo o que foi escolhido, valores e total. */
export function buildOrderMessage(cart: Cart, { code }: OrderMessageInfo): string {
  const lines: string[] = [`*Pedido ${code}*`, '']

  cart.items.forEach((item, index) => {
    const description = describeItem(item)
    const title = [description.productName, description.sizeName, description.flavorName].filter(Boolean).join(' · ')
    lines.push(`*${index + 1}. ${item.quantity}x ${title}*`)
    for (const { group, items } of description.included) lines.push(`${group}: ${items.join(', ')}`)
    for (const line of description.paid) {
      lines.push(`${line.quantity}x ${line.name}: + ${formatBRL(line.totalCents)}`)
    }
    lines.push(`Valor: ${item.quantity} x ${formatBRL(unitPriceCents(item))} = ${formatBRL(lineTotalCents(item))}`, '')
  })

  lines.push(`*Total: ${formatBRL(cartTotalCents(cart))}*`)
  return lines.join('\n')
}
