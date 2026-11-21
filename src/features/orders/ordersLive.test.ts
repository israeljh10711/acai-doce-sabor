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

/** Aviso de mentira: conta o bipe de pedido novo (`plays`) e o "ding-dong" de itens acrescentados (`added`). */
function fakeAlert() {
  const alert = { plays: 0, added: 0, play: () => (alert.plays++, true), playAdded: () => (alert.added++, true) }
  return alert
}

/** Relógio de mentira para a consulta de reserva. */
function fakeTimers() {
  const timers = new Map<number, () => void>()
  const timeouts = new Map<number, () => void>()
  let next = 0
  return {
    timers,
    timeouts,
    setInterval: (callback: () => void) => (timers.set(++next, callback), next),
    clearInterval: (id: number) => void timers.delete(id),
    setTimeout: (callback: () => void) => (timeouts.set(++next, callback), next),
    clearTimeout: (id: number) => void timeouts.delete(id),
    tick: () => [...timers.values()].forEach((callback) => callback()),
    /** Faz passar o tempo dos destaques. */
    elapse: () => {
      const pending = [...timeouts.values()]
      timeouts.clear()
      pending.forEach((callback) => callback())
    },
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

/** Um lote acrescentado pelo cliente, como a função do banco grava (com a chave única do lote). */
const batch = (key: string, cents = 300) => ({
  attempt_key: key,
  created_at: '2026-11-20T18:30:00.000Z',
  subtotal_cents: cents,
  itemsBlock: '',
  items: [{ name: 'Picolé Gourmet', quantity: 1, total_cents: cents }],
})
const batches = (...keys: string[]) => keys.map((key) => batch(key))

describe('painel ao vivo: itens acrescentados pelo cliente (2026-11-20)', () => {
  async function started(initial: unknown[]) {
    const { source, state } = fakeSource(initial)
    const alert = fakeAlert()
    const timers = fakeTimers()
    const live = createOrdersLive({ source, alert, timers, now: () => Date.parse('2026-11-20T18:40:00.000Z') })
    live.start()
    await settle()
    return { live, state, alert, timers }
  }

  it('lote novo num pedido conhecido: o "ding-dong" uma vez, destaque e aviso com o código; o contador de novos não muda', async () => {
    const { live, state, alert } = await started([row('1'), row('2', 'preparando')])
    state.onChange({ type: 'UPDATE', row: row('2', 'preparando', { additions: batches('k1') }) })
    const snapshot = live.getSnapshot()
    expect([alert.added, alert.plays, snapshot.newCount, snapshot.orders.length]).toEqual([1, 0, 1, 2])
    expect([Object.keys(snapshot.highlighted), snapshot.notices.map((notice) => [notice.code, notice.batches])]).toEqual([['2'], [['ADS-2', 1]]])
    expect(snapshot.orders.find((order) => order.id === '2')?.status).toBe('preparando')
  })

  it('evento repetido (reconexão, inscrição duplicada): toca uma vez só', async () => {
    const { live, state, alert } = await started([row('1')])
    const update = { type: 'UPDATE' as const, row: row('1', 'novo', { additions: batches('k1') }) }
    state.onChange(update)
    state.onChange(update)
    state.onChange(update)
    expect([alert.added, live.getSnapshot().notices.length]).toEqual([1, 1])
  })

  it('mudança de situação, total mudado, cancelamento, conclusão e UPDATE sem a coluna (TOAST): nada de "ding-dong"', async () => {
    const { live, state, alert } = await started([row('1', 'novo', { additions: batches('k1') })])
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando') })
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando', { total_cents: 999 }) })
    state.onChange({ type: 'UPDATE', row: row('1', 'pronto_consumo', { additions: batches('k1') }) })
    state.onChange({ type: 'UPDATE', row: row('1', 'cancelado') })
    state.onChange({ type: 'UPDATE', row: row('1', 'concluido') })
    expect([alert.added, alert.plays, live.getSnapshot().notices, live.getSnapshot().highlighted]).toEqual([0, 0, [], {}])
  })

  it('carga inicial com lotes antigos, e acréscimo que chegou durante a carga e já veio nela: sem aviso', async () => {
    const { source, state } = fakeSource([row('1', 'preparando', { additions: batches('k1') })])
    state.holdLoad = true
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando', { additions: batches('k1') }) })
    state.pendingLoad?.()
    await settle()
    expect([alert.added, live.getSnapshot().notices.length]).toEqual([0, 0])
  })

  it('acréscimo que chegou durante a carga e não estava nela: avisa uma vez', async () => {
    const { source, state } = fakeSource([row('1', 'preparando')])
    state.holdLoad = true
    const alert = fakeAlert()
    const live = createOrdersLive({ source, alert, timers: fakeTimers() })
    live.start()
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando', { additions: batches('k1') }) })
    state.pendingLoad?.()
    await settle()
    expect([alert.added, live.getSnapshot().notices.map((notice) => notice.code)]).toEqual([1, ['ADS-1']])
  })

  it('consulta de reserva (Realtime caído) acha o lote novo: avisa uma vez; a próxima consulta e o Realtime atrasado não repetem', async () => {
    const { live, state, alert } = await started([row('1', 'preparando')])
    state.rows = [row('1', 'preparando', { additions: batches('k1') })]
    await live.refresh()
    await live.refresh()
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando', { additions: batches('k1') }) })
    expect([alert.added, live.getSnapshot().notices.length]).toEqual([1, 1])
  })

  it('a linha que volta ao mudar a situação já traz o lote (antes do Realtime): avisa uma vez, e o Realtime depois não repete', async () => {
    const { live, state, alert } = await started([row('1', 'novo')])
    state.rows = [row('1', 'novo', { additions: batches('k1') })]
    await live.setStatus(live.getSnapshot().orders[0], 'preparando')
    state.onChange({ type: 'UPDATE', row: row('1', 'preparando', { additions: batches('k1') }) })
    expect([alert.added, Object.keys(live.getSnapshot().highlighted)]).toEqual([1, ['1']])
  })

  it('acréscimos em dois pedidos: dois avisos, só os dois cartões destacados; o terceiro fica como estava', async () => {
    const { live, state, alert } = await started([row('1'), row('2', 'preparando'), row('3')])
    state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches('a') }) })
    state.onChange({ type: 'UPDATE', row: row('2', 'preparando', { additions: batches('b') }) })
    expect([alert.added, live.getSnapshot().notices.map((notice) => notice.code), Object.keys(live.getSnapshot().highlighted).sort()]).toEqual([
      2,
      ['ADS-1', 'ADS-2'],
      ['1', '2'],
    ])
  })

  it('o mesmo pedido recebe outro lote depois: outro aviso (o anterior não some)', async () => {
    const { live, state, alert } = await started([row('1')])
    state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches('a') }) })
    state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches('a', 'b') }) })
    expect([alert.added, live.getSnapshot().notices.length]).toEqual([2, 2])
  })

  it('"Visto": some o destaque e os avisos do pedido; fechar um aviso não mexe no destaque', async () => {
    const { live, state } = await started([row('1'), row('2')])
    state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches('a') }) })
    state.onChange({ type: 'UPDATE', row: row('2', 'novo', { additions: batches('b') }) })
    live.dismissNotice(live.getSnapshot().notices[1].id)
    expect([live.getSnapshot().notices.map((notice) => notice.code), Object.keys(live.getSnapshot().highlighted).sort()]).toEqual([['ADS-1'], ['1', '2']])
    live.markSeen('1')
    expect([live.getSnapshot().notices, Object.keys(live.getSnapshot().highlighted)]).toEqual([[], ['2']])
  })

  it('o destaque some quando o vendedor muda a situação do pedido, ou sozinho depois de 10 minutos', async () => {
    const { live, state, timers } = await started([row('1'), row('2')])
    state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches('a') }) })
    state.onChange({ type: 'UPDATE', row: row('2', 'novo', { additions: batches('b') }) })
    const second = live.getSnapshot().orders.find((order) => order.id === '2')
    if (!second) throw new Error('pedido 2 sumiu')
    await live.setStatus(second, 'preparando')
    expect(Object.keys(live.getSnapshot().highlighted)).toEqual(['1'])
    timers.elapse()
    expect(live.getSnapshot().highlighted).toEqual({})
  })

  it('muitos acréscimos seguidos: até 4 avisos empilhados (os mais antigos saem)', async () => {
    const { live, state } = await started([row('1')])
    const keys = ['a', 'b', 'c', 'd', 'e', 'f']
    keys.forEach((_key, index) => state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches(...keys.slice(0, index + 1)) }) }))
    expect(live.getSnapshot().notices.length).toBe(4)
  })

  it('sair do Modo Vendedor: esquece lotes, destaques e avisos; ao voltar, os lotes da carga não tocam', async () => {
    const { live, state, alert } = await started([row('1')])
    state.onChange({ type: 'UPDATE', row: row('1', 'novo', { additions: batches('a') }) })
    live.stop()
    expect([live.getSnapshot().notices, live.getSnapshot().highlighted]).toEqual([[], {}])
    state.rows = [row('1', 'novo', { additions: batches('a', 'b') })]
    live.start()
    await settle()
    expect([alert.added, live.getSnapshot().notices]).toEqual([1, []])
  })

  it('pedido que o painel não conhecia: não avisa (não dá para saber qual lote é novo)', async () => {
    const { live, state, alert } = await started([row('1')])
    state.onChange({ type: 'UPDATE', row: row('9', 'preparando', { additions: batches('a') }) })
    expect([alert.added, live.getSnapshot().notices]).toEqual([0, []])
  })
})
