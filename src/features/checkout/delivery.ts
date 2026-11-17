/**
 * Dados do cliente e frete no carrinho (pedido de 2026-11-17): nome, telefone (opcional),
 * entrega ou retirada na loja e o endereço. O frete segue o que o vendedor configurou em
 * "Entrega / Frete": grátis, por bairro (lista com o valor de cada um) ou a combinar no WhatsApp.
 * Retirada na loja é sempre grátis. Regras puras, testadas sem tela.
 */
import { formatBrazilPhone } from '../../utils/whatsapp.ts'
import type { DeliverySettings, DeliveryZone } from '../store/storeSettings.ts'

/** Na lista de bairros: "Outro bairro (taxa a combinar)", para quem não está nela. */
export const OTHER_ZONE = 'outro'

/** O que o cliente escolheu e digitou no carrinho. */
export type CustomerDraft = {
  name: string
  phone: string
  kind: 'entrega' | 'retirada' | null
  street: string
  number: string
  /** Bairro escrito (sem lista de bairros, ou em "Outro bairro"). */
  district: string
  /** Bairro escolhido na lista do vendedor, ou `OTHER_ZONE`. */
  zoneId: string | null
  reference: string
}

export const EMPTY_CUSTOMER: CustomerDraft = {
  name: '',
  phone: '',
  kind: null,
  street: '',
  number: '',
  district: '',
  zoneId: null,
  reference: '',
}

export type DeliveryFee =
  | { kind: 'retirada' }
  | { kind: 'gratis' }
  | { kind: 'taxa'; cents: number; zoneName: string }
  | { kind: 'combinar' }

export type Fulfillment =
  | { kind: 'retirada' }
  | { kind: 'entrega'; street: string; number: string; district: string; reference: string | null }

/** Cliente conferido, pronto para a comanda. */
export type Customer = { name: string; phone: string | null; fulfillment: Fulfillment; fee: DeliveryFee }

export type CustomerField = 'name' | 'phone' | 'kind' | 'street' | 'number' | 'district' | 'zone'

/** O carrinho mostra a lista de bairros (com o valor de cada um) só no modo de taxas com bairros. */
export function zoneList(delivery: DeliverySettings): readonly DeliveryZone[] {
  return delivery.mode === 'taxas' ? delivery.zones : []
}

/** Frete do pedido. `null` enquanto não dá para saber: falta escolher entrega/retirada ou o bairro. */
export function feeFor(draft: CustomerDraft, delivery: DeliverySettings): DeliveryFee | null {
  if (draft.kind === 'retirada') return { kind: 'retirada' }
  if (draft.kind !== 'entrega') return null
  if (delivery.mode === 'gratis') return { kind: 'gratis' }
  const zones = zoneList(delivery)
  if (zones.length === 0 || draft.zoneId === OTHER_ZONE) return { kind: 'combinar' }
  const zone = zones.find((candidate) => candidate.id === draft.zoneId)
  return zone ? { kind: 'taxa', cents: zone.feeCents, zoneName: zone.name } : null
}

/** Quanto o frete soma no total (a combinar soma 0 e o total avisa). */
export function feeCents(fee: DeliveryFee): number {
  return fee.kind === 'taxa' ? fee.cents : 0
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Confere os dados antes do envio. Os problemas vêm por campo, com o texto que aparece nele. */
export function checkCustomer(
  draft: CustomerDraft,
  delivery: DeliverySettings,
): { ok: true; customer: Customer } | { ok: false; problems: Partial<Record<CustomerField, string>> } {
  const problems: Partial<Record<CustomerField, string>> = {}
  const name = clean(draft.name)
  if (!name) problems.name = 'Escreva seu nome.'
  const phone = clean(draft.phone) ? formatBrazilPhone(draft.phone) : null
  if (clean(draft.phone) && !phone) problems.phone = 'Telefone com DDD, por exemplo (83) 99999-0000.'
  if (!draft.kind) problems.kind = 'Escolha entrega ou retirada na loja.'

  let fulfillment: Fulfillment = { kind: 'retirada' }
  if (draft.kind === 'entrega') {
    const street = clean(draft.street)
    const number = clean(draft.number)
    if (!street) problems.street = 'Escreva a rua.'
    if (!number) problems.number = 'Escreva o número (ou s/n).'
    const zones = zoneList(delivery)
    const zone = zones.find((candidate) => candidate.id === draft.zoneId)
    const typed = zones.length === 0 || draft.zoneId === OTHER_ZONE
    let district = ''
    if (typed) {
      district = clean(draft.district)
      if (!district) problems.district = 'Escreva o bairro.'
    } else if (zone) {
      district = zone.name
    } else {
      problems.zone = 'Escolha o bairro.'
    }
    fulfillment = { kind: 'entrega', street, number, district, reference: clean(draft.reference) || null }
  }

  const fee = feeFor(draft, delivery)
  if (Object.keys(problems).length > 0 || !fee) return { ok: false, problems }
  return { ok: true, customer: { name, phone, fulfillment, fee } }
}
