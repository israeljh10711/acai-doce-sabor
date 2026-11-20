/**
 * A linha de um pedido na tabela `orders`, montada de um pedido já conferido. A mesma montagem
 * vale para a função `pedido` do servidor (Supabase) e para o modo de demonstração local
 * (painel ao vivo, 2026-11-20): os dois guardam a mesma estrutura.
 */
import { type Cart, type CartItem, cartTotalCents, describeExtra, lineTotalCents, serializeCart, summarizeSelection, unitPriceCents } from '../cart/cart.ts'
import { type Customer, type DeliveryFee, type DeliveryType, feeCents } from '../checkout/delivery.ts'
import { gpsMapsUrl } from '../checkout/gps.ts'
import type { Payment, PaymentMethod } from '../checkout/payment.ts'

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
  /** A sessão anônima do cliente que fez o pedido (acompanhamento, 2026-11-20); nula sem sessão. */
  customer_user_id: string | null
}

/** "Açaí Tradicional (Isopor M)", "Picolé Gourmet". */
export function itemName(item: CartItem): string {
  if (item.kind === 'extra') return describeExtra(item).name
  const summary = summarizeSelection(item.slug, item.selection)
  return summary.sizeLabel ? `${summary.productName} (${summary.sizeLabel})` : summary.productName
}

/** A cópia dos itens (nomes e preços do momento da compra). */
export function itemSnapshots(cart: Cart): ItemSnapshot[] {
  return cart.items.map((item) => ({
    name: itemName(item),
    quantity: item.quantity,
    unit_cents: unitPriceCents(item),
    total_cents: lineTotalCents(item),
    ...(item.note ? { note: item.note } : {}),
  }))
}

export type OrderRowInput = { cart: Cart; customer: Customer; payment: Payment; antecipado: boolean; message: string; whatsapp: string }

/** Os campos da linha que vêm do pedido (sem a chave de repetição, o número e o código). */
export function orderRowFields({ cart, customer, payment, antecipado, message, whatsapp }: OrderRowInput): Omit<OrderRow, 'attempt_key' | 'number' | 'code' | 'customer_user_id'> {
  const subtotalCents = cartTotalCents(cart)
  const { fulfillment, fee } = customer
  // O GPS só existe na entrega (checkCustomer descarta nas outras), conferido e com o mesmo link da comanda.
  const gps = fulfillment.kind === 'entrega' ? fulfillment.gps : null
  return {
    message,
    whatsapp,
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
    total_cents: subtotalCents + feeCents(fee),
    antecipado,
    items: itemSnapshots(cart),
    cart: JSON.parse(serializeCart(cart)) as unknown,
  }
}
