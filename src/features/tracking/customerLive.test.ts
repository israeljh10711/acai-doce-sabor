import { describe, expect, it } from 'vitest'
import { type CustomerListen, createCustomerLive } from './customerLive.ts'
import type { OrderView } from './orderView.ts'
import type { TrackedOrder } from './trackedOrders.ts'
import type { LookupResult, TrackingApi } from './trackingApi.ts'

const view = (id: string, status: OrderView['status']): OrderView => ({
  id,
  code: `ADS-${id}`,
  createdAt: '2026-11-20T18:00:00.000Z',
  updatedAt: '2026-11-20T18:00:00.000Z',
  status,
  fulfillment: 'local',
  address: null,
  itemsBlock: '',
  items: [],
  additions: [],
  subtotalCents: 300,
  fee: { kind: 'local', cents: 0, zone: null },
  totalCents: 300,
  paymentMethod: 'pix',
  changeForCents: null,
  antecipado: false,
  events: [],
})

function setup(statuses: Record<string, OrderView['status']>) {
  const state = { statuses: { ...statuses }, lookups: [] as string[], stopped: 0, hold: null as null | (() => void), fail: new Set<string>() }
  let onChange: (id: string | null) => void = () => undefined
  let onState: (live: 'connecting' | 'live' | 'offline') => void = () => undefined
  const api: TrackingApi = {
    kind: 'supabase',
    lookup: async (id): Promise<LookupResult> => {
      state.lookups.push(id)
      if (state.hold) await new Promise<void>((resolve) => (state.hold = resolve))
      if (state.fail.has(id)) return { ok: false, reason: 'falha' }
      const status = state.statuses[id]
      return status ? { ok: true, order: view(id, status) } : { ok: false, reason: 'nao-encontrado' }
    },
    add: async () => ({ ok: false, reason: 'falha' }),
  }
  const trackedList: TrackedOrder[] = Object.keys(statuses).map((id) => ({ id, code: `ADS-${id}`, createdAt: '2026-11-20T18:00:00.000Z', status: statuses[id], fulfillment: 'local', demo: false, tracked: true }))
  const saved: Record<string, string> = {}
  const tracked = {
    active: () => trackedList.filter((order) => order.status !== 'concluido' && order.status !== 'cancelado'),
    setStatus: (id: string, status: OrderView['status']) => void (saved[id] = status),
  }
  let listens = 0
  const listen: CustomerListen = (change, live) => {
    listens++
    onChange = change
    onState = live
    return () => void state.stopped++
  }
  const timers = new Map<number, () => void>()
  const timeouts = new Map<number, () => void>()
  let next = 0
  const fakeTimers = {
    setInterval: (callback: () => void) => (timers.set(++next, callback), next),
    clearInterval: (id: number) => void timers.delete(id),
    setTimeout: (callback: () => void) => (timeouts.set(++next, callback), next),
    clearTimeout: (id: number) => void timeouts.delete(id),
  }
  const live = createCustomerLive({ api, tracked, listen, timers: fakeTimers })
  /** Faz passar o tempo de espera antes de fechar. */
  const elapse = () => {
    const pending = [...timeouts.entries()]
    timeouts.clear()
    for (const [, callback] of pending) callback()
  }
  return { live, state, saved, timers, timeouts, elapse, listens: () => listens, change: (id: string | null) => onChange(id), setState: (s: 'live' | 'offline') => onState(s) }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('acompanhamento ao vivo do cliente (2026-11-20)', () => {
  it('ao ligar: consulta os pedidos em andamento deste aparelho (os encerrados não)', async () => {
    const { live, state } = setup({ a: 'novo', b: 'preparando', c: 'concluido' })
    live.start()
    await settle()
    expect(state.lookups.sort()).toEqual(['a', 'b'])
    expect(Object.keys(live.getSnapshot().views).sort()).toEqual(['a', 'b'])
  })

  it('aviso do Realtime: consulta só aquele pedido e guarda a situação nova no aparelho', async () => {
    const { live, state, saved, change } = setup({ a: 'novo' })
    live.start()
    await settle()
    state.statuses.a = 'preparando'
    change('a')
    await settle()
    expect([live.getSnapshot().views.a.status, saved.a]).toEqual(['preparando', 'preparando'])
  })

  it('avisos repetidos durante uma consulta: no máximo uma consulta a mais', async () => {
    const { live, state, change } = setup({ a: 'novo' })
    live.start()
    await settle()
    state.lookups.length = 0
    state.hold = () => undefined
    change('a')
    change('a')
    change('a')
    const release = state.hold
    state.hold = null
    release?.()
    await settle()
    await settle()
    expect(state.lookups).toEqual(['a', 'a'])
  })

  it('falha na consulta: guarda o motivo e mantém o último estado conhecido', async () => {
    const { live, state, change } = setup({ a: 'novo' })
    live.start()
    await settle()
    state.fail.add('a')
    change('a')
    await settle()
    expect([live.getSnapshot().views.a.status, live.getSnapshot().errors.a]).toEqual(['novo', 'falha'])
    state.fail.delete('a')
    change('a')
    await settle()
    expect(live.getSnapshot().errors.a).toBeUndefined()
  })

  it('a tela de um pedido encerrado continua consultando o dele', async () => {
    const { live, state } = setup({ c: 'concluido' })
    const unwatch = live.watch('c')
    live.start()
    await settle()
    expect(state.lookups).toEqual(['c'])
    unwatch()
  })

  it('sem conexão: consulta a cada 20 s; ao reconectar, confere tudo de novo', async () => {
    const { live, state, timers, setState } = setup({ a: 'novo' })
    live.start()
    await settle()
    setState('offline')
    expect(live.getSnapshot().live).toBe('offline')
    state.lookups.length = 0
    for (const callback of timers.values()) callback()
    await settle()
    expect(state.lookups).toEqual(['a'])
    setState('live')
    await settle()
    expect([live.getSnapshot().live, state.lookups]).toEqual(['live', ['a', 'a']])
  })

  it('desligar: remove a escuta e o relógio depois da espera (a faixa e a tela dividem uma escuta só)', () => {
    const { live, state, timers, elapse } = setup({ a: 'novo' })
    live.start()
    live.start()
    live.stop()
    expect(state.stopped).toBe(0)
    live.stop()
    expect(state.stopped).toBe(0)
    elapse()
    expect([state.stopped, timers.size, live.getSnapshot().live]).toEqual([1, 0, 'off'])
  })

  it('troca de tela (uma larga e a outra pega logo): a mesma conexão continua, sem fechar e abrir', async () => {
    const { live, state, elapse, listens, timeouts } = setup({ a: 'novo' })
    live.start()
    await settle()
    live.stop()
    live.start()
    elapse()
    await settle()
    expect([listens(), state.stopped, timeouts.size, live.getSnapshot().live]).toEqual([1, 0, 0, 'connecting'])
  })

  it('sessão nova durante a espera: a conexão antiga sai na hora (a próxima tela abre com a sessão nova)', () => {
    const { live, state, listens } = setup({ a: 'novo' })
    live.start()
    live.stop()
    live.restart()
    expect([state.stopped, live.getSnapshot().live]).toEqual([1, 'off'])
    live.start()
    expect(listens()).toBe(2)
  })
})

describe('acompanhamento ao vivo: sessão nova (2026-11-20)', () => {
  it('o primeiro pedido criou a sessão: escuta de novo (a antiga sai) e confere tudo', async () => {
    const { live, state } = setup({ a: 'novo' })
    live.start()
    await settle()
    state.lookups.length = 0
    live.restart()
    await settle()
    expect([state.stopped, state.lookups]).toEqual([1, ['a']])
  })

  it('pedido aberto na tela com a escuta já ligada: consulta na hora', async () => {
    const { live, state } = setup({})
    live.start()
    await settle()
    state.statuses.z = 'pronto_retirada'
    live.watch('z')
    await settle()
    expect([state.lookups, live.getSnapshot().views.z?.status]).toEqual([['z'], 'pronto_retirada'])
  })
})
