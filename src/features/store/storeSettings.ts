/**
 * Configurações da loja que o vendedor muda pela faixa do modo vendedor (pedido de 2026-11-17):
 * horário de funcionamento, o interruptor de exceção (abrir ou fechar fora da regra), o prazo de
 * entrega, o que fazer com pedidos com a loja fechada, o frete e o contato da loja.
 *
 * Ficam como uma mudança do vendedor do tipo `settings` (id `loja`), no aparelho ou no Supabase,
 * junto com as mudanças do cardápio. Funções puras: a leitura aceita só os campos válidos e
 * completa o resto com o padrão (os dados do responsável: 13h às 21h, 30–45 min, contato da loja).
 * O frete começa "a combinar", porque a taxa da loja ainda não é conhecida.
 */
import { storeInfo } from '../../services/storeInfo.ts'
import { formatBrazilPhone } from '../../utils/whatsapp.ts'

/** Horário de todos os dias, em minutos desde a meia-noite (Brasília). `closesAt` vai até 1440. */
export type StoreHours = { opensAt: number; closesAt: number }

/** Interruptor do vendedor: aberta ou fechada até o instante `until` (ms); depois, vale o horário. */
export type StoreOverride = { state: 'open' | 'closed'; until: number }

/** Com a loja fechada: o pedido vai como antecipado, ou o envio fica bloqueado. */
export type ClosedOrders = 'antecipado' | 'bloquear'

export type DeliveryMode = 'gratis' | 'taxas' | 'combinar'
export type DeliveryZone = { id: string; name: string; feeCents: number }
export type DeliverySettings = { mode: DeliveryMode; zones: DeliveryZone[] }

export type StoreContact = { whatsapp: string; street: string; city: string; uf: string }

export type StoreSettings = {
  hours: StoreHours
  override: StoreOverride | null
  deliveryTime: string
  closedOrders: ClosedOrders
  delivery: DeliverySettings
  contact: StoreContact
}

/** O que fica guardado: só os campos que o vendedor mudou (o contato, campo a campo). */
export type StoreSettingsChange = Partial<Omit<StoreSettings, 'contact'>> & { contact?: Partial<StoreContact> }

/** O dia da loja vira às 5h: "fechar" depois da meia-noite ainda é a noite anterior. */
export const DAY_START = 5 * 60
export const MINUTES_PER_DAY = 24 * 60

/** Prazos do seletor rápido "Tempo" (pedido de 2026-11-17); o vendedor também pode digitar outro. */
export const DELIVERY_TIMES = ['20–35 min', '30–45 min', '45–60 min', '60–80 min'] as const

export const MAX_ZONES = 30
/** Frete máximo aceito por bairro (R$ 1.000,00): só barra valor digitado errado. */
const MAX_FEE_CENTS = 100_000

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  // Horário do briefing de 2026-11-12: todos os dias, das 13h às 21h.
  hours: { opensAt: 13 * 60, closesAt: 21 * 60 },
  override: null,
  deliveryTime: '30–45 min',
  closedOrders: 'antecipado',
  delivery: { mode: 'combinar', zones: [] },
  contact: { whatsapp: storeInfo.whatsapp, street: storeInfo.address.street, city: storeInfo.address.city, uf: 'PB' },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Texto sem espaços sobrando, com até `max` caracteres; vazio ou longo demais não vale. */
function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim().replace(/\s+/g, ' ')
  return text && text.length <= max ? text : undefined
}

function parseHours(raw: unknown): StoreHours | undefined {
  if (!isRecord(raw)) return undefined
  const { opensAt, closesAt } = raw
  if (!Number.isInteger(opensAt) || !Number.isInteger(closesAt)) return undefined
  const open = opensAt as number
  const close = closesAt as number
  return open >= DAY_START && open < close && close <= MINUTES_PER_DAY ? { opensAt: open, closesAt: close } : undefined
}

function parseOverride(raw: unknown): StoreOverride | null | undefined {
  if (raw === null) return null
  if (!isRecord(raw) || (raw.state !== 'open' && raw.state !== 'closed')) return undefined
  const until = raw.until
  return typeof until === 'number' && Number.isFinite(until) && until > 0 ? { state: raw.state, until } : undefined
}

function parseZones(raw: unknown): DeliveryZone[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const zones: DeliveryZone[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const id = cleanText(entry.id, 40)
    const name = cleanText(entry.name, 40)
    const fee = entry.feeCents
    if (!id || !name || seen.has(id) || !Number.isInteger(fee) || (fee as number) < 0 || (fee as number) > MAX_FEE_CENTS) continue
    seen.add(id)
    zones.push({ id, name, feeCents: fee as number })
    if (zones.length === MAX_ZONES) break
  }
  return zones
}

function parseDelivery(raw: unknown): DeliverySettings | undefined {
  if (!isRecord(raw) || (raw.mode !== 'gratis' && raw.mode !== 'taxas' && raw.mode !== 'combinar')) return undefined
  return { mode: raw.mode, zones: parseZones(raw.zones) }
}

function parseContact(raw: unknown): Partial<StoreContact> | undefined {
  if (!isRecord(raw)) return undefined
  const contact: Partial<StoreContact> = {}
  const whatsapp = typeof raw.whatsapp === 'string' ? formatBrazilPhone(raw.whatsapp) : null
  if (whatsapp) contact.whatsapp = whatsapp
  const street = cleanText(raw.street, 80)
  if (street) contact.street = street
  const city = cleanText(raw.city, 60)
  if (city) contact.city = city
  if (typeof raw.uf === 'string' && /^[A-Za-z]{2}$/.test(raw.uf.trim())) contact.uf = raw.uf.trim().toUpperCase()
  return Object.keys(contact).length > 0 ? contact : undefined
}

/** A mudança guardada (aparelho ou Supabase), só com os campos válidos. */
export function parseStoreSettingsChange(raw: unknown): StoreSettingsChange {
  if (!isRecord(raw)) return {}
  const change: StoreSettingsChange = {}
  const hours = parseHours(raw.hours)
  if (hours) change.hours = hours
  const override = parseOverride(raw.override)
  if (override !== undefined) change.override = override
  const deliveryTime = cleanText(raw.deliveryTime, 30)
  if (deliveryTime) change.deliveryTime = deliveryTime
  if (raw.closedOrders === 'antecipado' || raw.closedOrders === 'bloquear') change.closedOrders = raw.closedOrders
  const delivery = parseDelivery(raw.delivery)
  if (delivery) change.delivery = delivery
  const contact = parseContact(raw.contact)
  if (contact) change.contact = contact
  return change
}

/** As configurações em uso: o que o vendedor mudou por cima do padrão. */
export function resolveStoreSettings(change: StoreSettingsChange | undefined): StoreSettings {
  if (!change) return DEFAULT_STORE_SETTINGS
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...change,
    override: change.override ?? null,
    contact: { ...DEFAULT_STORE_SETTINGS.contact, ...change.contact },
  }
}

/** Lê configurações de qualquer origem: campo inválido volta ao padrão sem derrubar os outros. */
export function parseStoreSettings(raw: unknown): StoreSettings {
  return resolveStoreSettings(parseStoreSettingsChange(raw))
}

/** O endereço no mapa (abre o Google Maps no celular ou no computador). */
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** "Rua Francisco Tota, 12, Teixeira, PB". */
export function storeAddressText(contact: StoreContact): string {
  return `${contact.street}, ${contact.city}, ${contact.uf}`
}

/** "Rua Francisco Tota, 12 — Teixeira, PB": o local na retirada e no consumo no local (2026-11-20). */
export function storePlaceText(contact: StoreContact): string {
  return `${contact.street} — ${contact.city}, ${contact.uf}`
}
