/**
 * O cardápio da função do pedido (cardápio dinâmico, 2026-11-21): nada de cardápio fixo no código.
 *
 * - Lê, em paralelo e uma vez por pedido, as configurações da loja (`catalog_changes`) e o cardápio
 *   inteiro (`catalogo_publico()`, com a chave de servidor: vem também o oculto e o arquivado, e a
 *   conversão tira o que o cliente não pode pedir). Duas consultas, sem uma por item.
 * - Se uma das leituras falha ou vem fora do formato, o erro sobe (500): o pedido nunca é conferido
 *   com um cardápio velho ou pela metade.
 * - O preço das ofertas usa a hora do servidor.
 */
import type { Cart } from '../features/cart/cart.ts'
import { setCatalogSnapshot } from '../features/catalog/catalogState.ts'
import { parseCatalogRecords } from '../features/catalog/records.ts'
import { itemName } from '../features/orders/orderRow.ts'
import { changesFromRows } from '../services/supabaseBackend.ts'
import type { ChangeRow } from '../services/supabaseRest.ts'

export type CatalogDeps = {
  readChanges(): Promise<ChangeRow[]>
  /** `catalogo_publico()` com a chave de servidor. */
  readCatalog(): Promise<unknown>
  now(): number
}

/**
 * Aplica o cardápio do banco no estado do módulo. Depois desta chamada, até a conferência acabar,
 * nada de `await` (o cardápio é um estado do módulo, dividido entre pedidos ao mesmo tempo).
 */
export async function loadServerCatalog(deps: CatalogDeps): Promise<number> {
  const [rows, raw] = await Promise.all([deps.readChanges(), deps.readCatalog()])
  const records = parseCatalogRecords(raw)
  setCatalogSnapshot(changesFromRows(rows), records, deps.now())
  return records.revision
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Complementos com quantidade, sem os zerados (para comparar a escolha enviada com a refeita). */
function toppingMap(raw: unknown): Map<string, number> {
  const map = new Map<string, number>()
  if (!Array.isArray(raw)) return map
  for (const pair of raw) {
    if (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'number' && pair[1] > 0) map.set(pair[0], pair[1])
  }
  return map
}

/**
 * O primeiro item montado cuja escolha não vale mais como foi enviada (ex.: o vendedor baixou o
 * máximo de um grupo ou tirou o complemento do produto). O carrinho refeito pelas regras do banco
 * descartaria o excesso em silêncio; o servidor recusa e o cliente confere o item. `null`: tudo igual.
 */
export function changedSelection(rawCart: string, cart: Cart): string | null {
  let data: unknown
  try {
    data = JSON.parse(rawCart)
  } catch {
    return null
  }
  if (!isRecord(data) || !Array.isArray(data.items)) return null
  const byId = new Map(cart.items.map((item) => [item.id, item]))
  for (const entry of data.items) {
    if (!isRecord(entry) || entry.kind === 'extra') continue
    const item = byId.get(String(entry.id))
    if (!item || item.kind !== 'product') continue
    const sent = toppingMap(entry.toppings)
    const kept = new Map(Object.entries(item.selection.toppings).filter(([, quantity]) => quantity > 0))
    const sameToppings = sent.size === kept.size && [...sent].every(([id, quantity]) => kept.get(id) === quantity)
    const sameSize = (entry.sizeId ?? null) === item.selection.sizeId
    const sameFlavor = (entry.flavorId ?? null) === item.selection.flavorId
    if (!sameToppings || !sameSize || !sameFlavor) return itemName(item)
  }
  return null
}
