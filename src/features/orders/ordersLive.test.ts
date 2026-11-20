import { describe, expect, it } from 'vitest'
import { createOrdersLive } from './ordersLive.ts'
import type { OrderChange, LiveState, OrdersSource } from './ordersSource.ts'

const row = (id: string, status = 'novo', patch: Record<string, unknown> = {}) => ({
  id,
  code: `ADS-${id}`,
  number: 1,
  created_at: '2026-11-20T18:00:00.000Z',
  status,
  fulfillment: 'local',
  delivery_fee: 'local',
  customer_name: `Cliente ${id}`,
  ...patch,
})

/** Fonte de mentira: o teste decide a carga, manda eventos e vê a inscrição. */
function fakeSource(initial: unknown[] = []) {
  const state = {
    rows: [...initial],
    loads: 0,
    listening: 0,
    stopped: 0,
    pendingLoad: null as null | (() => void),
    holdLoad: false,
    failSetStatus: false,
    onChange: (() => undefined) as (change: OrderChange) => void,
    onState: (() => undefined) as (state: LiveState) => void,
  }
  const source: OrdersSource = {
    kind: 'supabase',
    load: () => {
      state.loads++
      if (!state.holdLoad) return Promise.resolve([...state.rows])
      return new Promise((resolve) => {
        const snapshot = [...state.rows]
        state.pendingLoad = () => resolve(snapshot)
      })
    },
    setStatus: async (id, status) => {
      if (state.failSetStatus) throw new Error('rede')
      const found = state.rows.find((candidate) => (candidate as { id: string }).id === id)
      if (!found) return null
      return { ...(found as object), status }
    },
    listen(onChange, onState) {
      state.listening++
      state.onChange = onChange
      state.onState = onState
      onState('live')
      return () => void state.stopped++
    },
  }
  return { source, state }
}

function fakeAlert() {
  const alert = { plays: 0, play: () => (alert.plays++, true) }
  return alert
}

/** Relógio de mentira para a consulta de reserva. */
function fakeTimers() {
  const timers = new Map<number, () => void>()
  let next = 0
  return {
    timers,
    setInterval: (callback: () => void) => (timers.set(++next, callback), next),
    clearInterval: (id: number) => void timers.delete(id),
    tick: () => [...timers.values()].forEach((callback) => callback()),
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const codes = (live: ReturnType<typeof createOrdersLive>) => live.getSnapshot().orders.map((order) => order.code)

describe('painel ao vivo: carga e Realtime (2026-11-20)', () => {
  it('carga inicial sem som; INSERT depois da carga aparece, conta como novo e toca', async () => {
    const { source, state } = fakeSource([row('1'), row('2', 'preparando')])
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    await settle()
    expect([codes(live), live.getSnapshot().newCount, live.getSnapshot().status, alert.plays]).toEqual([['ADS-1', 'ADS-2'], 1, 'ready', 0])
    state.onChange({ type: 'INSERT', row: row('3', 'novo', { created_at: '2026-11-20T18:05:00.000Z' }) })
    expect([codes(live), live.getSnapshot().newCount, alert.plays]).toEqual([['ADS-3', 'ADS-1', 'ADS-2'], 2, 1])
  })

  it('UPDATE muda o cartão e o contador, sem som', async () => {
    const { source, state } = fakeSource([row('1')])
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    await settle()
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando') })
    expect([live.getSnapshot().orders[0].status, live.getSnapshot().newCount, alert.plays]).toEqual(['preparando', 0, 0])
  })

  it('UPDATE do Realtime sem as colunas grandes que não mudaram (a comanda, TOAST): o cartão mantém a comanda', async () => {
    // Visto no Supabase de verdade em 2026-11-20 (ADS-0003): o UPDATE chegou com 27 das 28 colunas, sem `message`.
    const comanda = '🍨 *ITENS DO PEDIDO*\n\n1️⃣ *1x Açaí Tradicional* (Pote 200 ml) — *R$ 11,00*\n   ✨ *Montagem:* COMPLETO'
    const { source, state } = fakeSource([row('1', 'novo', { message: comanda })])
    const live = createOrdersLive({ source, alert: fakeAlert(), timers: fakeTimers() })
    live.start()
    await settle()
    // A linha do UPDATE vem sem a chave `message`.
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando') })
    expect([live.getSnapshot().orders[0].status, live.getSnapshot().orders[0].message]).toEqual(['preparando', comanda])
    // INSERT de um pedido novo não herda nada (vem completo).
    state.onChange({ type: 'INSERT', row: row('2') })
    expect(live.getSnapshot().orders.find((order) => order.id === '2')?.message).toBe('')
  })

  it('evento repetido (mesmo id): um cartão só e um bipe só', async () => {
    const { source, state } = fakeSource()
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    await settle()
    state.onChange({ type: 'INSERT', row: row('9') })
    state.onChange({ type: 'INSERT', row: row('9') })
    expect([codes(live), alert.plays]).toEqual([['ADS-9'], 1])
  })

  it('INSERT que chega durante a carga e também vem nela: aparece uma vez, sem som; o que não veio na carga toca', async () => {
    const { source, state } = fakeSource([row('1')])
    state.holdLoad = true
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    // A consulta já tirou a foto com o pedido 1; o Realtime avisa o 1 (atrasado) e o 2 (novo de verdade).
    state.onChange({ type: 'INSERT', row: row('1') })
    state.onChange({ type: 'INSERT', row: row('2', 'novo', { created_at: '2026-11-20T18:01:00.000Z' }) })
    expect(live.getSnapshot().status).toBe('loading')
    state.pendingLoad?.()
    await settle()
    expect([codes(live), alert.plays]).toEqual([['ADS-2', 'ADS-1'], 1])
  })

  it('pedido de outra situação que chega por INSERT (raro): aparece, sem som', async () => {
    const { source, state } = fakeSource()
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    await settle()
    state.onChange({ type: 'INSERT', row: row('5', 'preparando') })
    expect([codes(live), alert.plays]).toEqual([['ADS-5'], 0])
  })

  it('parar: remove a inscrição, apaga os pedidos da memória e não escuta mais; ligar duas vezes não duplica', async () => {
    const { source, state } = fakeSource([row('1')])
    const timers = fakeTimers()
    const live = createOrdersLive({ source, alert: fakeAlert(), timers })
    live.start()
    live.start()
    await settle()
    expect([state.listening, timers.timers.size]).toEqual([1, 1])
    // Quem ligou duas vezes desliga duas vezes (faixa e página).
    live.stop()
    live.stop()
    expect([state.stopped, timers.timers.size, live.getSnapshot().orders, live.getSnapshot().newCount, live.getSnapshot().status]).toEqual([1, 0, [], 0, 'idle'])
  })

  it('duas telas usando (faixa e página): só para quando as duas largam', async () => {
    const { source, state } = fakeSource()
    const live = createOrdersLive({ source, alert: fakeAlert(), timers: fakeTimers() })
    live.start()
    live.start()
    live.stop()
    expect(state.stopped).toBe(0)
    live.stop()
    expect(state.stopped).toBe(1)
  })

  it('conexão caída: estado "offline"; a consulta de reserva acha o pedido novo e toca', async () => {
    const { source, state } = fakeSource([row('1')])
    const timers = fakeTimers()
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers })
    live.start()
    await settle()
    state.onState('offline')
    expect(live.getSnapshot().live).toBe('offline')
    state.rows.push(row('2', 'novo', { created_at: '2026-11-20T18:02:00.000Z' }))
    timers.tick()
    await settle()
    expect([codes(live), alert.plays]).toEqual([['ADS-2', 'ADS-1'], 1])
    // Consultar de novo não toca outra vez.
    timers.tick()
    await settle()
    expect(alert.plays).toBe(1)
  })

  it('falha na carga: estado de erro, sem som; a próxima consulta recupera', async () => {
    const { source } = fakeSource([row('1')])
    let fail = true
    const flaky: OrdersSource = { ...source, load: () => (fail ? Promise.reject(new Error('rede')) : source.load()) }
    const timers = fakeTimers()
    const alert = fakeAlert()
    const live = createOrdersLive({ source: flaky, alert, timers })
    live.start()
    await settle()
    expect(live.getSnapshot().status).toBe('error')
    fail = false
    timers.tick()
    await settle()
    expect([live.getSnapshot().status, codes(live), alert.plays]).toEqual(['ready', ['ADS-1'], 0])
  })
})

describe('painel ao vivo: mudar a situação (2026-11-20)', () => {
  it('gravado: o cartão e o contador mudam com a linha que voltou do banco', async () => {
    const { source } = fakeSource([row('1')])
    const live = createOrdersLive({ source, alert: fakeAlert(), timers: fakeTimers() })
    live.start()
    await settle()
    const order = live.getSnapshot().orders[0]
    expect(await live.setStatus(order, 'preparando')).toEqual({ ok: true })
    expect([live.getSnapshot().orders[0].status, live.getSnapshot().newCount]).toEqual(['preparando', 0])
  })

  it('falha ao gravar: a situação antiga fica e a mensagem explica', async () => {
    const { source, state } = fakeSource([row('1')])
    state.failSetStatus = true
    const live = createOrdersLive({ source, alert: fakeAlert(), timers: fakeTimers() })
    live.start()
    await settle()
    const order = live.getSnapshot().orders[0]
    expect(await live.setStatus(order, 'cancelado')).toEqual({ ok: false, message: 'Não foi possível mudar a situação. Confira a internet e tente de novo.' })
    expect(live.getSnapshot().orders[0].status).toBe('novo')
  })

  it('pedido que sumiu do banco: avisa, sem mudar nada', async () => {
    const { source, state } = fakeSource([row('1')])
    const live = createOrdersLive({ source, alert: fakeAlert(), timers: fakeTimers() })
    live.start()
    await settle()
    const order = live.getSnapshot().orders[0]
    state.rows = []
    expect(await live.setStatus(order, 'preparando')).toEqual({ ok: false, message: 'O pedido não foi encontrado. Atualize a lista.' })
  })
})
