import { describe, expect, it } from 'vitest'
import { createOrderStore } from './orderStore.ts'
import type { OrderRow } from './orderServer.ts'

type Call = { url: string; method: string; headers: Record<string, string>; body: string | null }

/** `fetch` falso: guarda as chamadas e responde na ordem dada. */
function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET', headers: { ...(init?.headers as Record<string, string>) }, body: (init?.body as string) ?? null })
    const next = responses.shift() ?? { body: [] }
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
  return { fetchImpl, calls }
}

const ROW = { attempt_key: 'a'.repeat(64), code: 'ADS-0001', message: 'oi', total_cents: 500, whatsapp: '5583996999980' } as OrderRow

describe('banco dos pedidos pela API REST do Supabase (função pedido)', () => {
  it('chave nova (sb_secret_): só no cabeçalho apikey; chave antiga (JWT): também como Bearer', async () => {
    const modern = fakeFetch([{ body: [] }])
    await createOrderStore({ url: 'https://abc.supabase.co/', key: 'sb_secret_x' }, modern.fetchImpl).readChanges()
    expect(modern.calls[0].url).toBe('https://abc.supabase.co/rest/v1/catalog_changes?select=kind,id,data')
    expect(modern.calls[0].headers.apikey).toBe('sb_secret_x')
    expect(modern.calls[0].headers.Authorization).toBeUndefined()
    const legacy = fakeFetch([{ body: [] }])
    await createOrderStore({ url: 'https://abc.supabase.co', key: 'eyJabc' }, legacy.fetchImpl).readChanges()
    expect(legacy.calls[0].headers.Authorization).toBe('Bearer eyJabc')
  })

  it('procura o pedido pela chave de repetição; nenhum: null', async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: [{ code: 'ADS-0001', message: 'oi', total_cents: 500, whatsapp: '5583996999980' }] }, { body: [] }])
    const store = createOrderStore({ url: 'https://abc.supabase.co', key: 'k' }, fetchImpl)
    expect(await store.findOrder('f'.repeat(64))).toEqual({ code: 'ADS-0001', message: 'oi', total_cents: 500, whatsapp: '5583996999980' })
    expect(calls[0].url).toBe(`https://abc.supabase.co/rest/v1/orders?select=code,message,total_cents,whatsapp&attempt_key=eq.${'f'.repeat(64)}&limit=1`)
    expect(await store.findOrder('x')).toBeNull()
  })

  it('próximo número pela função do banco; resposta estranha é erro', async () => {
    const { fetchImpl, calls } = fakeFetch([{ body: 7 }, { body: '8' }, { body: 'x' }])
    const store = createOrderStore({ url: 'https://abc.supabase.co', key: 'k' }, fetchImpl)
    expect(await store.nextNumber()).toBe(7)
    expect(calls[0]).toMatchObject({ url: 'https://abc.supabase.co/rest/v1/rpc/proximo_numero_pedido', method: 'POST', body: '{}' })
    expect(await store.nextNumber()).toBe(8)
    await expect(store.nextNumber()).rejects.toThrow()
  })

  it('grava ignorando a mesma chave repetida; repetida volta null', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 201, body: [{ code: 'ADS-0001', message: 'oi', total_cents: 500, whatsapp: '5583996999980' }] }, { status: 201, body: [] }])
    const store = createOrderStore({ url: 'https://abc.supabase.co', key: 'k' }, fetchImpl)
    expect(await store.insertOrder(ROW)).toMatchObject({ code: 'ADS-0001' })
    expect(calls[0]).toMatchObject({ url: 'https://abc.supabase.co/rest/v1/orders?on_conflict=attempt_key&select=code,message,total_cents,whatsapp', method: 'POST' })
    expect(calls[0].headers.Prefer).toBe('return=representation,resolution=ignore-duplicates')
    expect(JSON.parse(calls[0].body ?? '{}')).toMatchObject({ attempt_key: 'a'.repeat(64), code: 'ADS-0001' })
    expect(await store.insertOrder(ROW)).toBeNull()
  })

  it('erro do Supabase (chave errada, fora do ar) vira erro', async () => {
    const { fetchImpl } = fakeFetch([{ status: 401, body: { message: 'Invalid API key' } }])
    await expect(createOrderStore({ url: 'https://abc.supabase.co', key: 'k' }, fetchImpl).readChanges()).rejects.toThrow('401')
  })
})
