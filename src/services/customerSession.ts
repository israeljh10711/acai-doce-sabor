/** Sessões distintas para o visitante e para a conta. Ambas usam o UID emitido pelo Supabase. */
export type CustomerSessionData = { accessToken: string; refreshToken: string; expiresAt: number; userId: string; identifier?: string }

export type CustomerSessionDeps = {
  url: string
  key: string
  fetch: typeof fetch
  now(): number
  store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

export const CUSTOMER_SESSION_KEY = 'acai_doce_sabor_cliente_sessao_v1'
export const CUSTOMER_ACCOUNT_KEY = 'acai_doce_sabor_conta_v1'
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const unavailable = () => new Error('Não foi possível acessar a conta. Confira a conexão e tente novamente.')

export function createCustomerSession(deps: CustomerSessionDeps) {
  const base = deps.url.replace(/\/+$/, '')
  const headers: Record<string, string> = { apikey: deps.key, 'Content-Type': 'application/json' }
  if (deps.key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + deps.key
  const memory = new Map<string, CustomerSessionData>()
  const listeners = new Set<() => void>()
  let queue: Promise<unknown> = Promise.resolve()
  let storage = deps.store
  const read = (key: string): CustomerSessionData | null => {
    try {
      if (storage) {
        const raw: unknown = JSON.parse(storage.getItem(key) ?? 'null')
        if (isRecord(raw) && typeof raw.accessToken === 'string' && typeof raw.refreshToken === 'string' && typeof raw.expiresAt === 'number' && typeof raw.userId === 'string') return raw as CustomerSessionData
        return null
      }
    } catch { /* Armazenamento privado indisponível. */ }
    return memory.get(key) ?? null
  }
  const notify = () => { for (const listener of listeners) listener() }
  const write = (key: string, session: CustomerSessionData | null) => {
    if (session) memory.set(key, session)
    else memory.delete(key)
    try {
      if (session) storage?.setItem(key, JSON.stringify(session))
      else storage?.removeItem(key)
    } catch { storage = null }
    notify()
  }
  const fromBody = (body: unknown): CustomerSessionData | null => {
    if (!isRecord(body) || typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string' || typeof body.expires_in !== 'number' || !isRecord(body.user) || typeof body.user.id !== 'string') return null
    const metadata = body.user.app_metadata
    const identifier = isRecord(metadata) && metadata.customer_account === true && typeof metadata.customer_identifier === 'string' ? metadata.customer_identifier : undefined
    return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: deps.now() + body.expires_in * 1000, userId: body.user.id, identifier }
  }
  // Uma renovação por origem, inclusive quando duas abas reutilizariam o mesmo refresh token.
  const locked = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = () => globalThis.navigator?.locks ? navigator.locks.request(CUSTOMER_ACCOUNT_KEY, operation) : operation()
    const next = queue.then(run, run)
    queue = next.catch(() => undefined)
    return next
  }
  const post = (path: string, data: unknown) => deps.fetch(base + path, { method: 'POST', headers, body: JSON.stringify(data), signal: AbortSignal.timeout(15000) })

  async function obtain(create: boolean): Promise<string | null> {
    const account = read(CUSTOMER_ACCOUNT_KEY)
    const key = account ? CUSTOMER_ACCOUNT_KEY : CUSTOMER_SESSION_KEY
    const session = account ?? read(key)
    if (session && session.expiresAt - 60_000 > deps.now()) return session.accessToken
    try {
      if (session) {
        const response = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refreshToken })
        if (response.ok) {
          const next = fromBody(await response.json())
          if (!next || next.userId !== session.userId || (account && !next.identifier)) return null
          write(key, next)
          return next.accessToken
        }
        if (![400, 401, 403].includes(response.status)) return null
        write(key, null)
        if (account) return null
      }
      if (!create) return null
      const response = await post('/auth/v1/signup', { data: {} })
      if (!response.ok) return null
      const guest = fromBody(await response.json())
      if (!guest || guest.identifier) return null
      write(CUSTOMER_SESSION_KEY, guest)
      return guest.accessToken
    } catch { return null }
  }
  const authenticate = (action: 'signin' | 'signup', identifier: string, password: string) => locked(async () => {
    const response = await post('/functions/v1/conta', { action, identifier, password }).catch(() => { throw unavailable() })
    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) throw isRecord(data) && typeof data.message === 'string' ? new Error(data.message) : unavailable()
    const session = fromBody(data)
    if (!session?.identifier) throw unavailable()
    write(CUSTOMER_ACCOUNT_KEY, session)
  })
  if (typeof window !== 'undefined') window.addEventListener('storage', event => {
    if (!event.key || event.key === CUSTOMER_ACCOUNT_KEY || event.key === CUSTOMER_SESSION_KEY) notify()
  })
  return {
    token: ({ create }: { create: boolean }) => locked(() => obtain(create)),
    userId: () => (read(CUSTOMER_ACCOUNT_KEY) ?? read(CUSTOMER_SESSION_KEY))?.userId ?? null,
    account: () => read(CUSTOMER_ACCOUNT_KEY)?.identifier ?? null,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    signIn: (id: string, password: string) => authenticate('signin', id, password),
    signUp: (id: string, password: string) => authenticate('signup', id, password),
    signOut: () => locked(async () => {
      if (!read(CUSTOMER_ACCOUNT_KEY)) return
      const token = await obtain(false)
      write(CUSTOMER_ACCOUNT_KEY, null)
      if (token) await deps.fetch(base + '/auth/v1/logout?scope=local', {
        method: 'POST', headers: { apikey: deps.key, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000),
      }).catch(() => undefined)
    }),
  }
}

export type CustomerSession = ReturnType<typeof createCustomerSession>
