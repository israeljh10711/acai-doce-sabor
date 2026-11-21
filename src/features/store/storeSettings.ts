/**
 * Configurações da loja que o vendedor muda pela faixa do modo vendedor (pedido de 2026-11-17):
 * horário de funcionamento, o interruptor de exceção (abrir ou fechar fora da regra), o prazo de
 * entrega, o que fazer com pedidos com a loja fechada, o frete e o contato da loja.
 *
 * Ficam como uma mudança do vendedor do tipo `settings` (id `loja`), no aparelho ou no Supabase,
 * junto com as mudanças do cardápio. Funções puras: a leitura aceita só os campos válidos e
 * completa o resto com o padrão (os dados do responsável: 13h às 21h, 30–45 min, contato da loja).
 * O frete começa "a combinar", porque a taxa da loja ainda não é conhecida.
 *
 * Cardápio dinâmico (2026-11-21): também a identidade da loja (nome, subtítulo, slogan, telefone,
 * Instagram), o Pix (tipo, chave, titular, ligado), as formas de pagamento aceitas, o bairro
 * ligado ou desligado e o horário por dia da semana, com até 3 períodos por dia.
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
/** `active: false`: o bairro fica fora da lista do cliente (sem apagar a taxa). */
export type DeliveryZone = { id: string; name: string; feeCents: number; active?: boolean }
export type DeliverySettings = { mode: DeliveryMode; zones: DeliveryZone[] }

export type StoreContact = { whatsapp: string; street: string; city: string; uf: string }

/** Nome e textos da loja; o telefone (fixo ou outro) e o Instagram sem o "@". */
export type StoreIdentity = { name: string; subtitle: string; slogan: string; phone: string; instagram: string }

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'
export type PixSettings = { enabled: boolean; type: PixKeyType; key: string; holder: string }

export type PaymentId = 'pix' | 'dinheiro' | 'cartao'
export type PaymentSettings = Readonly<Record<PaymentId, boolean>>

/** Um dia da semana: aberto ou não e os períodos (em ordem, sem se sobrepor). */
export type DaySchedule = { open: boolean; periods: readonly StoreHours[] }
/** Os 7 dias, de domingo (0) a sábado (6). Sem ele, vale `hours` todos os dias. */
export type WeekSchedule = readonly DaySchedule[]

export type StoreSettings = {
  hours: StoreHours
  week: WeekSchedule | null
  override: StoreOverride | null
  deliveryTime: string
  closedOrders: ClosedOrders
  delivery: DeliverySettings
  contact: StoreContact
  identity: StoreIdentity
  pix: PixSettings
  payments: PaymentSettings
}

/** O que fica guardado: só os campos que o vendedor mudou (o contato e a identidade, campo a campo). */
export type StoreSettingsChange = Partial<Omit<StoreSettings, 'contact' | 'identity'>> & { contact?: Partial<StoreContact>; identity?: Partial<StoreIdentity> }

export const PIX_TYPE_LABELS: Readonly<Record<PixKeyType, string>> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Celular',
  aleatoria: 'Chave aleatória',
}

export const PAYMENT_LABELS: Readonly<Record<PaymentId, string>> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }

/** Até 3 períodos por dia (ex.: almoço e noite). */
export const MAX_PERIODS = 3

export const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const

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
  identity: { name: storeInfo.name, subtitle: 'Açaí e milk-shake em Teixeira, PB', slogan: '', phone: '', instagram: storeInfo.instagramHandle },
  week: null,
  // A chave do pedido de 2026-11-14 (o responsável ainda precisa confirmar).
  pix: { enabled: true, type: 'telefone', key: storeInfo.pix.key, holder: storeInfo.pix.holder },
  payments: { pix: true, dinheiro: true, cartao: true },
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
    zones.push({ id, name, feeCents: fee as number, ...(entry.active === false ? { active: false } : {}) })
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

function parseWeek(raw: unknown): WeekSchedule | null | undefined {
  if (raw === null) return null
  if (!Array.isArray(raw) || raw.length !== 7) return undefined
  const week: DaySchedule[] = []
  for (const day of raw) {
    if (!isRecord(day) || typeof day.open !== 'boolean' || !Array.isArray(day.periods) || day.periods.length > MAX_PERIODS) return undefined
    const periods: StoreHours[] = []
    for (const period of day.periods) {
      const hours = parseHours(period)
      // Em ordem e sem se sobrepor.
      if (!hours || (periods.length > 0 && hours.opensAt < periods[periods.length - 1].closesAt)) return undefined
      periods.push(hours)
    }
    if (day.open && periods.length === 0) return undefined
    week.push({ open: day.open, periods })
  }
  return week
}

function parseIdentity(raw: unknown): Partial<StoreIdentity> | undefined {
  if (!isRecord(raw)) return undefined
  const identity: Partial<StoreIdentity> = {}
  const name = cleanText(raw.name, 60)
  if (name) identity.name = name
  for (const field of ['subtitle', 'slogan'] as const) {
    if (raw[field] === '') identity[field] = ''
    const text = cleanText(raw[field], 120)
    if (text) identity[field] = text
  }
  if (raw.phone === '') identity.phone = ''
  const phone = typeof raw.phone === 'string' ? formatBrazilPhone(raw.phone) : null
  if (phone) identity.phone = phone
  if (raw.instagram === '') identity.instagram = ''
  if (typeof raw.instagram === 'string' && /^@?[A-Za-z0-9._]{1,30}$/.test(raw.instagram.trim())) identity.instagram = raw.instagram.trim().replace(/^@/, '')
  return Object.keys(identity).length > 0 ? identity : undefined
}

const PIX_TYPES: readonly PixKeyType[] = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']

/** O que está errado na chave Pix para o tipo dela (só números no CPF, CNPJ e celular), ou `null`. */
export function pixKeyProblem(type: PixKeyType, key: string): string | null {
  const digits = key.replace(/\D/g, '')
  if (type === 'cpf') return digits.length === 11 ? null : 'O CPF tem 11 números.'
  if (type === 'cnpj') return digits.length === 14 ? null : 'O CNPJ tem 14 números.'
  if (type === 'telefone') return digits.length === 10 || digits.length === 11 || (digits.length === 13 && digits.startsWith('55')) ? null : 'O celular tem DDD e número (10 ou 11 números).'
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key.trim()) && key.trim().length <= 77 ? null : 'Escreva o e-mail da chave Pix.'
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key.trim()) ? null : 'A chave aleatória tem 32 letras e números, com hífens.'
}

function parsePix(raw: unknown): PixSettings | undefined {
  if (!isRecord(raw) || typeof raw.enabled !== 'boolean' || !PIX_TYPES.includes(raw.type as PixKeyType)) return undefined
  const key = typeof raw.key === 'string' ? raw.key.trim() : ''
  const holder = cleanText(raw.holder, 80) ?? ''
  const type = raw.type as PixKeyType
  if (raw.enabled && (pixKeyProblem(type, key) !== null || !holder)) return undefined
  return { enabled: raw.enabled, type, key: key.slice(0, 80), holder }
}

function parsePayments(raw: unknown): PaymentSettings | undefined {
  if (!isRecord(raw) || typeof raw.pix !== 'boolean' || typeof raw.dinheiro !== 'boolean' || typeof raw.cartao !== 'boolean') return undefined
  // Pelo menos uma forma ligada.
  if (!raw.pix && !raw.dinheiro && !raw.cartao) return undefined
  return { pix: raw.pix, dinheiro: raw.dinheiro, cartao: raw.cartao }
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
  const week = parseWeek(raw.week)
  if (week !== undefined) change.week = week
  const identity = parseIdentity(raw.identity)
  if (identity) change.identity = identity
  const pix = parsePix(raw.pix)
  if (pix) change.pix = pix
  const payments = parsePayments(raw.payments)
  if (payments) change.payments = payments
  return change
}

/** As configurações em uso: o que o vendedor mudou por cima do padrão. */
export function resolveStoreSettings(change: StoreSettingsChange | undefined): StoreSettings {
  if (!change) return DEFAULT_STORE_SETTINGS
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...change,
    override: change.override ?? null,
    week: change.week ?? null,
    contact: { ...DEFAULT_STORE_SETTINGS.contact, ...change.contact },
    identity: { ...DEFAULT_STORE_SETTINGS.identity, ...change.identity },
  }
}

/** As formas de pagamento ligadas, na ordem do carrinho. O Pix só com a chave ligada. */
export function enabledPayments(settings: StoreSettings): PaymentId[] {
  return (['pix', 'dinheiro', 'cartao'] as const).filter((id) => settings.payments[id] && (id !== 'pix' || settings.pix.enabled))
}

/** Os bairros que o cliente vê (os ligados). */
export function activeZones(settings: StoreSettings): DeliveryZone[] {
  return settings.delivery.zones.filter((zone) => zone.active !== false)
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
