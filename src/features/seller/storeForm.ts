/**
 * Contas dos formulários da loja no modo vendedor (pedido de 2026-11-17), sem tela: horário
 * digitado ("13:30"), a lista de bairros com o frete e o contato da loja.
 */
import { foldText } from '../../utils/text.ts'
import { formatBrazilPhone } from '../../utils/whatsapp.ts'
import { DAY_START, type DeliveryZone, MINUTES_PER_DAY, MAX_ZONES, type StoreContact, type StoreHours } from '../store/storeSettings.ts'
import { parsePriceInput } from './sellerForm.ts'

/** "13:30" → 810; `null` se não for uma hora. */
function readTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour < 24 && minute < 60 ? hour * 60 + minute : null
}

/** Minutos no campo de hora: 810 → "13:30"; a meia-noite do fim do dia (1440) → "00:00". */
export function timeInput(minutes: number): string {
  const value = minutes % MINUTES_PER_DAY
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

/** Abertura a partir das 05:00 e fechamento depois dela, no mesmo dia (00:00 é a meia-noite). */
export function readHours(open: string, close: string): { ok: true; hours: StoreHours } | { ok: false; problem: string } {
  const opensAt = readTime(open)
  const closing = readTime(close)
  if (opensAt === null || closing === null) return { ok: false, problem: 'Escolha a hora de abrir e a de fechar.' }
  if (opensAt < DAY_START) return { ok: false, problem: 'A abertura precisa ser a partir das 05:00.' }
  const closesAt = closing === 0 ? MINUTES_PER_DAY : closing
  if (closesAt <= opensAt) return { ok: false, problem: 'O fechamento precisa ser depois da abertura (no máximo 00:00).' }
  return { ok: true, hours: { opensAt, closesAt } }
}

/** Uma linha do formulário de bairros: sem `id`, é nova. */
export type ZoneRow = { id?: string; name: string; price: string }

const ZONE_PROBLEM = 'Confira os bairros: cada um com nome e valor (ex.: 3,00).'
const blankZone = (row: ZoneRow) => !row.name.trim() && !row.price.trim()

/** A lista de bairros como o carrinho usa; linha toda vazia é ignorada. */
export function readZones(
  rows: readonly ZoneRow[],
  suffix: () => string = () => Math.random().toString(36).slice(2, 6),
): { ok: true; zones: DeliveryZone[] } | { ok: false; problem: string } {
  const zones: DeliveryZone[] = []
  const names = new Set<string>()
  for (const row of rows) {
    const name = row.name.trim().replace(/\s+/g, ' ')
    if (blankZone(row)) continue
    const feeCents = parsePriceInput(row.price)
    if (!name || name.length > 40 || feeCents === null) return { ok: false, problem: ZONE_PROBLEM }
    const key = foldText(name).toLowerCase()
    if (names.has(key)) return { ok: false, problem: 'Há bairros com o mesmo nome.' }
    names.add(key)
    // "bairro-" + até 28 + "-" + 4 = no máximo 40, o limite da leitura das configurações. Com 30, um
    // nome comprido passava de 40 e o bairro sumia ao salvar (achado da auditoria E2E, 2026-11-21).
    const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28).replace(/-$/, '')
    zones.push({ id: row.id || `bairro-${slug || 'zona'}-${suffix()}`, name, feeCents })
  }
  if (zones.length > MAX_ZONES) return { ok: false, problem: `Use no máximo ${MAX_ZONES} bairros.` }
  return { ok: true, zones }
}

/**
 * Depois de salvar, cada linha do formulário fica com o `id` gravado (achado da auditoria E2E,
 * 2026-11-21). Sem isso, o bairro novo continuava "sem id" e cada salvar seguinte (o horário, o
 * Pix...) dava a ele um id novo: o bairro escolhido pelo cliente no carrinho deixava de valer. As
 * linhas vazias, que `readZones` ignora, ficam como estão.
 */
export function withSavedZoneIds<T extends ZoneRow>(rows: readonly T[], saved: readonly DeliveryZone[]): T[] {
  let next = 0
  return rows.map((row) => {
    if (blankZone(row)) return row
    const zone = saved[next++]
    return zone ? { ...row, id: zone.id } : row
  })
}

export type ContactField = keyof StoreContact

/** O contato da loja: WhatsApp com DDD, rua e número, cidade e UF. */
export function readContact(
  fields: StoreContact,
): { ok: true; contact: StoreContact } | { ok: false; problems: Partial<Record<ContactField, string>> } {
  const problems: Partial<Record<ContactField, string>> = {}
  const whatsapp = formatBrazilPhone(fields.whatsapp)
  if (!whatsapp) problems.whatsapp = 'WhatsApp com DDD, por exemplo (83) 99699-9980.'
  const street = fields.street.trim().replace(/\s+/g, ' ')
  if (!street) problems.street = 'Escreva a rua e o número.'
  const city = fields.city.trim().replace(/\s+/g, ' ')
  if (!city) problems.city = 'Escreva a cidade.'
  const uf = fields.uf.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(uf)) problems.uf = 'Use a sigla do estado, com 2 letras (ex.: PB).'
  if (Object.keys(problems).length > 0 || !whatsapp) return { ok: false, problems }
  return { ok: true, contact: { whatsapp, street, city, uf } }
}
