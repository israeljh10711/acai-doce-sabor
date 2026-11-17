/**
 * Cliente mínimo da API REST do Supabase para o modo vendedor (pedido de 2026-11-16), com `fetch`
 * e sem pacote: leitura pública das mudanças do cardápio, login do vendedor (Supabase Auth, com o
 * e-mail do `.env.local` e a senha digitada), renovação do token, gravação e envio de fotos.
 *
 * Só a chave pública (anon ou publishable) fica no site. Quem pode gravar é decidido no banco
 * (RLS, `supabase/setup.sql`), não aqui.
 */
import type { AnyChange, ChangeKind } from './sellerCatalogStore.ts'

export type SupabaseConfig = { url: string; key: string; sellerEmail: string }

export type RestDeps = {
  fetch: typeof fetch
  now(): number
  store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  randomId(): string
}

export type ChangeRow = { kind: ChangeKind; id: string; data: unknown }

type Session = { accessToken: string; refreshToken: string; expiresAt: number }

const SESSION_KEY = 'acai_doce_sabor_seller_supabase_session_v1'
export const PHOTO_BUCKET = 'catalogo'

export function createSupabaseRest(config: SupabaseConfig, deps: RestDeps) {
  const base = config.url.replace(/\/+$/, '')
  // A chave anon antiga é um JWT e vai também no Authorization; a publishable vai só no apikey.
  const publicHeaders: Record<string, string> = config.key.startsWith('eyJ')
    ? { apikey: config.key, Authorization: `Bearer ${config.key}` }
    : { apikey: config.key }

  const readSession = (): Session | null => {
    try {
      const raw = JSON.parse(deps.store.getItem(SESSION_KEY) ?? 'null') as Session | null
      return raw && typeof raw.accessToken === 'string' && typeof raw.refreshToken === 'string' ? raw : null
    } catch {
      return null
    }
  }
  const writeSession = (session: Session | null) => {
    if (session) deps.store.setItem(SESSION_KEY, JSON.stringify(session))
    else deps.store.removeItem(SESSION_KEY)
  }
  const sessionFrom = (body: { access_token: string; refresh_token: string; expires_in: number }): Session => ({
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: deps.now() + body.expires_in * 1000,
  })

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await deps.fetch(`${base}${path}`, init)
    if (!response.ok) throw new Error(`Supabase respondeu ${response.status} em ${path.split('?')[0]}`)
    return response
  }

  /** Token válido do vendedor; renova se faltar menos de 1 minuto. Sem sessão, erro. */
  async function accessToken(): Promise<string> {
    const session = readSession()
    if (!session) throw new Error('Vendedor sem sessão')
    if (session.expiresAt - 60_000 > deps.now()) return session.accessToken
    try {
      const response = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { ...publicHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      })
      const next = sessionFrom(await response.json())
      writeSession(next)
      return next.accessToken
    } catch (error) {
      writeSession(null)
      throw error
    }
  }

  const authed = async (extra: Record<string, string> = {}) => ({ apikey: config.key, Authorization: `Bearer ${await accessToken()}`, ...extra })

  return {
    /** As mudanças do cardápio (leitura pública). */
    async readChanges(): Promise<ChangeRow[]> {
      const response = await request('/rest/v1/catalog_changes?select=kind,id,data', { headers: publicHeaders })
      const rows = (await response.json()) as unknown
      return Array.isArray(rows) ? (rows as ChangeRow[]) : []
    },

    /** Login do vendedor: senha certa e conta na tabela `sellers`. */
    async signIn(password: string): Promise<boolean> {
      try {
        const response = await request('/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: { ...publicHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: config.sellerEmail, password }),
        })
        writeSession(sessionFrom(await response.json()))
        const sellers = await request('/rest/v1/sellers?select=user_id', { headers: await authed() })
        const rows = (await sellers.json()) as unknown
        if (Array.isArray(rows) && rows.length > 0) return true
        writeSession(null)
        return false
      } catch {
        writeSession(null)
        return false
      }
    },

    async signOut(): Promise<void> {
      const session = readSession()
      writeSession(null)
      if (!session) return
      await deps
        .fetch(`${base}/auth/v1/logout`, { method: 'POST', headers: { apikey: config.key, Authorization: `Bearer ${session.accessToken}` } })
        .catch(() => undefined)
    },

    async changePassword(next: string): Promise<boolean> {
      try {
        await request('/auth/v1/user', {
          method: 'PUT',
          headers: await authed({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ password: next }),
        })
        return true
      } catch {
        return false
      }
    },

    isSignedIn: () => readSession() !== null,

    async upsert(kind: ChangeKind, id: string, data: AnyChange): Promise<void> {
      await request('/rest/v1/catalog_changes', {
        method: 'POST',
        headers: await authed({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify([{ kind, id, data, updated_at: new Date(deps.now()).toISOString() }]),
      })
    },

    async remove(kind: ChangeKind, id: string): Promise<void> {
      await request(`/rest/v1/catalog_changes?kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await authed(),
      })
    },

    /** Envia a foto para o bucket público e devolve o endereço dela. */
    async upload(blob: Blob): Promise<string> {
      const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
      const path = `fotos/${deps.now()}-${deps.randomId()}.${extension}`
      await request(`/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
        method: 'POST',
        headers: await authed({ 'Content-Type': blob.type || 'image/jpeg', 'cache-control': '31536000' }),
        body: blob,
      })
      return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
    },
  }
}

export type SupabaseRest = ReturnType<typeof createSupabaseRest>
