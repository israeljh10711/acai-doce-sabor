/**
 * A gravação do modo vendedor em uso e a carga das mudanças ao abrir o site (pedido de
 * 2026-11-16). Sem as chaves do Supabase no `.env.local`, tudo fica neste aparelho.
 */
import { setCatalogChanges, setPhotoUrls } from '../catalog/catalogStore.ts'
import { type CatalogBackend, browserLocalDeps, createLocalBackend } from '../../services/sellerCatalogStore.ts'

let backend: CatalogBackend | null = null
let photoUrls: Record<string, string> = {}

export function getSellerBackend(): CatalogBackend {
  if (!backend) backend = createLocalBackend(browserLocalDeps())
  return backend
}

/** Fotos do aparelho já com endereço (`idb:<id>` → `blob:`). */
export function addPhotoUrl(ref: string, blob: Blob): void {
  if (!ref.startsWith('idb:')) return
  photoUrls = { ...photoUrls, [ref]: URL.createObjectURL(blob) }
  setPhotoUrls(photoUrls)
}

/**
 * Antes de desenhar o site: aplica as mudanças guardadas (na hora) e depois as fotos do aparelho.
 * Sem localStorage ou IndexedDB (aba anônima, bloqueio), fica o cardápio do código.
 */
export function initCatalog(): void {
  try {
    const current = getSellerBackend()
    setCatalogChanges(current.loadSync())
    current
      .loadPhotoUrls()
      .then((urls) => {
        photoUrls = urls
        if (Object.keys(urls).length > 0) setPhotoUrls(urls)
      })
      .catch(() => {})
  } catch {
    // Sem armazenamento: o cardápio do código.
  }
}
