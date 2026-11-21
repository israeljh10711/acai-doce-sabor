/**
 * Dados do cliente e frete no carrinho (pedido de 2026-11-17): nome, telefone (opcional),
 * a modalidade e o endereço. O frete segue o que o vendedor configurou em "Entrega / Frete":
 * grátis, por bairro (lista com o valor de cada um) ou a combinar (a loja liga para o cliente; por
 * isso, desde 2026-11-21, o telefone é obrigatório nesse caso).
 *
 * Três modalidades (pedido de 2026-11-20): entrega (com GPS opcional), retirar na loja para levar
 * e comer no local. Retirar e comer no local são sempre grátis e não pedem endereço.
 * Regras puras, usadas pelo carrinho e pela função `pedido` do servidor, testadas sem tela.
 */
import { formatBrazilPhone } from '../../utils/whatsapp.ts'
import type { DeliverySettings, DeliveryZone } from '../store/storeSettings.ts'
import { type AddressGuess, type GpsPoint, parseGpsPoint } from './gps.ts'

/**
 * A modalidade do pedido, igual no carrinho, na comanda e no banco (coluna `fulfillment`):
 * `entrega` (delivery), `retirada` (pickup: busca e leva) e `local` (dine_in: come na sorveteria).
 */
export type DeliveryType = 'entrega' | 'retirada' | 'local'

export const DELIVERY_TYPES: readonly DeliveryType[] = ['entrega', 'retirada', 'local']

const isDeliveryType = (value: unknown): value is DeliveryType => DELIVERY_TYPES.includes(value as DeliveryType)

/** Na lista de bairros: "Outro bairro (taxa a combinar)", para quem não está nela. */
export const OTHER_ZONE = 'outro'

/** Frete a combinar: o telefone passa a ser obrigatório (2026-11-21). */
export const COMBINAR_PHONE_TEXT = 'Para entregas com frete a combinar, informe seu telefone. A loja entrará em contato para confirmar o valor da entrega.'

/** O que o cliente escolheu e digitou no carrinho. */
export type CustomerDraft = {
  name: string
  phone: string
  kind: DeliveryType | null
  street: string
  number: string
  /** Bairro escrito (sem lista de bairros, ou em "Outro bairro"). */
  district: string
  /** Bairro escolhido na lista do vendedor, ou `OTHER_ZONE`. */
  zoneId: string | null
  reference: string
  /** Localização anexada pelo botão de GPS (só na entrega). Nunca guardada na aba. */
  gps: GpsPoint | null
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
  gps: null,
}

export type DeliveryFee =
  | { kind: 'retirada' }
  | { kind: 'local' }
  | { kind: 'gratis' }
  | { kind: 'taxa'; cents: number; zoneName: string }
  | { kind: 'combinar' }

export type Fulfillment =
  | { kind: 'retirada' }
  | { kind: 'local' }
  | { kind: 'entrega'; street: string; number: string; district: string; reference: string | null; gps: GpsPoint | null }

/** Cliente conferido, pronto para a comanda. */
export type Customer = { name: string; phone: string | null; fulfillment: Fulfillment; fee: DeliveryFee }

export type CustomerField = 'name' | 'phone' | 'kind' | 'street' | 'number' | 'district' | 'zone'

/**
 * Dados guardados na aba (`sessionStorage`), conferidos: quem volta ao cardápio para pegar mais
 * um item não perde o que já escreveu. Campo de tipo errado vira vazio.
 */
export function parseCustomerDraft(raw: unknown): CustomerDraft {
  if (typeof raw !== 'object' || raw === null) return EMPTY_CUSTOMER
  const data = raw as Record<string, unknown>
  const text = (key: keyof CustomerDraft) => (typeof data[key] === 'string' ? (data[key] as string).slice(0, 120) : '')
  return {
    name: text('name'),
    phone: text('phone'),
    kind: isDeliveryType(data.kind) ? data.kind : null,
    street: text('street'),
    number: text('number'),
    district: text('district'),
    zoneId: typeof data.zoneId === 'string' ? data.zoneId.slice(0, 40) : null,
    reference: text('reference'),
    gps: parseGpsPoint(data.gps),
  }
}

/** O que vai para a aba: tudo, menos o GPS (ele não volta de outra sessão, pedido de 2026-11-20). */
export function draftForStorage(draft: CustomerDraft): CustomerDraft {
  return { ...draft, gps: null }
}

/** O carrinho mostra a lista de bairros (com o valor de cada um) só no modo de taxas com bairros. */
export function zoneList(delivery: DeliverySettings): readonly DeliveryZone[] {
  return delivery.mode === 'taxas' ? delivery.zones : []
}

/**
 * Frete do pedido. `null` enquanto não dá para saber: falta escolher a modalidade ou o bairro.
 * Retirar e comer no local nunca têm frete, seja qual for o bairro guardado da entrega.
 */
export function feeFor(draft: CustomerDraft, delivery: DeliverySettings): DeliveryFee | null {
  if (draft.kind === 'retirada') return { kind: 'retirada' }
  if (draft.kind === 'local') return { kind: 'local' }
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

/** "São  José" e "sao jose" são o mesmo bairro: sem acento, sem maiúsculas, espaços simples. */
const fold = (text: string) => clean(text).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')

/**
 * O que o endereço sugerido pelo GPS preenche (pedido de 2026-11-20): só campo vazio. O que o
 * cliente escreveu ou escolheu nunca é trocado. Na lista de bairros do vendedor, escolhe o bairro
 * de mesmo nome quando nenhum foi escolhido; sem um igual, deixa o cliente escolher.
 */
export function addressPatch(draft: CustomerDraft, guess: AddressGuess, zones: readonly DeliveryZone[]): Partial<CustomerDraft> {
  const patch: Partial<CustomerDraft> = {}
  if (guess.street && !clean(draft.street)) patch.street = guess.street
  if (guess.number && !clean(draft.number)) patch.number = guess.number
  if (!guess.district) return patch
  const typed = zones.length === 0 || draft.zoneId === OTHER_ZONE
  if (typed) {
    if (!clean(draft.district)) patch.district = guess.district
    return patch
  }
  const chosen = zones.some((zone) => zone.id === draft.zoneId)
  const match = zones.find((zone) => fold(zone.name) === fold(guess.district ?? ''))
  if (!chosen && match) patch.zoneId = match.id
  return patch
}

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
  if (!draft.kind) problems.kind = 'Escolha entrega, retirada ou comer no local.'

  let fulfillment: Fulfillment = draft.kind === 'local' ? { kind: 'local' } : { kind: 'retirada' }
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
    fulfillment = { kind: 'entrega', street, number, district, reference: clean(draft.reference) || null, gps: parseGpsPoint(draft.gps) }
  }

  const fee = feeFor(draft, delivery)
  // Frete a combinar (modo "a combinar", lista vazia ou "Outro bairro", 2026-11-21): sem o WhatsApp
  // no pedido, o telefone é o único jeito de a loja combinar o valor. Telefone escrito errado já
  // tem a mensagem dele.
  if (fee?.kind === 'combinar' && !clean(draft.phone)) problems.phone = COMBINAR_PHONE_TEXT
  if (Object.keys(problems).length > 0 || !fee) return { ok: false, problems }
  return { ok: true, customer: { name, phone, fulfillment, fee } }
}
