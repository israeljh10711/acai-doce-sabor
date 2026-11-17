/**
 * Contas do gerenciador de sabores do modo vendedor (pedido de 2026-11-17), sem tela: as linhas do
 * formulário a partir do item ou do produto, e de volta para a mudança que é gravada.
 */
import { foldText } from '../../utils/text.ts'
import type { ChoiceGroupEntry, FlavorEntry } from '../catalog/catalogChanges.ts'
import { type ExtraItem, choiceGroupsOf } from '../catalog/extras.ts'
import type { Product } from '../catalog/menu.ts'

export type OptionRow = { key: string; id?: string; name: string; available: boolean }
export type GroupRow = { key: string; id?: string; label: string; options: OptionRow[] }

export const MAX_GROUPS = 3
export const MAX_OPTIONS = 40

let counter = 0
/** Chave de uma linha nova do formulário (só para a tela). */
export const rowKey = () => `sabor-${++counter}`

const clean = (text: string) => text.trim().replace(/\s+/g, ' ')
const keyOf = (name: string) => foldText(name).toLowerCase()

/** As escolhas sem preço do item, como linhas do formulário (vazio para item novo). */
export function groupRowsOf(item: ExtraItem | undefined): GroupRow[] {
  if (!item) return []
  return choiceGroupsOf(item)
    .filter((group) => !group.prices)
    .map((group) => ({
      key: rowKey(),
      id: group.id,
      label: group.label,
      options: group.options.map((name) => ({ key: rowKey(), name, available: !group.unavailable?.includes(name) })),
    }))
}

/** Os sabores do produto, como linhas do formulário. */
export function flavorRowsOf(product: Product): OptionRow[] {
  return product.flavors.map((flavor) => ({ key: rowKey(), id: flavor.id, name: flavor.name, available: flavor.available !== false }))
}

type Read<T> = { ok: true } & T

function readOptions(rows: readonly OptionRow[]): { options: { id?: string; name: string; available?: boolean }[]; repeated: boolean } {
  const seen = new Set<string>()
  let repeated = false
  const options: { id?: string; name: string; available?: boolean }[] = []
  for (const row of rows) {
    const name = clean(row.name)
    if (!name) continue
    if (seen.has(keyOf(name))) repeated = true
    seen.add(keyOf(name))
    options.push({ ...(row.id ? { id: row.id } : {}), name, ...(row.available ? {} : { available: false }) })
  }
  return { options, repeated }
}

/** As escolhas do item para gravar; escolha toda vazia (sem nome e sem opção) é tirada. */
export function readChoiceGroups(rows: readonly GroupRow[]): Read<{ groups: ChoiceGroupEntry[] }> | { ok: false; problem: string } {
  const groups: ChoiceGroupEntry[] = []
  for (const row of rows) {
    const label = clean(row.label)
    const { options, repeated } = readOptions(row.options)
    if (!label && options.length === 0) continue
    if (!label) return { ok: false, problem: 'Dê um nome a cada escolha (ex.: Sabor).' }
    if (options.length === 0) return { ok: false, problem: 'Cada escolha precisa de pelo menos um sabor.' }
    if (repeated) return { ok: false, problem: `Há sabores repetidos em "${label}".` }
    if (options.length > MAX_OPTIONS) return { ok: false, problem: `Use no máximo ${MAX_OPTIONS} sabores por escolha.` }
    groups.push({ ...(row.id ? { id: row.id } : {}), label, options: options.map(({ name, available }) => ({ name, ...(available === false ? { available } : {}) })) })
  }
  if (groups.length > MAX_GROUPS) return { ok: false, problem: `Use no máximo ${MAX_GROUPS} escolhas.` }
  return { ok: true, groups }
}

/** Os sabores do produto para gravar: pelo menos um, sem repetir. */
export function readFlavors(rows: readonly OptionRow[]): Read<{ flavors: FlavorEntry[] }> | { ok: false; problem: string } {
  const { options, repeated } = readOptions(rows)
  if (options.length === 0) return { ok: false, problem: 'Deixe pelo menos um sabor.' }
  if (repeated) return { ok: false, problem: 'Há sabores repetidos.' }
  if (options.length > MAX_OPTIONS) return { ok: false, problem: `Use no máximo ${MAX_OPTIONS} sabores.` }
  return { ok: true, flavors: options }
}

/** As escolhas lidas são iguais às do item (nada a gravar). */
export function sameGroups(item: ExtraItem | undefined, groups: readonly ChoiceGroupEntry[]): boolean {
  const current = readChoiceGroups(groupRowsOf(item))
  return current.ok && JSON.stringify(current.groups) === JSON.stringify(groups)
}

/** Os sabores lidos são iguais aos do produto (nada a gravar). */
export function sameFlavors(product: Product, flavors: readonly FlavorEntry[]): boolean {
  const current = readFlavors(flavorRowsOf(product))
  return current.ok && JSON.stringify(current.flavors) === JSON.stringify(flavors)
}
