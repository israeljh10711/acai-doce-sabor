/**
 * Onde ficam as mudanças do vendedor (modo vendedor, pedido de 2026-11-16).
 *
 * Duas gravações com a mesma interface:
 * - Supabase (`supabaseBackend.ts`), quando o `.env.local` tem as chaves: vale para todos;
 * - este aparelho (abaixo), enquanto não há chaves: localStorage para as mudanças e IndexedDB
 *   para as fotos. Só quem usa este aparelho vê.
 */
import {
  type CatalogChanges,
  type ItemChange,
  NO_CHANGES,
  type ProductChange,
  type SectionChange,
  type ToppingChange,
  parseChanges,
} from '../features/catalog/catalogChanges.ts'
import type { StoreSettingsChange } from '../features/store/storeSettings.ts'

export type ChangeKind = 'items' | 'products' | 'toppings' | 'sections' | 'settings'
export type AnyChange = ItemChange | ProductChange | ToppingChange | SectionChange | StoreSettingsChange

export type CatalogBackend = {
  kind: 'local' | 'supabase'
  /** As mudanças guardadas, já prontas (no aparelho, na hora; no Supabase, a última cópia). */
  loadSync(): CatalogChanges
  /** As mudanças atuais (no Supabase, lidas da rede). */
  load(): Promise<CatalogChanges>
  /** Grava a mudança de um id (`null`: volta ao original) e devolve todas as mudanças. */
  save(kind: ChangeKind, id: string, change: AnyChange | null): Promise<CatalogChanges>
  /** Guarda a foto e devolve a referência para o campo `image` (`idb:` ou endereço). */
  uploadPhoto(blob: Blob): Promise<string>
  /** Endereços das fotos guardadas no aparelho (`idb:<id>` → `blob:`). Vazio no Supabase. */
  loadPhotoUrls(): Promise<Record<string, string>>
  signIn(password: string): Promise<boolean>
  signOut(): Promise<void>
  changePassword(next: string): Promise<boolean>
  isSignedIn(): boolean
  exportBackup(): Promise<string>
  importBackup(json: string): Promise<CatalogChanges>
  /**
   * Só no aparelho (pedido de 2026-11-17): apaga as fotos que nenhuma mudança usa e que têm mais de
   * 1 hora (uma recém-enviada por outra aba ainda vai ser gravada). Devolve as referências apagadas.
   */
  pruneUnusedPhotos?(now: number): Promise<string[]>
}

/** Fotos do aparelho (`idb:`) que alguma mudança usa. */
export function usedPhotoRefs(changes: CatalogChanges): Set<string> {
  return new Set(
    [...Object.values(changes.items), ...Object.values(changes.products), ...Object.values(changes.toppings)]
      .map((change) => change.image as string | undefined)
      .filter((image): image is string => Boolean(image?.startsWith('idb:'))),
  )
}

/** Quando a foto foi enviada, pelo id que o navegador gera (`foto-<ms em base 36>-...`). */
export function photoTime(id: string): number | null {
  const match = /^foto-([0-9a-z]+)-/.exec(id)
  if (!match) return null
  const ms = parseInt(match[1], 36)
  return Number.isFinite(ms) ? ms : null
}

const PRUNE_AFTER_MS = 3_600_000

export const CATALOG_KEY = 'acai_doce_sabor_seller_catalog_v1'
export const IMAGES_DB = 'acai_doce_sabor_seller_images'
const PASSWORD_KEY = 'acai_doce_sabor_seller_password_v1'
const SESSION_KEY = 'acai_doce_sabor_seller_session_v1'
/** Hash SHA-256 da senha inicial definida pelo responsável (ajuste de 2026-11-16; vale até ser trocada). */
const INITIAL_PASSWORD_HASH = 'c6cad5eff701c2484eb0561f073a564c3562dcf6335a6d8af8d4ddcded34051e'
/** Hash da senha inicial anterior: se ficou guardada (testes), dá lugar à senha nova. */
const PREVIOUS_INITIAL_HASH = '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab'
export const MIN_PASSWORD_LENGTH = 4

/* Mudanças: juntar uma nova às que existem. */

export function withChange(changes: CatalogChanges, kind: ChangeKind, id: string, change: AnyChange | null): CatalogChanges {
  const section: Record<string, AnyChange> = { ...changes[kind] }
  if (change === null) delete section[id]
  else section[id] = change
  return { ...changes, [kind]: section }
}

/* Backup: as mudanças e as fotos do aparelho (como data URLs), num arquivo .json. */

export type Backup = { app: 'acai-doce-sabor'; v: 1; createdAt: string; changes: CatalogChanges; photos: Record<string, string> }

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) return null
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: match[1] })
}

export function parseBackup(json: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    raw = null
  }
  const record = raw as Partial<Backup> | null
  if (!record || record.app !== 'acai-doce-sabor' || record.v !== 1) throw new Error('Arquivo de backup inválido')
  const photos: Record<string, string> = {}
  if (record.photos && typeof record.photos === 'object') {
    for (const [ref, data] of Object.entries(record.photos)) {
      if (typeof data === 'string' && ref.startsWith('idb:')) photos[ref] = data
    }
  }
  return { app: 'acai-doce-sabor', v: 1, createdAt: String(record.createdAt ?? ''), changes: parseChanges(record.changes), photos }
}

/* Gravação no aparelho */

export type LocalDeps = {
  store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  images: {
    put(id: string, blob: Blob): Promise<void>
    all(): Promise<[string, Blob][]>
    /** Só os ids (sem carregar as fotos). */
    ids(): Promise<string[]>
    delete(id: string): Promise<void>
  }
  hash(text: string): Promise<string>
  objectUrl(blob: Blob): string
  newId(): string
}

export function createLocalBackend(deps: LocalDeps): CatalogBackend {
  const { store } = deps

  const read = (): CatalogChanges => {
    try {
      return parseChanges(JSON.parse(store.getItem(CATALOG_KEY) ?? 'null'))
    } catch {
      return NO_CHANGES
    }
  }
  const write = (changes: CatalogChanges) => {
    store.setItem(CATALOG_KEY, JSON.stringify(changes))
    return changes
  }
  const passwordHash = () => {
    const saved = store.getItem(PASSWORD_KEY)
    if (saved === PREVIOUS_INITIAL_HASH) {
      store.removeItem(PASSWORD_KEY)
      return INITIAL_PASSWORD_HASH
    }
    return saved ?? INITIAL_PASSWORD_HASH
  }

  return {
    kind: 'local',
    loadSync: read,
    load: async () => read(),
    save: async (kind, id, change) => write(withChange(read(), kind, id, change)),
    async uploadPhoto(blob) {
      const id = deps.newId()
      await deps.images.put(id, blob)
      return `idb:${id}`
    },
    async loadPhotoUrls() {
      const entries = await deps.images.all()
      return Object.fromEntries(entries.map(([id, blob]) => [`idb:${id}`, deps.objectUrl(blob)]))
    },
    async signIn(password) {
      const ok = (await deps.hash(password)) === passwordHash()
      if (ok) store.setItem(SESSION_KEY, '1')
      return ok
    },
    async signOut() {
      store.removeItem(SESSION_KEY)
    },
    async changePassword(next) {
      if (store.getItem(SESSION_KEY) !== '1' || next.trim().length < MIN_PASSWORD_LENGTH) return false
      store.setItem(PASSWORD_KEY, await deps.hash(next.trim()))
      return true
    },
    isSignedIn: () => store.getItem(SESSION_KEY) === '1',
    async pruneUnusedPhotos(now) {
      const used = usedPhotoRefs(read())
      const removed: string[] = []
      for (const id of await deps.images.ids()) {
        const sentAt = photoTime(id)
        if (used.has(`idb:${id}`) || sentAt === null || now - sentAt < PRUNE_AFTER_MS) continue
        await deps.images.delete(id)
        removed.push(`idb:${id}`)
      }
      return removed
    },
    async exportBackup() {
      const changes = read()
      const used = usedPhotoRefs(changes)
      const photos: Record<string, string> = {}
      for (const [id, blob] of await deps.images.all()) {
        if (used.has(`idb:${id}`)) photos[`idb:${id}`] = await blobToDataUrl(blob)
      }
      const backup: Backup = { app: 'acai-doce-sabor', v: 1, createdAt: new Date().toISOString(), changes, photos }
      return JSON.stringify(backup)
    },
    async importBackup(json) {
      const backup = parseBackup(json)
      for (const [ref, data] of Object.entries(backup.photos)) {
        const blob = dataUrlToBlob(data)
        if (blob) await deps.images.put(ref.slice('idb:'.length), blob)
      }
      return write(backup.changes)
    },
  }
}

/* As peças de verdade do navegador */

function openImages(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGES_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('fotos')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function browserLocalDeps(): LocalDeps {
  return {
    store: window.localStorage,
    images: {
      async put(id, blob) {
        const db = await openImages()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('fotos', 'readwrite')
          tx.objectStore('fotos').put(blob, id)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        db.close()
      },
      async all() {
        const db = await openImages()
        const entries = await new Promise<[string, Blob][]>((resolve, reject) => {
          const tx = db.transaction('fotos', 'readonly')
          const store = tx.objectStore('fotos')
          const keys = store.getAllKeys()
          const values = store.getAll()
          tx.oncomplete = () => resolve(keys.result.map((key, index) => [String(key), values.result[index] as Blob]))
          tx.onerror = () => reject(tx.error)
        })
        db.close()
        return entries
      },
      async ids() {
        const db = await openImages()
        const keys = await new Promise<string[]>((resolve, reject) => {
          const tx = db.transaction('fotos', 'readonly')
          const request = tx.objectStore('fotos').getAllKeys()
          tx.oncomplete = () => resolve(request.result.map(String))
          tx.onerror = () => reject(tx.error)
        })
        db.close()
        return keys
      },
      async delete(id) {
        const db = await openImages()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('fotos', 'readwrite')
          tx.objectStore('fotos').delete(id)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        db.close()
      },
    },
    async hash(text) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    },
    objectUrl: (blob) => URL.createObjectURL(blob),
    newId: () => `foto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  }
}
