/**
 * Cliente mínimo da API REST do Supabase para o modo vendedor (pedido de 2026-11-16), com `fetch`
 * e sem pacote: leitura pública das mudanças do cardápio, login do vendedor (Supabase Auth, com o
 * e-mail do `.env.local` e a senha digitada), renovação do token, gravação e envio de fotos.
 *
 * Só a chave pública (anon ou publishable) fica no site. Quem pode gravar é decidido no banco
 * (RLS, `supabase/setup.sql`), não aqui.
 */
import type { OrderStatus } from '../features/orders/ordersPanel.ts'
import type { AnyChange, ChangeKind } from './sellerCatalogStore.ts'

export type SupabaseConfig = { url: string; key: string }

/** Erro ao gravar o cardápio, com o código e a mensagem do banco. */
export class CatalogWriteError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: string
  constructor(status: number, code: string, detail: string) {
    super(`Supabase recusou a gravação (${status}${code ? ` ${code}` : ''})`)
    this.name = 'CatalogWriteError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

class LoginLimitError extends Error {
  constructor() { super('Muitas tentativas. Aguarde alguns minutos e tente novamente.') }
}

export type RestDeps = {
  fetch: typeof fetch
  now(): number
  store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  randomId(): string
}

export type ChangeRow = { kind: ChangeKind; id: string; data: unknown }

type Session = { accessToken: string; refreshToken: string; expiresAt: number }

const SESSION_KEY = 'acai_doce_sabor_seller_supabase_session_v2'
export const PHOTO_BUCKET = 'catalogo'

/** O que o painel de pedidos lê de cada pedido (pedido de 2026-11-20, etapa 2). */
const ORDER_COLUMNS = [
  'id',
  'number',
  'code',
  'created_at',
  'status',
  'customer_name',
  'customer_phone',
  'fulfillment',
  'address',
  'delivery_fee',
  'delivery_fee_cents',
  'delivery_zone',
  'customer_lat',
  'customer_lng',
  'maps_url',
  'payment_method',
  'change_for_cents',
  'subtotal_cents',
  'total_cents',
  'antecipado',
  'items',
  'message',
  // Acompanhamento do cliente (2026-11-20): os itens acrescentados e a hora da última mudança.
  'additions',
  'updated_at',
].join(',')

/** Os pedidos de dias anteriores que ainda aparecem: os que não foram concluídos nem cancelados. */
const OPEN_FILTER = 'status.in.(novo,confirmado,preparando,pronto,pronto_retirada,pronto_consumo,saiu_para_entrega)'

export function createSupabaseRest(config: SupabaseConfig, deps: RestDeps) {
  const base = config.url.replace(/\/+$/, '')
  // A sessão anterior à proteção por sessão precisa de um novo login e contém tokens antigos.
  try { deps.store.removeItem('acai_doce_sabor_seller_supabase_session_v1') } catch { /* Armazenamento indisponível. */ }
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

  /**
   * Gravação do cardápio (cardápio dinâmico, 2026-11-21): com o token do vendedor; o erro guarda
   * o código e a mensagem do banco (as guardas falam português: "A categoria ainda tem produtos").
   */
  async function write(path: string, init: RequestInit): Promise<Response> {
    const response = await deps.fetch(`${base}${path}`, { ...init, headers: await authed({ 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) }) })
    if (response.ok) return response
    let body: { code?: unknown; message?: unknown } = {}
    try {
      body = (await response.json()) as typeof body
    } catch {
      body = {}
    }
    throw new CatalogWriteError(response.status, typeof body.code === 'string' ? body.code : '', typeof body.message === 'string' ? body.message : '')
  }
  const filterOf = (key: Readonly<Record<string, string>>) =>
    Object.entries(key)
      .map(([column, value]) => `${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`)
      .join('&')

  return {
    /**
     * O cardápio do banco (`catalogo_publico()`, cardápio dinâmico de 2026-11-21). Com o vendedor
     * logado, vai com o token dele e vem também o oculto e o arquivado (o RLS decide).
     */
    async readCatalog(): Promise<unknown> {
      const headers = readSession() ? await authed() : publicHeaders
      const response = await request('/rest/v1/rpc/catalogo_publico', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      })
      return (await response.json()) as unknown
    },

    /** Chama uma função do banco (RPC) como vendedor e devolve a resposta. */
    async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
      const response = await write(`/rest/v1/rpc/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(args) })
      const text = await response.text()
      return text ? (JSON.parse(text) as unknown) : null
    },

    /** Cria ou troca uma linha inteira (pela chave primária), como vendedor. */
    async upsertRow(table: string, row: Record<string, unknown>, conflict: string): Promise<void> {
      await write(`/rest/v1/${encodeURIComponent(table)}?on_conflict=${encodeURIComponent(conflict)}`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      })
    },

    /** Muda campos de uma linha (pela chave), como vendedor. Nenhuma linha mudou: erro. */
    async patchRow(table: string, key: Readonly<Record<string, string>>, fields: Record<string, unknown>): Promise<void> {
      const response = await write(`/rest/v1/${encodeURIComponent(table)}?${filterOf(key)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(fields),
      })
      const rows = (await response.json()) as unknown
      if (!Array.isArray(rows) || rows.length === 0) throw new CatalogWriteError(404, 'PGRST116', 'Nada mudou: o item não existe mais ou a sessão de vendedor acabou.')
    },

    /** As mudanças do cardápio (leitura pública). */
    async readChanges(): Promise<ChangeRow[]> {
      const response = await request('/rest/v1/catalog_changes?select=kind,id,data', { headers: publicHeaders })
      const rows = (await response.json()) as unknown
      return Array.isArray(rows) ? (rows as ChangeRow[]) : []
    },

    /** Login do vendedor: senha certa e conta na tabela `sellers`. */
    async signIn(password: string): Promise<boolean> {
      try {
        const response = await deps.fetch(base + '/functions/v1/conta', {
          method: 'POST',
          headers: { ...publicHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'seller', password }),
        })
        if (response.status === 429) throw new LoginLimitError()
        if (!response.ok) return false
        writeSession(sessionFrom(await response.json()))
        const sellers = await request('/rest/v1/sellers?select=user_id', { headers: await authed() })
        const rows = (await sellers.json()) as unknown
        if (Array.isArray(rows) && rows.length > 0) return true
        writeSession(null)
        return false
      } catch (error) {
        writeSession(null)
        if (error instanceof LoginLimitError) throw error
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
        await request('/functions/v1/conta', {
          method: 'POST',
          headers: await authed({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ action: 'seller-password', password: next }),
        })
        return true
      } catch {
        return false
      }
    },

    isSignedIn: () => readSession() !== null,

    /** O token do vendedor (renovado se precisar), para a inscrição do Realtime (2026-11-20). */
    sellerToken: () => accessToken(),

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

    /**
     * Pedidos para o painel do vendedor (pedido de 2026-11-20, etapa 2): os gravados desde `since`
     * (o começo do dia da loja) e os de antes ainda em andamento, os mais novos primeiro, até 200.
     * Só o vendedor logado lê (regra do banco).
     */
    async readOrders(since: string): Promise<unknown[]> {
      const params = new URLSearchParams({
        select: ORDER_COLUMNS,
        or: `(created_at.gte."${since}",${OPEN_FILTER})`,
        order: 'created_at.desc',
        limit: '200',
      })
      const response = await request(`/rest/v1/orders?${params.toString()}`, { headers: await authed() })
      const rows = (await response.json()) as unknown
      return Array.isArray(rows) ? rows : []
    },

    /**
     * Muda só a situação do pedido (o banco não deixa o vendedor mudar mais nada) e devolve a
     * linha nova. `null`: nenhuma linha mudou (o pedido sumiu ou o vendedor perdeu a permissão).
     */
    async setOrderStatus(id: string, status: OrderStatus): Promise<unknown> {
      const response = await request(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`, {
        method: 'PATCH',
        headers: await authed({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify({ status }),
      })
      const rows = (await response.json()) as unknown
      return Array.isArray(rows) && rows.length > 0 ? (rows[0] as unknown) : null
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
