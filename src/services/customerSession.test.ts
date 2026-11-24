import { describe, expect, it } from 'vitest'
import { CUSTOMER_SESSION_KEY, type CustomerSessionDeps, createCustomerSession } from './customerSession.ts'

const SESSION = { access_token: 'acesso-1', refresh_token: 'renova-1', expires_in: 3600, user: { id: 'cliente-1', is_anonymous: true } }

function fake(routes: (url: string, body: unknown) => { status: number; body?: unknown }, now = 1_000_000) {
  const calls: { url: string; body: unknown; headers: Record<string, string> }[] = []
  const map = new Map<string, string>()
  const deps: CustomerSessionDeps = {
    url: 'https://projeto.supabase.co',
    key: 'sb_publishable_123',
    fetch: async (input, init = {}) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null
      calls.push({ url: String(input), body, headers: Object.fromEntries(new Headers(init.headers).entries()) })
      const reply = routes(String(input), body)
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status })
    },
    now: () => now,
    store: { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) },
  }
  return { deps, calls, map }
}

describe('conta do cliente', () => {
  const ACCOUNT = {
    ...SESSION, access_token: 'acesso-conta', refresh_token: 'renova-conta',
    user: { id: 'uid-conta', app_metadata: { customer_account: true, customer_identifier: 'joão da silva' } },
  }
  it('preserva o visitante ao cadastrar, entrar e sair da conta no mesmo aparelho', async () => {
    const { deps, calls } = fake((url) => ({ status: 200, body: url.includes('/functions/v1/conta') ? ACCOUNT : SESSION }))
    const session = createCustomerSession(deps)
    const changes: (string | null)[] = []
    session.subscribe(() => changes.push(session.account()))
    await session.token({ create: true })
    await session.signUp('João da Silva', 'senha12345')
    expect(session.userId()).toBe('uid-conta')
    expect(session.account()).toBe('joão da silva')
    expect(await session.token({ create: false })).toBe('acesso-conta')
    await session.signOut()
    expect(session.userId()).toBe(SESSION.user.id)
    expect(await session.token({ create: false })).toBe('acesso-1')
    await session.signIn('João da Silva', 'senha12345')
    expect(calls.filter(call => call.url.includes('/functions/v1/conta')).map(call => call.body)).toEqual([
      { action: 'signup', identifier: 'João da Silva', password: 'senha12345' },
      { action: 'signin', identifier: 'João da Silva', password: 'senha12345' },
    ])
    expect(changes).toEqual([null, 'joão da silva', null, 'joão da silva'])
  })
  it('falha transitória ao renovar a conta mantém seu UID e não cria um visitante', async () => {
    const { deps, calls } = fake(url => url.includes('refresh_token') ? { status: 503 } : { status: 200, body: ACCOUNT })
    await createCustomerSession(deps).signIn('João da Silva', 'senha12345')
    const later = createCustomerSession({ ...deps, now: () => deps.now() + 4_000_000 })
    expect(await later.token({ create: true })).toBeNull()
    expect(later.account()).toBe('joão da silva')
    expect(calls).toHaveLength(2)
  })
})

describe('sessão anônima do cliente (pedido 100% no site, 2026-11-20)', () => {
  it('ao finalizar: cria a sessão anônima com a chave pública e guarda com chave própria', async () => {
    const { deps, calls, map } = fake(() => ({ status: 200, body: SESSION }))
    const session = createCustomerSession(deps)
    expect(await session.token({ create: true })).toBe('acesso-1')
    expect(calls[0]).toMatchObject({ url: 'https://projeto.supabase.co/auth/v1/signup', body: { data: {} }, headers: { apikey: 'sb_publishable_123' } })
    expect(calls[0].headers.authorization).toBeUndefined()
    expect(JSON.parse(map.get(CUSTOMER_SESSION_KEY) ?? '{}')).toMatchObject({ accessToken: 'acesso-1', refreshToken: 'renova-1', userId: 'cliente-1' })
    expect(session.userId()).toBe('cliente-1')
  })

  it('token ainda válido: sem ir à rede; quase vencido: renova', async () => {
    const { deps, calls } = fake((url) => (url.includes('refresh_token') ? { status: 200, body: { ...SESSION, access_token: 'acesso-2' } } : { status: 200, body: SESSION }))
    const session = createCustomerSession(deps)
    await session.token({ create: true })
    expect(await session.token({ create: false })).toBe('acesso-1')
    expect(calls).toHaveLength(1)
    const later = createCustomerSession({ ...deps, now: () => 1_000_000 + 3_590_000 })
    expect(await later.token({ create: false })).toBe('acesso-2')
    expect(calls[1]).toMatchObject({ url: 'https://projeto.supabase.co/auth/v1/token?grant_type=refresh_token', body: { refresh_token: 'renova-1' } })
  })

  it('sessão que não renova: apagada; acompanhar não cria outra, finalizar cria', async () => {
    const { deps, map } = fake((url) => (url.includes('refresh_token') ? { status: 400, body: { error: 'invalid_grant' } } : { status: 200, body: { ...SESSION, access_token: 'acesso-novo' } }))
    map.set(CUSTOMER_SESSION_KEY, JSON.stringify({ accessToken: 'velho', refreshToken: 'r', expiresAt: 0, userId: 'cliente-velho' }))
    const session = createCustomerSession(deps)
    expect(await session.token({ create: false })).toBeNull()
    expect(map.has(CUSTOMER_SESSION_KEY)).toBe(false)
    expect(await session.token({ create: true })).toBe('acesso-novo')
  })

  it('login anônimo desligado no Supabase (ou sem internet): null, sem lançar erro', async () => {
    const disabled = fake(() => ({ status: 422, body: { msg: 'Anonymous sign-ins are disabled' } }))
    expect(await createCustomerSession(disabled.deps).token({ create: true })).toBeNull()
    const offline = fake(() => ({ status: 200 }))
    const broken = { ...offline.deps, fetch: (async () => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch }
    expect(await createCustomerSession(broken).token({ create: true })).toBeNull()
  })

  it('duas telas pedindo ao mesmo tempo: uma sessão só', async () => {
    const { deps, calls } = fake(() => ({ status: 200, body: SESSION }))
    const session = createCustomerSession(deps)
    const [a, b] = await Promise.all([session.token({ create: true }), session.token({ create: true })])
    expect([a, b, calls.length]).toEqual(['acesso-1', 'acesso-1', 1])
  })

  it('armazenamento indisponível: a sessão vale na memória desta tela', async () => {
    const { deps } = fake(() => ({ status: 200, body: SESSION }))
    const broken = {
      ...deps,
      store: {
        getItem: () => {
          throw new Error('bloqueado')
        },
        setItem: () => {
          throw new Error('bloqueado')
        },
        removeItem: () => undefined,
      },
    }
    const session = createCustomerSession(broken)
    expect(await session.token({ create: true })).toBe('acesso-1')
    expect(await session.token({ create: false })).toBe('acesso-1')
  })
})
