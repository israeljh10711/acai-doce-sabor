import { describe, expect, it } from 'vitest'
import type { OrderChange } from './ordersSource.ts'
import { type RealtimeConnect, createSupabaseOrdersSource, realtimeEndpoint } from './supabaseOrdersSource.ts'

/** Realtime de mentira: guarda a inscrição e deixa o teste mandar eventos e estados. */
function fakeRealtime() {
  const state = { args: null as Parameters<RealtimeConnect>[0] | null, stopped: 0, connections: 0 }
  const connect: RealtimeConnect = (args) => {
    state.args = args
    state.connections++
    return { stop: () => void state.stopped++ }
  }
  return { state, connect }
}

const rest = {
  readOrders: async (since: string) => [{ since }],
  setOrderStatus: async (id: string, status: string) => ({ id, status }),
  sellerToken: async () => 'token-do-vendedor',
}

describe('fonte do Supabase do painel ao vivo (2026-11-20)', () => {
  it('endereço do Realtime a partir do endereço do projeto', () => {
    expect(realtimeEndpoint('https://xyz.supabase.co/')).toBe('wss://xyz.supabase.co/realtime/v1')
    expect(realtimeEndpoint('http://127.0.0.1:5000')).toBe('ws://127.0.0.1:5000/realtime/v1')
  })

  it('carga dos pedidos do dia da loja e mudança de situação pela API', async () => {
    const source = createSupabaseOrdersSource({ rest, url: 'https://xyz.supabase.co', key: 'pub', now: () => Date.parse('2026-11-20T15:00:00-03:00'), connect: fakeRealtime().connect })
    expect(source.kind).toBe('supabase')
    expect(await source.load()).toEqual([{ since: '2026-11-20T08:00:00.000Z' }])
    expect(await source.setStatus('a', 'preparando')).toEqual({ id: 'a', status: 'preparando' })
  })

  it('inscrição com a chave pública e o token do vendedor; INSERT e UPDATE viram mudanças, DELETE não', async () => {
    const { state, connect } = fakeRealtime()
    const source = createSupabaseOrdersSource({ rest, url: 'https://xyz.supabase.co', key: 'pub', now: Date.now, connect })
    const changes: OrderChange[] = []
    const states: string[] = []
    source.listen((change) => changes.push(change), (live) => states.push(live))
    expect([state.args?.endpoint, state.args?.apikey, await state.args?.accessToken()]).toEqual(['wss://xyz.supabase.co/realtime/v1', 'pub', 'token-do-vendedor'])
    state.args?.onStatus('SUBSCRIBED')
    state.args?.onChange('INSERT', { id: 'n1' })
    state.args?.onChange('UPDATE', { id: 'n1', status: 'preparando' })
    state.args?.onChange('DELETE', { id: 'n1' })
    state.args?.onStatus('CHANNEL_ERROR')
    expect(changes).toEqual([
      { type: 'INSERT', row: { id: 'n1' } },
      { type: 'UPDATE', row: { id: 'n1', status: 'preparando' } },
    ])
    expect(states).toEqual(['connecting', 'live', 'offline'])
  })

  it('parar remove a inscrição uma vez só, e nada mais chega depois', () => {
    const { state, connect } = fakeRealtime()
    const source = createSupabaseOrdersSource({ rest, url: 'https://xyz.supabase.co', key: 'pub', now: Date.now, connect })
    const changes: OrderChange[] = []
    const stop = source.listen((change) => changes.push(change), () => undefined)
    stop()
    stop()
    state.args?.onChange('INSERT', { id: 'tarde' })
    expect([state.stopped, state.connections, changes]).toEqual([1, 1, []])
  })

  it('token do vendedor que não renova (sessão perdida): a inscrição segue sem token, sem derrubar o painel', async () => {
    const { state, connect } = fakeRealtime()
    createSupabaseOrdersSource({ rest: { ...rest, sellerToken: async () => Promise.reject(new Error('Vendedor sem sessão')) }, url: 'https://x.supabase.co', key: 'pub', now: Date.now, connect }).listen(
      () => undefined,
      () => undefined,
    )
    expect(await state.args?.accessToken()).toBeNull()
  })
})
