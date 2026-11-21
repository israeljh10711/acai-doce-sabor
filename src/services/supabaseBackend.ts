/**
 * Gravação do modo vendedor no Supabase (opção B, pedido de 2026-11-16): as mudanças valem para
 * todos os clientes. A última leitura fica guardada no aparelho e é aplicada na hora na próxima
 * visita (`loadSync`), antes de a rede responder.
 */
import { type CatalogChanges, NO_CHANGES, parseChanges } from '../features/catalog/catalogChanges.ts'
import { type CatalogBackend, type ChangeKind, dataUrlToBlob, parseBackup, withChange } from './sellerCatalogStore.ts'
import type { ChangeRow, SupabaseRest } from './supabaseRest.ts'

export const CACHE_KEY = 'acai_doce_sabor_catalog_cache_v1'
const KINDS: readonly ChangeKind[] = ['items', 'products', 'toppings', 'sections', 'settings']

/** Linhas da tabela `catalog_changes` → mudanças (só campos válidos). */
export function changesFromRows(rows: readonly ChangeRow[]): CatalogChanges {
  const raw: Record<ChangeKind, Record<string, unknown>> = { items: {}, products: {}, toppings: {}, sections: {}, settings: {} }
  for (const row of rows) {
    if (KINDS.includes(row.kind) && typeof row.id === 'string') raw[row.kind][row.id] = row.data
  }
  return parseChanges(raw)
}

export function createSupabaseBackend(rest: SupabaseRest, store: Pick<Storage, 'getItem' | 'setItem'>): CatalogBackend {
  let current: CatalogChanges = (() => {
    try {
      return parseChanges(JSON.parse(store.getItem(CACHE_KEY) ?? 'null'))
    } catch {
      return NO_CHANGES
    }
  })()
  const remember = (changes: CatalogChanges) => {
    current = changes
    try {
      store.setItem(CACHE_KEY, JSON.stringify(changes))
    } catch {
      // Sem espaço no aparelho: fica só na memória.
    }
    return changes
  }

  return {
    kind: 'supabase',
    loadSync: () => current,
    load: async () => remember(changesFromRows(await rest.readChanges())),
    async save(kind, id, change) {
      if (change === null) await rest.remove(kind, id)
      else await rest.upsert(kind, id, change)
      return remember(withChange(current, kind, id, change))
    },
    uploadPhoto: (blob) => rest.upload(blob),
    loadPhotoUrls: async () => ({}),
    signIn: (password) => rest.signIn(password),
    signOut: () => rest.signOut(),
    changePassword: (next) => rest.changePassword(next),
    isSignedIn: () => rest.isSignedIn(),
    async exportBackup(catalog) {
      // O cardápio do banco vai junto para consulta (as fotos já são endereços do Storage).
      return JSON.stringify({ app: 'acai-doce-sabor', v: 2, createdAt: new Date().toISOString(), changes: current, photos: {}, ...(catalog ? { catalog: catalog.data } : {}) })
    },
    async importBackup(json) {
      const backup = parseBackup(json)
      // Fotos de um backup feito no aparelho (idb:) sobem para o Supabase antes.
      const uploaded: Record<string, string> = {}
      for (const [ref, data] of Object.entries(backup.photos)) {
        const blob = dataUrlToBlob(data)
        if (blob) uploaded[ref] = await rest.upload(blob)
      }
      const fix = <T extends object>(change: T): T => {
        const image = (change as { image?: string }).image
        return image && uploaded[image] ? { ...change, image: uploaded[image] } : change
      }
      // O banco fica igual ao backup: grava tudo dele e apaga o que não está nele.
      for (const kind of KINDS) {
        for (const [id, change] of Object.entries(backup.changes[kind])) await rest.upsert(kind, id, fix(change))
        for (const id of Object.keys(current[kind])) if (!(id in backup.changes[kind])) await rest.remove(kind, id)
      }
      return remember(await this.load())
    },
  }
}
