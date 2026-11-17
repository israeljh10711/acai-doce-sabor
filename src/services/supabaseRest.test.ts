import { describe, expect, it } from 'vitest'
import { createSupabaseBackend } from './supabaseBackend.ts'
import { type RestDeps, createSupabaseRest } from './supabaseRest.ts'

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown }

/** `fetch` falso: guarda cada chamada e responde pela rota. */
function fakeRest(routes: (call: Call) => { status: number; body?: unknown }, now = 1_000_000) {
  const calls: Call[] = []
  const storage = new Map<string, string>()
  const deps: RestDeps = {
    fetch: async (input, init = {}) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries())
      const raw = init.body
      const body = typeof raw === 'string' ? JSON.parse(raw) : raw instanceof Blob ? `blob:${raw.type}` : raw
      const call = { url: String(input), method: init.method ?? 'GET', headers, body }
      calls.push(call)
      const reply = routes(call)
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status })
    },
    now: () => now,
    store: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
      removeItem: (key) => void storage.delete(key),
    },
    randomId: () => 'abc123',
  }
  return { calls, storage, deps }
}

const CONFIG = { url: 'https://projeto.supabase.co', key: 'sb_publishable_123', sellerEmail: 'vendedor@loja.app' }
const TOKEN = { access_token: 'token-1', refresh_token: 'refresh-1', expires_in: 3600 }

describe('cliente REST do Supabase (modo vendedor, 2026-11-16)', () => {
  it('leitura pública: só a chave pública no apikey (chave publishable não vai no Authorization)', async () => {
    const { calls, deps } = fakeRest(() => ({ status: 200, body: [{ kind: 'items', id: 'sundae', data: { priceCents: 950 } }] }))
    const rows = await createSupabaseRest(CONFIG, deps).readChanges()
    expect(rows).toEqual([{ kind: 'items', id: 'sundae', data: { priceCents: 950 } }])
    expect(calls[0].url).toBe('https://projeto.supabase.co/rest/v1/catalog_changes?select=kind,id,data')
    expect(calls[0].headers.apikey).toBe('sb_publishable_123')
    expect(calls[0].headers.authorization).toBeUndefined()
  })

  it('chave anon antiga (JWT): vai também no Authorization', async () => {
    const { calls, deps } = fakeRest(() => ({ status: 200, body: [] }))
    await createSupabaseRest({ ...CONFIG, key: 'eyJhbGciOi.x.y' }, deps).readChanges()
    expect(calls[0].headers.authorization).toBe('Bearer eyJhbGciOi.x.y')
  })

  it('login com o e-mail do vendedor e a senha; confere que está na lista de vendedores', async () => {
    const { calls, deps } = fakeRest((call) =>
      call.url.includes('/auth/v1/token') ? { status: 200, body: TOKEN } : { status: 200, body: [{ user_id: 'u1' }] },
    )
    const rest = createSupabaseRest(CONFIG, deps)
    expect(await rest.signIn('senha-certa')).toBe(true)
    expect(calls[0].url).toBe('https://projeto.supabase.co/auth/v1/token?grant_type=password')
    expect(calls[0].body).toEqual({ email: 'vendedor@loja.app', password: 'senha-certa' })
    expect(calls[1].url).toBe('https://projeto.supabase.co/rest/v1/sellers?select=user_id')
    expect(calls[1].headers.authorization).toBe('Bearer token-1')
    expect(rest.isSignedIn()).toBe(true)
  })

  it('senha errada (400) ou conta fora da lista de vendedores: não entra', async () => {
    const wrong = fakeRest(() => ({ status: 400, body: { error: 'invalid_grant' } }))
    expect(await createSupabaseRest(CONFIG, wrong.deps).signIn('x')).toBe(false)
    const outsider = fakeRest((call) => (call.url.includes('/auth/') ? { status: 200, body: TOKEN } : { status: 200, body: [] }))
    const rest = createSupabaseRest(CONFIG, outsider.deps)
    expect(await rest.signIn('x')).toBe(false)
    expect(rest.isSignedIn()).toBe(false)
  })

  it('gravar: upsert com o token e "merge-duplicates"; apagar: DELETE pelo tipo e id', async () => {
    const { calls, deps } = fakeRest((call) =>
      call.url.includes('/auth/v1/token') ? { status: 200, body: TOKEN } : call.url.includes('sellers') ? { status: 200, body: [{ user_id: 'u1' }] } : { status: 201 },
    )
    const rest = createSupabaseRest(CONFIG, deps)
    await rest.signIn('s')
    await rest.upsert('items', 'sundae', { priceCents: 950 })
    const upsert = calls.at(-1)!
    expect(upsert.method).toBe('POST')
    expect(upsert.url).toBe('https://projeto.supabase.co/rest/v1/catalog_changes')
    expect(upsert.headers.prefer).toBe('resolution=merge-duplicates,return=minimal')
    expect(upsert.headers.authorization).toBe('Bearer token-1')
    expect(upsert.body).toEqual([{ kind: 'items', id: 'sundae', data: { priceCents: 950 }, updated_at: new Date(1_000_000).toISOString() }])
    await rest.remove('items', 'sundae')
    expect(calls.at(-1)).toMatchObject({ method: 'DELETE', url: 'https://projeto.supabase.co/rest/v1/catalog_changes?kind=eq.items&id=eq.sundae' })
  })

  it('token vencido é renovado antes de gravar', async () => {
    let now = 1_000_000
    const { calls, deps } = fakeRest((call) => {
      if (call.url.includes('grant_type=password')) return { status: 200, body: TOKEN }
      if (call.url.includes('grant_type=refresh_token')) return { status: 200, body: { ...TOKEN, access_token: 'token-2' } }
      if (call.url.includes('sellers')) return { status: 200, body: [{ user_id: 'u1' }] }
      return { status: 201 }
    })
    const rest = createSupabaseRest(CONFIG, { ...deps, now: () => now })
    await rest.signIn('s')
    now += 3600 * 1000
    await rest.upsert('items', 'sundae', { priceCents: 1 })
    expect(calls.map((call) => call.url.split('/').pop())).toContain('token?grant_type=refresh_token')
    expect(calls.at(-1)!.headers.authorization).toBe('Bearer token-2')
  })

  it('foto: envia para o bucket "catalogo" e devolve o endereço público', async () => {
    const { calls, deps } = fakeRest((call) =>
      call.url.includes('/auth/v1/token') ? { status: 200, body: TOKEN } : call.url.includes('sellers') ? { status: 200, body: [{ user_id: 'u1' }] } : { status: 200, body: { Key: 'x' } },
    )
    const rest = createSupabaseRest(CONFIG, deps)
    await rest.signIn('s')
    const url = await rest.upload(new Blob(['abc'], { type: 'image/webp' }))
    const upload = calls.at(-1)!
    expect(upload.url).toBe('https://projeto.supabase.co/storage/v1/object/catalogo/fotos/1000000-abc123.webp')
    expect(upload.headers['content-type']).toBe('image/webp')
    expect(url).toBe('https://projeto.supabase.co/storage/v1/object/public/catalogo/fotos/1000000-abc123.webp')
  })

  it('erro de rede na leitura vira exceção (quem chama mantém o cardápio guardado)', async () => {
    const { deps } = fakeRest(() => ({ status: 500, body: { message: 'fora do ar' } }))
    await expect(createSupabaseRest(CONFIG, deps).readChanges()).rejects.toThrow()
  })
})

describe('gravação no Supabase (CatalogBackend)', () => {
  it('lê as linhas, descarta campos inválidos e guarda a cópia para a próxima visita', async () => {
    const { deps, storage } = fakeRest(() => ({
      status: 200,
      body: [
        { kind: 'items', id: 'sundae', data: { priceCents: 950, bogus: 1 } },
        { kind: 'nada', id: 'x', data: {} },
        { kind: 'toppings', id: 'granola', data: { available: false } },
      ],
    }))
    const backend = createSupabaseBackend(createSupabaseRest(CONFIG, deps), deps.store)
    expect(backend.kind).toBe('supabase')
    const changes = await backend.load()
    expect(changes.items).toEqual({ sundae: { priceCents: 950 } })
    expect(changes.toppings).toEqual({ granola: { available: false } })
    expect([...storage.keys()]).toContain('acai_doce_sabor_catalog_cache_v1')
    expect(createSupabaseBackend(createSupabaseRest(CONFIG, deps), deps.store).loadSync()).toEqual(changes)
  })
})
