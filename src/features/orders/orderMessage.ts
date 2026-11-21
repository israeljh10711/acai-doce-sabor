/**
 * Comanda do pedido (o modelo aprovado em 2026-11-17; desde 2026-11-20 gravada com o pedido e lida
 * no painel do vendedor, sem passar pelo WhatsApp): dividida em
 * blocos, com emojis para cada informação, fácil de ler na hora do pico.
 * - cliente: nome, telefone (se escrito), a modalidade (pedido de 2026-11-20: entrega, retirar ou
 *   comer no local), o endereço e o link do GPS (só na entrega) ou o local da loja;
 * - itens numerados (1️⃣, 2️⃣...), com a montagem do Completo, o que o cliente tirou, os pagos com
 *   o valor, os acompanhamentos por grupo e a observação do item;
 * - resumo com subtotal, frete e total; forma de pagamento com troco.
 * Usa o negrito (`*texto*`) e o itálico (`_texto_`) no estilo do WhatsApp (o painel entende).
 */
import { formatBRL } from '../../utils/money.ts'
import { type Cart, type CartItem, cartTotalCents, describeExtra, lineTotalCents, summarizeSelection } from '../cart/cart.ts'
import { getStoreSettings } from '../catalog/catalogState.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { completeOmitted } from '../catalog/selection.ts'
import { type Customer, type DeliveryFee, type DeliveryType, type Fulfillment, feeCents } from '../checkout/delivery.ts'
import { gpsMapsUrl } from '../checkout/gps.ts'
import type { Payment } from '../checkout/payment.ts'
import { storePlaceText } from '../store/storeSettings.ts'

export type OrderDraft = {
  cart: Cart
  customer: Customer
  payment: Payment
  /** Quando o cliente tocou em enviar (ms), pelo relógio corrigido pelo servidor. */
  sentAt: number
  /** Loja fechada e o vendedor aceita pedido antecipado: a comanda avisa. */
  antecipado: boolean
  /** Código do pedido, quando o banco de pedidos existir e devolver um. */
  code?: string
}

const LINE = '━'.repeat(20)
const ITEM_INDENT = '   '
const GROUP_INDENT = '      '

const dateParts = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** "17/11/2026 às 15:42", no horário de Brasília. */
function dateTimeText(ms: number): string {
  const part = Object.fromEntries(dateParts.formatToParts(ms).map(({ type, value }) => [type, value]))
  return `${part.day}/${part.month}/${part.year} às ${part.hour}:${part.minute}`
}

/** Número do item com emoji: 1️⃣ a 9️⃣, 🔟; do 11 em diante, os dígitos em sequência (1️⃣1️⃣). */
export function keycap(n: number): string {
  if (n === 10) return '🔟'
  return [...String(n)].map((digit) => `${digit}️⃣`).join('')
}

/** "Creme de ninho (+R$ 3,00)", "2x Kit Kat (+R$ 8,00)", "2x Granola". */
const choiceText = (name: string, quantity: number, totalCents = 0) => {
  const base = quantity > 1 ? `${quantity}x ${name}` : name
  return totalCents > 0 ? `${base} (+${formatBRL(totalCents)})` : base
}

function productLines(item: Extract<CartItem, { kind: 'product' }>, number: number): string[] {
  const summary = summarizeSelection(item.slug, item.selection)
  const details = [summary.sizeLabel, summary.flavorName ? `${summary.flavorLabel}: ${summary.flavorName}` : '']
    .filter(Boolean)
    .join(' · ')
  const lines = [`${keycap(number)} *${item.quantity}x ${summary.productName}*${details ? ` (${details})` : ''} — *${formatBRL(lineTotalCents(item))}*`]

  if (summary.montagem) {
    const omitted = completeOmitted(PRODUCTS[item.slug], item.selection).map((topping) => topping.name)
    lines.push(`${ITEM_INDENT}✨ *Montagem:* ${omitted.length === 0 ? 'COMPLETO (todos os acompanhamentos)' : 'COMPLETO'}`)
    if (omitted.length > 0) lines.push(`${ITEM_INDENT}🚫 *RETIRAR (SEM):* ${omitted.join(', ')}`)
  }

  const paid = summary.sections.flatMap((section) =>
    section.items.filter((choice) => choice.totalCents > 0).map((choice) => choiceText(choice.name, choice.quantity, choice.totalCents)),
  )
  if (paid.length > 0) lines.push(`${ITEM_INDENT}➕ *Cremes / Extras Pagos:* ${paid.join(', ')}`)

  // Um grupo por linha: "Morango" existe como fruta e como cobertura.
  const included = summary.sections
    .map((section) => ({ label: section.label, names: section.items.filter((choice) => choice.totalCents === 0).map((choice) => choiceText(choice.name, choice.quantity)) }))
    .filter((group) => group.names.length > 0)
  if (included.length > 0) {
    lines.push(`${ITEM_INDENT}🥄 *Acompanhamentos:*`)
    for (const group of included) lines.push(`${GROUP_INDENT}• ${group.label}: ${group.names.join(', ')}`)
  }
  return lines
}

function extraLines(item: Extract<CartItem, { kind: 'extra' }>, number: number): string[] {
  const { name, rows } = describeExtra(item)
  // Uma escolha vai entre parênteses; duas ou mais, cada uma na sua linha.
  const details = rows.length === 1 ? ` (${rows[0].label}: ${rows[0].value})` : ''
  const lines = [`${keycap(number)} *${item.quantity}x ${name}*${details} — *${formatBRL(lineTotalCents(item))}*`]
  if (rows.length > 1) for (const row of rows) lines.push(`${ITEM_INDENT}• *${row.label}:* ${row.value}`)
  return lines
}

function itemLines(item: CartItem, number: number): string[] {
  const lines = item.kind === 'extra' ? extraLines(item, number) : productLines(item, number)
  if (item.note) lines.push(`${ITEM_INDENT}📝 *Observação:* ${item.note}`)
  return lines
}

/** A modalidade como a loja lê na comanda (textos do pedido de 2026-11-20). */
const MODALITY: Record<DeliveryType, string> = {
  entrega: '🛵 Entrega em Domicílio',
  retirada: '🛍️ Retirar no Local (Levar para casa)',
  local: '🍨 COMER NO LOCAL (Deixar pronto para chegada)',
}

/**
 * Modalidade e onde: na entrega, o endereço e o GPS (só quando anexado); em retirar e comer no
 * local, o endereço da loja de "Horários e Contato", nunca o endereço ou o GPS do cliente.
 */
function fulfillmentLines(fulfillment: Fulfillment): string[] {
  const lines = [`• *Modalidade:* ${MODALITY[fulfillment.kind]}`]
  if (fulfillment.kind === 'entrega') {
    const reference = fulfillment.reference ? ` — Ref.: ${fulfillment.reference}` : ''
    lines.push(`• *Endereço:* ${fulfillment.street}, ${fulfillment.number}, ${fulfillment.district}${reference}`)
    if (fulfillment.gps) lines.push(`• *Localização GPS:* ${gpsMapsUrl(fulfillment.gps)}`)
    return lines
  }
  const place = storePlaceText(getStoreSettings().contact)
  lines.push(fulfillment.kind === 'retirada' ? `• *Local de retirada:* ${place}` : `• *Local:* ${place}`)
  return lines
}

function feeLine(fee: DeliveryFee): string {
  switch (fee.kind) {
    case 'retirada':
      return '🛍️ *Retirada na loja:* Grátis (R$ 0,00)'
    case 'local':
      return '🍨 *Consumo no local:* Grátis (R$ 0,00)'
    case 'gratis':
      return '🛵 *Frete / Entrega:* Grátis (R$ 0,00)'
    case 'combinar':
      return '🛵 *Frete / Entrega:* A combinar'
    case 'taxa':
      return `🛵 *Frete / Entrega (${fee.zoneName}):* ${fee.cents > 0 ? formatBRL(fee.cents) : 'Grátis (R$ 0,00)'}`
  }
}

function paymentLines(payment: Payment, amount: string, totalCents: number, feeKnown: boolean, delivery: boolean): string[] {
  const chosen = '• *Método escolhido:*'
  switch (payment.method) {
    case 'pix':
      return [`${chosen} 💠 *Pix* — ${amount}`, '  📎 _Conferir o comprovante do Pix._']
    case 'credito':
    case 'debito': {
      const card = payment.method === 'credito' ? 'Cartão de crédito' : 'Cartão de débito'
      return [`${chosen} 💳 *${card}* — ${amount}${delivery ? ' 📟 _(Levar maquininha)_' : ''}`]
    }
    case 'dinheiro': {
      const lines = [`${chosen} 💵 *Dinheiro* — ${amount}`]
      if (payment.changeForCents === null) lines.push('  ✅ *Troco:* Não precisa (valor exato)')
      else if (feeKnown) {
        lines.push(`  🪙 *Troco para:* ${formatBRL(payment.changeForCents)} *(Levar ${formatBRL(payment.changeForCents - totalCents)} de troco)*`)
      } else lines.push(`  🪙 *Troco para:* ${formatBRL(payment.changeForCents)}`)
      return lines
    }
  }
}

/** O título dos itens na comanda (o painel e o acompanhamento procuram por ele). */
export const ITEMS_TITLE = '🍨 *ITENS DO PEDIDO*'

/**
 * O bloco dos itens da comanda: o título e os itens numerados, cada um seguido de uma linha em
 * branco. O mesmo bloco vai na comanda inteira e em cada lote acrescentado pelo cliente (2026-11-20).
 */
export function itemsBlockLines(cart: Cart): string[] {
  const lines = [ITEMS_TITLE, '']
  cart.items.forEach((item, index) => lines.push(...itemLines(item, index + 1), ''))
  return lines
}

/** O bloco dos itens de uma comanda gravada (sem nome, telefone, endereço ou pagamento). */
export function orderItemsBlock(message: string): string {
  const lines = message.split('\n')
  const start = lines.findIndex((line) => line === ITEMS_TITLE)
  if (start === -1) return ''
  const end = lines.findIndex((line, index) => index > start && line.startsWith('━'))
  return lines.slice(start, end === -1 ? undefined : end).join('\n').trimEnd()
}

export function buildOrderMessage({ cart, customer, payment, sentAt, antecipado, code }: OrderDraft): string {
  const subtotalCents = cartTotalCents(cart)
  const totalCents = subtotalCents + feeCents(customer.fee)
  const feeKnown = customer.fee.kind !== 'combinar'
  const amount = `*${formatBRL(totalCents)}*${feeKnown ? '' : ' + frete a combinar'}`
  const { fulfillment } = customer
  const delivery = fulfillment.kind === 'entrega'

  // O nome das Configurações da loja (2026-11-21).
  const storeName = getStoreSettings().identity.name
  const lines = [`🍧 *NOVO PEDIDO — ${storeName.toLocaleUpperCase('pt-BR')}* 🍧`]
  if (code) lines.push(`🔖 *Pedido:* ${code}`)
  lines.push(`📅 *Data/Hora:* ${dateTimeText(sentAt)}`)
  if (antecipado) lines.push('⏰ *Pedido antecipado:* enviado com a loja fechada')

  lines.push('', '👤 *DADOS DO CLIENTE*', `• *Nome:* ${customer.name}`)
  if (customer.phone) lines.push(`• *Telefone:* ${customer.phone}`)
  lines.push(...fulfillmentLines(fulfillment))

  lines.push('', LINE, ...itemsBlockLines(cart))

  lines.push(
    LINE,
    '🧾 *RESUMO FINANCEIRO*',
    `🛍️ *Subtotal dos itens:* ${formatBRL(subtotalCents)}`,
    feeLine(customer.fee),
    `💰 *TOTAL A PAGAR:* ${amount}`,
    '',
    LINE,
    '💳 *FORMA DE PAGAMENTO*',
    ...paymentLines(payment, amount, totalCents, feeKnown, delivery),
    '',
    `💜 _Obrigado pela preferência! ${storeName}_`,
  )
  return lines.join('\n')
}
