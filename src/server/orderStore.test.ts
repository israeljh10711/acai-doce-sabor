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
    expect(calls[0].url).toBe(`https://abc.supabase.co/rest/v1/orders?select=id,code,message,total_cents,whatsapp,created_at,customer_user_id&attempt_key=eq.${'f'.repeat(64)}&limit=1`)
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
    expect(calls[0]).toMatchObject({ url: 'https://abc.supabase.co/rest/v1/orders?on_conflict=attempt_key&select=id,code,message,total_cents,whatsapp,created_at,customer_user_id', method: 'POST' })
    expect(calls[0].headers.Prefer).toBe('return=representation,resolution=ignore-duplicates')
    expect(JSON.parse(calls[0].body ?? '{}')).toMatchObject({ attempt_key: 'a'.repeat(64), code: 'ADS-0001' })
    expect(await store.insertOrder(ROW)).toBeNull()
  })

  it('erro do Supabase (chave errada, fora do ar) vira erro', async () => {
    const { fetchImpl } = fakeFetch([{ status: 401, body: { message: 'Invalid API key' } }])
    await expect(createOrderStore({ url: 'https://abc.supabase.co', key: 'k' }, fetchImpl).readChanges()).rejects.toThrow('401')
  })
})

describe('consultas do acompanhamento (pedido 100% no site, 2026-11-20)', () => {
  const store = (responses: { status?: number; body: unknown }[]) => {
    const fake = fakeFetch(responses)
    return { ...fake, db: createOrderStore({ url: 'https://abc.supabase.co', key: 'sb_secret_k' }, fake.fetchImpl) }
  }

  it('confere a sessão do cliente no servidor de login: id da sessão, ou null (sem lançar erro)', async () => {
    const ok = store([{ body: { id: 'sessao-1', is_anonymous: true } }])
    expect(await ok.db.verifyCustomer('token-x')).toBe('sessao-1')
    expect(ok.calls[0]).toMatchObject({ url: 'https://abc.supabase.co/auth/v1/user', method: 'GET', headers: { apikey: 'sb_secret_k', Authorization: 'Bearer token-x' } })
    expect(await store([{ status: 401, body: { msg: 'invalid JWT' } }]).db.verifyCustomer('vencido')).toBeNull()
    expect(await store([{ body: {} }]).db.verifyCustomer('estranho')).toBeNull()
  })

  it('pedido pelo id, pedidos da sessão desde a data e o histórico', async () => {
    const { db, calls } = store([{ body: [{ id: 'p1' }] }, { body: [{ id: 'p1' }] }, { body: [{ kind: 'status' }] }])
    expect(await db.findOrderById('p1')).toEqual({ id: 'p1' })
    expect(await db.listCustomerOrders('sessao-1', '2026-10-21T00:00:00.000Z')).toEqual([{ id: 'p1' }])
    expect(await db.readEvents('p1')).toEqual([{ kind: 'status' }])
    expect(new URL(calls[0].url).searchParams.get('id')).toBe('eq.p1')
    const list = new URL(calls[1].url).searchParams
    expect([list.get('customer_user_id'), list.get('created_at'), list.get('order')]).toEqual(['eq.sessao-1', 'gte.2026-10-21T00:00:00.000Z', 'created_at.desc'])
    expect(calls[2].url).toBe('https://abc.supabase.co/rest/v1/order_events?select=kind,status,created_at&order_id=eq.p1&order=id.asc')
  })

  it('acréscimo pela função SQL, com os nomes dos parâmetros dela', async () => {
    const { db, calls } = store([{ body: { ok: true, total_cents: 800 } }])
    const result = await db.addItems({ orderId: 'p1', customerId: 's1', attemptKey: 'k'.repeat(64), batch: { items: [], cart: {}, itemsBlock: 'x' }, subtotalCents: 300, changeForCents: null, changeSet: false })
    expect(result).toEqual({ ok: true, total_cents: 800 })
    expect(calls[0]).toMatchObject({ url: 'https://abc.supabase.co/rest/v1/rpc/adicionar_itens_pedido', method: 'POST' })
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({
      p_order_id: 'p1',
      p_customer_user_id: 's1',
      p_attempt_key: 'k'.repeat(64),
      p_batch: { items: [], cart: {}, itemsBlock: 'x' },
      p_subtotal_cents: 300,
      p_change_for_cents: null,
      p_change_set: false,
    })
  })
})
