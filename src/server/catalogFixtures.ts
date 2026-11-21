/**
 * Cardápios do banco para os testes da função do pedido (cardápio dinâmico, 2026-11-21): a semente
 * no formato de `catalogo_publico()`, com mudanças como o vendedor faria pelo painel.
 */
import { baseCatalogRecords } from '../features/catalog/baseRecords.ts'
import type { CatalogRecords, ProductRecord } from '../features/catalog/records.ts'
import { recordsToDatabase } from '../services/catalogRepository.ts'

/** O cardápio da semente com a mudança (uma cópia nova a cada chamada). */
export function catalogWith(change: (records: CatalogRecords) => CatalogRecords = (records) => records): unknown {
  return JSON.parse(JSON.stringify(recordsToDatabase(change(baseCatalogRecords()))))
}

/** Muda campos de um produto. */
export const editProduct =
  (id: string, patch: Partial<ProductRecord>) =>
  (records: CatalogRecords): CatalogRecords => ({ ...records, products: records.products.map((product) => (product.id === id ? { ...product, ...patch } : product)) })

/** Várias mudanças em ordem. */
export const all =
  (...changes: ((records: CatalogRecords) => CatalogRecords)[]) =>
  (records: CatalogRecords): CatalogRecords =>
    changes.reduce((current, change) => change(current), records)
