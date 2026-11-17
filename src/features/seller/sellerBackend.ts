/**
 * A gravação do modo vendedor em uso e a carga das mudanças ao abrir o site (pedido de
 * 2026-11-16):
 * - com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SELLER_EMAIL` no `.env.local`, o
 *   Supabase (para todos os clientes);
 * - sem elas, este aparelho.
 */
import { getCatalogChanges, setCatalogChanges, setPhotoUrls } from '../catalog/catalogStore.ts'
import { type CatalogBackend, browserLocalDeps, createLocalBackend } from '../../services/sellerCatalogStore.ts'
import { createSupabaseBackend } from '../../services/supabaseBackend.ts'
import { createSupabaseRest } from '../../services/supabaseRest.ts'

/** De quanto em quanto tempo a página aberta confere se o vendedor mudou algo (Supabase). */
const REFRESH_MS = 60_000

let backend: CatalogBackend | null = null
let photoUrls: Record<string, string> = {}

function supabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  // O nome pedido em 2026-11-16 (ANON_KEY) ou o do .env.example da Fase 0 (PUBLISHABLE_KEY).
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  const sellerEmail = String(import.meta.env.VITE_SELLER_EMAIL ?? '').trim()
  return url && key && sellerEmail ? { url, key, sellerEmail } : null
}

export function getSellerBackend(): CatalogBackend {
  if (backend) return backend
  const config = supabaseConfig()
  backend = config
    ? createSupabaseBackend(
        createSupabaseRest(config, {
          fetch: (input, init) => fetch(input, init),
          now: () => Date.now(),
          store: window.localStorage,
          randomId: () => Math.random().toString(36).slice(2, 10),
        }),
        window.localStorage,
      )
    : createLocalBackend(browserLocalDeps())
  return backend
}

/** Fotos do aparelho já com endereço (`idb:<id>` → `blob:`). */
export function addPhotoUrl(ref: string, blob: Blob): void {
  if (!ref.startsWith('idb:')) return
  photoUrls = { ...photoUrls, [ref]: URL.createObjectURL(blob) }
  setPhotoUrls(photoUrls)
}

/**
 * Depois de gravar ou restaurar (no aparelho): apaga as fotos que ninguém usa mais e libera o
 * endereço temporário delas (pedido de 2026-11-17). Falha aqui não atrapalha o vendedor.
 */
export async function cleanupPhotos(): Promise<void> {
  const current = getSellerBackend()
  if (!current.pruneUnusedPhotos) return
  try {
    const removed = await current.pruneUnusedPhotos(Date.now())
    const known = removed.filter((ref) => photoUrls[ref])
    if (known.length === 0) return
    const next = { ...photoUrls }
    for (const ref of known) {
      URL.revokeObjectURL(next[ref])
      delete next[ref]
    }
    photoUrls = next
    setPhotoUrls(photoUrls)
  } catch {
    // Sem acesso às fotos do aparelho agora: tenta de novo na próxima gravação.
  }
}

/** Lê de novo do Supabase e aplica, se mudou. Erro de rede: fica o que já está na tela. */
async function refresh(current: CatalogBackend): Promise<void> {
  try {
    const next = await current.load()
    if (JSON.stringify(next) !== JSON.stringify(getCatalogChanges())) setCatalogChanges(next)
  } catch {
    // Supabase fora do ar ou chave errada: o cardápio guardado continua valendo.
  }
}

/**
 * Antes de desenhar o site: aplica as mudanças guardadas (na hora). No aparelho, carrega depois as
 * fotos; no Supabase, lê a versão atual, de novo ao voltar para a aba e a cada minuto.
 * Sem armazenamento (aba anônima, bloqueio), fica o cardápio do código.
 */
export function initCatalog(): void {
  let current: CatalogBackend
  try {
    current = getSellerBackend()
    setCatalogChanges(current.loadSync())
  } catch {
    return
  }
  if (current.kind === 'local') {
    current
      .loadPhotoUrls()
      .then((urls) => {
        photoUrls = urls
        if (Object.keys(urls).length > 0) setPhotoUrls(urls)
      })
      .catch(() => {})
    return
  }
  void refresh(current)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refresh(current)
  })
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void refresh(current)
  }, REFRESH_MS)
}
