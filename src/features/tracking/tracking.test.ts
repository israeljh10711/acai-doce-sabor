import { describe, expect, it } from 'vitest'
import { parseOrderView } from './orderView.ts'
import { timelineFor } from './timeline.ts'
import { MAX_TRACKED, TRACKED_KEY, type TrackedOrder, createTrackedOrders } from './trackedOrders.ts'

const NOW = Date.parse('2026-11-20T15:00:00-03:00')
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString()

const memory = () => {
  const map = new Map<string, string>()
  return { map, storage: { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) } }
}
const order = (patch: Partial<TrackedOrder> = {}): TrackedOrder => ({ id: 'p1', code: 'ADS-0001', createdAt: at(0), status: 'novo', fulfillment: 'local', demo: false, tracked: true, ...patch })

describe('pedidos acompanhados neste aparelho (2026-11-20)', () => {
  it('guarda vários pedidos sem apagar os anteriores; os mais novos primeiro', () => {
    const { storage } = memory()
    const tracked = createTrackedOrders(storage, () => NOW)
    tracked.upsert(order())
    tracked.upsert(order({ id: 'p2', code: 'ADS-0002', createdAt: at(5) }))
    expect(tracked.list().map((item) => item.code)).toEqual(['ADS-0002', 'ADS-0001'])
    expect(tracked.find('ADS-0001')?.id).toBe('p1')
    expect(tracked.find('p2')?.code).toBe('ADS-0002')
  })

  it('guarda só o necessário: nada de nome, telefone, endereço, pagamento ou token', () => {
    const { storage, map } = memory()
    createTrackedOrders(storage, () => NOW).upsert(order())
    expect(Object.keys(JSON.parse(map.get(TRACKED_KEY) ?? '[]')[0]).sort()).toEqual(['code', 'createdAt', 'demo', 'fulfillment', 'id', 'status', 'tracked'])
  })

  it('em andamento: sem os concluídos e cancelados (que continuam consultáveis)', () => {
    const tracked = createTrackedOrders(memory().storage, () => NOW)
    tracked.upsert(order())
    tracked.upsert(order({ id: 'p2', code: 'ADS-0002' }))
    tracked.setStatus('p1', 'concluido')
    expect([tracked.active().map((item) => item.code), tracked.list().length]).toEqual([['ADS-0002'], 2])
  })

  it('pedidos de mais de 30 dias saem; no máximo 20 guardados', () => {
    const tracked = createTrackedOrders(memory().storage, () => NOW + 31 * 24 * 60 * 60 * 1000)
    tracked.upsert(order())
    expect(tracked.list()).toEqual([])
    const many = createTrackedOrders(memory().storage, () => NOW)
    for (let index = 0; index < 25; index++) many.upsert(order({ id: `p${index}`, code: `ADS-${index}`, createdAt: at(index) }))
    expect(many.list()).toHaveLength(MAX_TRACKED)
  })

  it('armazenamento indisponível ou estragado: funciona na memória, sem quebrar', () => {
    const broken = createTrackedOrders(
      {
        getItem: () => {
          throw new Error('bloqueado')
        },
        setItem: () => {
          throw new Error('bloqueado')
        },
      },
      () => NOW,
    )
    broken.upsert(order())
    expect(broken.list().map((item) => item.code)).toEqual(['ADS-0001'])
    const { storage, map } = memory()
    map.set(TRACKED_KEY, '{estragado')
    expect(createTrackedOrders(storage, () => NOW).list()).toEqual([])
  })
})

const events = (...statuses: [string, number][]) => statuses.map(([status, minutes]) => ({ kind: 'status', status, at: at(minutes) }))

describe('linha do tempo do pedido (2026-11-20)', () => {
  it('novo: recebido é a etapa atual, o resto pendente, sem horários futuros', () => {
    const timeline = timelineFor({ status: 'novo', fulfillment: 'entrega', createdAt: at(0), events: events(['novo', 0]) })
    expect(timeline.steps.map((step) => [step.label, step.state, step.at])).toEqual([
      ['✅ Pedido recebido — Aguardando confirmação', 'current', at(0)],
      ['🍨 Preparando seu pedido', 'pending', null],
      ['🛵 Seu pedido saiu para entrega', 'pending', null],
      ['✅ Pedido concluído', 'pending', null],
    ])
    expect(timeline.headline).toBe('✅ Pedido recebido — Aguardando confirmação')
  })

  it('a terceira etapa muda com a modalidade', () => {
    for (const [fulfillment, status, label] of [
      ['entrega', 'saiu_para_entrega', '🛵 Seu pedido saiu para entrega'],
      ['retirada', 'pronto_retirada', '🛍️ Seu pedido está pronto para retirada'],
      ['local', 'pronto_consumo', '🍨 Seu pedido está pronto para consumo'],
    ] as const) {
      const timeline = timelineFor({ status, fulfillment, createdAt: at(0), events: events(['novo', 0], ['preparando', 3], [status, 9]) })
      expect([timeline.headline, timeline.steps.map((step) => step.state), timeline.steps[2].at]).toEqual([label, ['done', 'done', 'current', 'pending'], at(9)])
    }
  })

  it('concluído: tudo feito, com os horários do histórico', () => {
    const timeline = timelineFor({ status: 'concluido', fulfillment: 'local', createdAt: at(0), events: events(['novo', 0], ['preparando', 2], ['pronto_consumo', 8], ['concluido', 20]) })
    expect([timeline.finished, timeline.steps.map((step) => [step.state, step.at])]).toEqual([
      true,
      [
        ['done', at(0)],
        ['done', at(2)],
        ['done', at(8)],
        ['done', at(20)],
      ],
    ])
  })

  it('cancelado depois de preparar: as etapas feitas e o cancelamento, sem etapas que não aconteceram', () => {
    const timeline = timelineFor({ status: 'cancelado', fulfillment: 'retirada', createdAt: at(0), events: events(['novo', 0], ['preparando', 4], ['cancelado', 6]) })
    expect([timeline.cancelled, timeline.headline, timeline.steps.map((step) => [step.label, step.state, step.at])]).toEqual([
      true,
      '❌ Pedido cancelado',
      [
        ['✅ Pedido recebido — Aguardando confirmação', 'done', at(0)],
        ['🍨 Preparando seu pedido', 'done', at(4)],
        ['❌ Pedido cancelado', 'cancelled', at(6)],
      ],
    ])
  })

  it('pedido antigo, sem histórico das etapas do meio: a etapa aparece feita, sem horário inventado', () => {
    const timeline = timelineFor({ status: 'preparando', fulfillment: 'local', createdAt: at(0), events: [] })
    expect(timeline.steps.slice(0, 2).map((step) => [step.state, step.at])).toEqual([
      ['done', at(0)],
      ['current', null],
    ])
  })
})

describe('visão do pedido vinda da função (2026-11-20)', () => {
  it('lê com cuidado: situação estranha descarta; endereço só na entrega', () => {
    expect(parseOrderView({ id: 'p1', code: 'ADS-0001', status: 'voando' })).toBeNull()
    const view = parseOrderView({ id: 'p1', code: 'ADS-0001', status: 'novo', fulfillment: 'local', address: { street: 'Rua A' }, totalCents: 500, events: [{ kind: 'status', status: 'novo', at: at(0) }, { kind: 'x' }] })
    expect([view?.address, view?.totalCents, view?.events.length]).toEqual([null, 500, 1])
  })
})
