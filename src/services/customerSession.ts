/**
 * A sessão anônima do cliente no Supabase Auth (pedido 100% no site, 2026-11-20).
 *
 * É ela que prova que um pedido é deste cliente: a função `pedido` confere o token no servidor de
 * login, o banco liga o pedido ao id da sessão e o Realtime (RLS) só entrega ao dono. O código
 * ADS-0001 nunca autoriza nada. A sessão fica no `localStorage` com chave própria (a do vendedor é
 * outra), nunca vai para a URL nem para log. Só `fetch`, sem pacote.
 */

export type CustomerSessionData = { accessToken: string; refreshToken: string; expiresAt: number; userId: string }

export type CustomerSessionDeps = {
  url: string
  key: string
  fetch: typeof fetch
  now(): number
  /** `null`: armazenamento indisponível (a sessão vale só nesta tela). */
  store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

export const CUSTOMER_SESSION_KEY = 'acai_doce_sabor_cliente_sessao_v1'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function createCustomerSession(deps: CustomerSessionDeps) {
  const base = deps.url.replace(/\/+$/, '')
  // A chave anon antiga é um JWT e vai também no Authorization; a publishable vai só no apikey.
  const publicHeaders: Record<string, string> = deps.key.startsWith('eyJ')
    ? { apikey: deps.key, Authorization: `Bearer ${deps.key}`, 'Content-Type': 'application/json' }
    : { apikey: deps.key, 'Content-Type': 'application/json' }
  let memory: CustomerSessionData | null = null
  let pending: Promise<string | null> | null = null

  const read = (): CustomerSessionData | null => {
    try {
      const raw: unknown = JSON.parse(deps.store?.getItem(CUSTOMER_SESSION_KEY) ?? 'null')
      if (isRecord(raw) && typeof raw.accessToken === 'string' && typeof raw.refreshToken === 'string' && typeof raw.expiresAt === 'number' && typeof raw.userId === 'string') {
        return raw as CustomerSessionData
      }
    } catch {
      // Armazenamento indisponível ou estragado: vale a da memória.
    }
    return memory
  }
  const write = (session: CustomerSessionData | null) => {
    memory = session
    try {
      if (session) deps.store?.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session))
      else deps.store?.removeItem(CUSTOMER_SESSION_KEY)
    } catch {
      // Fica só na memória desta tela.
    }
  }
  const fromBody = (body: unknown): CustomerSessionData | null => {
    if (!isRecord(body) || typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string' || typeof body.expires_in !== 'number') return null
    const user = isRecord(body.user) ? body.user : null
    if (!user || typeof user.id !== 'string') return null
    return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: deps.now() + body.expires_in * 1000, userId: user.id }
  }
  const call = async (path: string, body: unknown): Promise<CustomerSessionData | null> => {
    try {
      const response = await deps.fetch(`${base}${path}`, { method: 'POST', headers: publicHeaders, body: JSON.stringify(body) })
      if (!response.ok) return null
      return fromBody(await response.json())
    } catch {
      return null
    }
  }

  async function obtain(create: boolean): Promise<string | null> {
    const session = read()
    if (session && session.expiresAt - 60_000 > deps.now()) return session.accessToken
    if (session) {
      const renewed = await call('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refreshToken })
      if (renewed) {
        write(renewed)
        return renewed.accessToken
      }
      // Sessão que não renova (apagada ou vencida de vez): os pedidos dela não são mais acessíveis.
      write(null)
    }
    if (!create) return null
    // Login anônimo (precisa de "Allow anonymous sign-ins" no Supabase).
    const created = await call('/auth/v1/signup', { data: {} })
    if (!created) return null
    write(created)
    return created.accessToken
  }

  return {
    /**
     * Um token válido: o guardado, renovado se preciso; sem sessão, cria a anônima quando
     * `create` (ao finalizar um pedido). Falha: `null` (nunca lança).
     */
    token(options: { create: boolean }): Promise<string | null> {
      // Uma busca por vez: duas telas pedindo juntas não criam duas sessões.
      pending ??= obtain(options.create).finally(() => {
        pending = null
      })
      return pending
    },
    /** O id da sessão guardada (sem ir à rede). */
    userId: () => read()?.userId ?? null,
  }
}

export type CustomerSession = ReturnType<typeof createCustomerSession>
