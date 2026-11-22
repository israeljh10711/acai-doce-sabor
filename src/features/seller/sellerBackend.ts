/**
 * A gravação do modo vendedor em uso e a carga das mudanças ao abrir o site (pedido de
 * 2026-11-16):
 * - com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SELLER_EMAIL` no `.env.local`, o
 *   Supabase (para todos os clientes);
 * - sem elas, este aparelho.
 */
import { acceptRecords, createCatalogLive } from '../catalog/catalogLive.ts'
import {
  getCatalogChanges,
  getCatalogRecords,
  refreshCatalogClock,
  setCatalogChanges,
  setCatalogRecords,
  setCatalogStatus,
  setPhotoUrls,
} from '../catalog/catalogStore.ts'
import { realtimeEndpoint } from '../orders/supabaseOrdersSource.ts'
import { baseCatalogRecords } from '../catalog/baseRecords.ts'
import { type CatalogRecords, parseCatalogRecords } from '../catalog/records.ts'
import { type CatalogWriter, createLocalWriter, createSupabaseWriter } from '../../services/catalogWriter.ts'
import {
  LOCAL_CATALOG_KEY,
  recordsToDatabase,
  type CatalogRepository,
  type LocalCatalogRepository,
  createLocalCatalogRepository,
  createSupabaseCatalogRepository,
} from '../../services/catalogRepository.ts'
import { type BackupCatalog, type CatalogBackend, browserLocalDeps, createLocalBackend } from '../../services/sellerCatalogStore.ts'
import { createSupabaseBackend } from '../../services/supabaseBackend.ts'
import { type SupabaseRest, createSupabaseRest } from '../../services/supabaseRest.ts'

/** De quanto em quanto tempo a página aberta confere se o vendedor mudou algo (Supabase). */
const REFRESH_MS = 60_000

let backend: CatalogBackend | null = null
let photoUrls: Record<string, string> = {}

/** O Supabase está ligado quando o `.env.local` tem as três: endereço, chave pública e e-mail do vendedor. */
export function supabaseConfig(): { url: string; key: string; sellerEmail: string } | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  // O nome pedido em 2026-11-16 (ANON_KEY) ou o do .env.example da Fase 0 (PUBLISHABLE_KEY).
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
  const sellerEmail = String(import.meta.env.VITE_SELLER_EMAIL ?? '').trim()
  return url && key && sellerEmail ? { url, key, sellerEmail } : null
}

let rest: SupabaseRest | null = null

/**
 * O cliente do Supabase do site (o mesmo do modo vendedor, com a sessão do vendedor). Sem o
 * Supabase ligado, `null`. O painel de pedidos (2026-11-20) lê e muda a situação por ele.
 */
export function getSupabaseRest(): SupabaseRest | null {
  const config = supabaseConfig()
  if (!config) return null
  rest ??= createSupabaseRest(config, {
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    store: window.localStorage,
    randomId: () => Math.random().toString(36).slice(2, 10),
  })
  return rest
}

export function getSellerBackend(): CatalogBackend {
  if (backend) return backend
  const supabase = getSupabaseRest()
  backend = supabase ? createSupabaseBackend(supabase, window.localStorage) : createLocalBackend(browserLocalDeps())
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
    // As fotos que os registros do cardápio usam (produtos, complementos e opções) ficam.
    const records = getCatalogRecords()
    const keep = new Set(
      records
        ? [...records.products.map((product) => product.image), ...records.options.map((option) => option.image ?? ""), ...records.choiceOptions.map((option) => option.photo ?? "")].filter((image) => image.startsWith("idb:"))
        : [],
    )
    const removed = await current.pruneUnusedPhotos(Date.now(), keep)
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

/** Lê o cardápio de novo agora (Supabase), por exemplo depois de o servidor recusar um pedido. */
export async function refreshCatalogNow(): Promise<void> {
  await refresh(getSellerBackend(), getCatalogRepository())
}

let repository: CatalogRepository | null = null

/** De onde vem o cardápio: o Supabase (catalogo_publico) ou os registros deste aparelho. */
export function getCatalogRepository(): CatalogRepository {
  if (repository) return repository
  const supabase = getSupabaseRest()
  repository = supabase ? createSupabaseCatalogRepository(supabase) : createLocalCatalogRepository(safeLocalStorage())
  return repository
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Mensagem do aviso quando o cardápio não carrega (o site não mostra o cardápio do código no lugar). */
export const CATALOG_ERROR_TEXT = 'Não foi possível carregar o cardápio. Confira a internet e tente de novo.'

/**
 * Lê as configurações da loja (catalog_changes) e o cardápio (registros). Se o cardápio nunca
 * carregou, o erro aparece na tela; se já carregou, o último continua valendo até a próxima leitura.
 */
async function refresh(current: CatalogBackend, source: CatalogRepository, force = false): Promise<void> {
  const [changes, records] = await Promise.allSettled([current.load(), source.load()])
  if (changes.status === 'fulfilled' && JSON.stringify(changes.value) !== JSON.stringify(getCatalogChanges())) setCatalogChanges(changes.value)
  if (records.status === 'fulfilled') {
    const known = getCatalogRecords()
    if (source.kind === 'local' || acceptRecords(known?.revision ?? null, records.value.revision, force)) setCatalogRecords(records.value)
    else refreshCatalogClock()
    return
  }
  if (!getCatalogRecords()) setCatalogStatus({ state: 'error', message: CATALOG_ERROR_TEXT })
}

export function initCatalog(): void {
  let current: CatalogBackend
  let source: CatalogRepository
  try {
    current = getSellerBackend()
    source = getCatalogRepository()
    setCatalogChanges(current.loadSync())
  } catch {
    setCatalogStatus({ state: 'error', message: CATALOG_ERROR_TEXT })
    return
  }
  if (source.kind === 'local') {
    try {
      setCatalogRecords((source as LocalCatalogRepository).loadSync())
    } catch {
      setCatalogStatus({ state: 'error', message: CATALOG_ERROR_TEXT })
    }
    current
      .loadPhotoUrls()
      .then((urls) => {
        photoUrls = urls
        if (Object.keys(urls).length > 0) setPhotoUrls(urls)
      })
      .catch(() => {})
    return
  }
  setCatalogStatus({ state: 'loading' })
  const live = createCatalogLive({
    reload: () => refresh(current, source),
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  })
  void refresh(current, source)
  listenCatalog(() => live.poke())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') live.poke()
  })
  window.setInterval(() => {
    if (document.visibilityState === 'visible') live.poke()
  }, REFRESH_MS)
  // Ofertas que começam ou acabam: confere a hora a cada minuto, sem ir ao banco.
  window.setInterval(() => refreshCatalogClock(), 60_000)
}

/** Realtime: a revisão do cardápio (catalog_meta) subiu. Sem sessão, entra como visitante. */
function listenCatalog(onChange: () => void): void {
  const config = supabaseConfig()
  if (!config) return
  import('../orders/realtimeConnect.ts')
    .then(({ connectRealtime }) =>
      connectRealtime({
        endpoint: realtimeEndpoint(config.url),
        apikey: config.key,
        accessToken: async () => null,
        table: 'catalog_meta',
        channel: 'cardapio-ao-vivo',
        onChange: () => onChange(),
        onStatus: () => undefined,
      }),
    )
    .catch(() => {
      // Sem Realtime: a leitura de tempos em tempos continua.
    })
}

let writer: CatalogWriter | null = null

/** Quem grava o cardápio: o Supabase (como vendedor) ou os registros deste aparelho. */
export function getCatalogWriter(): CatalogWriter {
  if (writer) return writer
  const supabase = getSupabaseRest()
  writer = supabase
    ? createSupabaseWriter(supabase)
    : createLocalWriter({
        load: () => getCatalogRecords() ?? baseCatalogRecords(),
        save: (records) => {
          // Guarda no aparelho antes de mostrar: se não couber, o erro aparece e nada muda na tela.
          safeLocalStorage()?.setItem(LOCAL_CATALOG_KEY, JSON.stringify(recordsToDatabase(records)))
          setCatalogRecords(records)
        },
        now: () => new Date().toISOString(),
      })
  return writer
}

/**
 * Grava no cardápio e, no Supabase, lê de novo (o site e o painel passam a mostrar o que ficou no
 * banco). O erro sobe para a tela mostrar ("Não foi possível salvar. Tente novamente.").
 */
export async function catalogWrite(action: (target: CatalogWriter) => Promise<void>): Promise<void> {
  const target = getCatalogWriter()
  await action(target)
  if (target.kind === 'supabase') await refresh(getSellerBackend(), getCatalogRepository(), true)
}

/** O cardápio como o vendedor vê (com o oculto), lido agora. */
export async function loadSellerRecords(): Promise<CatalogRecords> {
  const source = getCatalogRepository()
  const records = await source.load()
  if (source.kind === 'supabase') {
    const known = getCatalogRecords()
    if (!known || known.revision !== records.revision) setCatalogRecords(records)
  }
  return records
}

/** O cardápio que vai no backup, com as fotos do aparelho que ele usa. */
export function catalogForBackup(): BackupCatalog | undefined {
  const records = getCatalogRecords()
  if (!records) return undefined
  const photos = new Set(
    [...records.products.map((product) => product.image), ...records.options.map((option) => option.image ?? ''), ...records.choiceOptions.map((option) => option.photo ?? '')].filter((image) =>
      image.startsWith('idb:'),
    ),
  )
  return { data: recordsToDatabase(records), photos }
}

/**
 * Volta o cardápio de um backup v2 (só no aparelho). No Supabase, o cardápio do banco não é trocado
 * por um arquivo: o backup volta só as Configurações da loja, e o cardápio se muda pelo painel.
 * Devolve se o cardápio voltou.
 */
export function restoreCatalogFromBackup(json: string): boolean {
  if (getCatalogRepository().kind !== 'local') return false
  const raw = (JSON.parse(json) as { catalog?: unknown }).catalog
  if (raw === undefined) return false
  const records = parseCatalogRecords(raw)
  safeLocalStorage()?.setItem(LOCAL_CATALOG_KEY, JSON.stringify(recordsToDatabase(records)))
  setCatalogRecords(records)
  return true
}
