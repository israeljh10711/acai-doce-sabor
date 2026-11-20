import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, setQuantity } from '../cart/cart.ts'
import { NO_CHANGES } from '../catalog/catalogChanges.ts'
import { setCatalogChanges } from '../catalog/catalogState.ts'
import type { Customer } from '../checkout/delivery.ts'
import { DEMO_KEY, type DemoChannel, type LocalDeps, MAX_DEMO_ORDERS, addDemoItems, createLocalOrdersSource, findDemoOrder, readDemo, saveDemoOrder } from './localOrdersSource.ts'
import type { OrderDraft } from './orderMessage.ts'
import { parseOrderRow } from './ordersPanel.ts'
import type { OrderChange } from './ordersSource.ts'

afterEach(() => setCatalogChanges(NO_CHANGES))

const NOW = Date.parse('2026-11-20T15:42:00-03:00')

/** Um navegador de mentira: o mesmo `localStorage` e o mesmo `BroadcastChannel` para as abas. */
function fakeBrowser() {
  const storage = new Map<string, string>()
  const channels = new Set<{ listeners: (() => void)[] }>()
  const storageListeners = new Map<number, (key: string | null) => void>()
  let ids = 0
  const tab = (tabId: number): LocalDeps => ({
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value)
        // O evento storage só chega às OUTRAS abas.
        for (const [other, listener] of storageListeners) if (other !== tabId) listener(key)
      },
    },
    now: () => NOW,
    randomId: () => `id-${++ids}`,
    openChannel: (): DemoChannel => {
      const channel = { listeners: [] as (() => void)[] }
      channels.add(channel)
      return {
        // O BroadcastChannel entrega a todos os outros canais com o mesmo nome (até na mesma aba).
        postMessage: () => {
          for (const other of channels) if (other !== channel) for (const listener of other.listeners) listener()
        },
        onMessage: (listener) => void channel.listeners.push(listener),
        close: () => void channels.delete(channel),
      }
    },
    onStorage: (listener) => {
      storageListeners.set(tabId, listener)
      return () => void storageListeners.delete(tabId)
    },
  })
  return { storage, tab, channels }
}

const ANA: Customer = { name: 'Ana', phone: '(83) 98888-1111', fulfillment: { kind: 'local' }, fee: { kind: 'local' } }
const draft = (patch: Partial<OrderDraft> = {}): OrderDraft => ({
  cart: addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart,
  customer: ANA,
  payment: { method: 'pix' },
  sentAt: NOW,
  antecipado: false,
  ...patch,
})

describe('modo de demonstração local: guardar o pedido (painel ao vivo, 2026-11-20)', () => {
  it('guarda no localStorage com a estrutura da tabela, código DEMO e a comanda enviada', () => {
    const browser = fakeBrowser()
    expect(saveDemoOrder(draft(), browser.tab(1))).toEqual({ id: 'id-1', code: 'DEMO-0001', createdAt: '2026-11-20T18:42:00.000Z', created: true })
    const [row] = readDemo(browser.tab(1).storage).orders
    expect(row).toMatchObject({
      id: 'id-1',
      number: 1,
      code: 'DEMO-0001',
      status: 'novo',
      created_at: '2026-11-20T18:42:00.000Z',
      customer_name: 'Ana',
      fulfillment: 'local',
      delivery_fee: 'local',
      delivery_fee_cents: 0,
      customer_lat: null,
      total_cents: 100,
      whatsapp: '5583996999980',
    })
    expect(row.message).toContain('• *Modalidade:* 🍨 COMER NO LOCAL (Deixar pronto para chegada)')
    expect(parseOrderRow(row)?.code).toBe('DEMO-0001')
  })

  it('o mesmo pedido de novo (toque duplo) não duplica; outro pedido ganha o próximo código', () => {
    const browser = fakeBrowser()
    saveDemoOrder(draft(), browser.tab(1))
    expect(saveDemoOrder(draft(), browser.tab(1))).toMatchObject({ code: 'DEMO-0001', created: false })
    expect(saveDemoOrder(draft({ payment: { method: 'credito' } }), browser.tab(1))).toMatchObject({ code: 'DEMO-0002', created: true })
    expect(readDemo(browser.tab(1).storage).orders.map((row) => row.code)).toEqual(['DEMO-0001', 'DEMO-0002'])
  })

  it('guarda no máximo 200; o código continua crescendo', () => {
    const browser = fakeBrowser()
    browser.storage.set(DEMO_KEY, JSON.stringify({ seq: 250, orders: Array.from({ length: MAX_DEMO_ORDERS }, (_, index) => ({ id: `v${index}`, code: `DEMO-${index}`, status: 'concluido', created_at: '2026-11-19T10:00:00.000Z' })) }))
    expect(saveDemoOrder(draft(), browser.tab(1))?.code).toBe('DEMO-0251')
    const orders = readDemo(browser.tab(1).storage).orders
    expect([orders.length, orders[0].id, orders.at(-1)?.code]).toEqual([MAX_DEMO_ORDERS, 'v1', 'DEMO-0251'])
  })

  it('dados estragados no localStorage: começa do zero sem quebrar', () => {
    const browser = fakeBrowser()
    browser.storage.set(DEMO_KEY, '{quebrado')
    expect(readDemo(browser.tab(1).storage)).toEqual({ seq: 0, orders: [] })
    expect(saveDemoOrder(draft(), browser.tab(1))?.code).toBe('DEMO-0001')
  })
})

describe('modo de demonstração local: o painel (painel ao vivo, 2026-11-20)', () => {
  it('recupera depois de recarregar (fonte nova, mesmo localStorage); só os do dia e os em andamento', async () => {
    const browser = fakeBrowser()
    saveDemoOrder(draft(), browser.tab(1))
    const data = readDemo(browser.tab(1).storage)
    browser.storage.set(
      DEMO_KEY,
      JSON.stringify({
        ...data,
        orders: [
          ...data.orders,
          { ...data.orders[0], id: 'ontem-feito', code: 'DEMO-0000', status: 'concluido', created_at: '2026-11-19T12:00:00.000Z' },
          { ...data.orders[0], id: 'ontem-aberto', code: 'DEMO-0009', status: 'preparando', created_at: '2026-11-19T12:00:00.000Z' },
        ],
      }),
    )
    const rows = await createLocalOrdersSource(browser.tab(2)).load()
    expect(rows.map((row) => (row as { id: string }).id)).toEqual(['id-1', 'ontem-aberto'])
  })

  it('muda a situação e cancela, guardando no navegador', async () => {
    const browser = fakeBrowser()
    saveDemoOrder(draft(), browser.tab(1))
    const source = createLocalOrdersSource(browser.tab(1))
    expect(await source.setStatus('id-1', 'preparando')).toMatchObject({ id: 'id-1', status: 'preparando' })
    expect(await source.setStatus('id-1', 'cancelado')).toMatchObject({ status: 'cancelado' })
    expect(readDemo(browser.tab(1).storage).orders[0].status).toBe('cancelado')
    expect(await source.setStatus('nao-existe', 'preparando')).toBeNull()
  })

  it('outra aba: pedido novo chega como INSERT e mudança como UPDATE, sem repetir', async () => {
    const browser = fakeBrowser()
    const changes: OrderChange[] = []
    const states: string[] = []
    const stop = createLocalOrdersSource(browser.tab(2)).listen((change) => changes.push(change), (state) => states.push(state))
    saveDemoOrder(draft(), browser.tab(1))
    await createLocalOrdersSource(browser.tab(1)).setStatus('id-1', 'preparando')
    expect(states).toEqual(['live'])
    expect(changes.map((change) => [change.type, (change.row as { id: string; status: string }).status])).toEqual([
      ['INSERT', 'novo'],
      ['UPDATE', 'preparando'],
    ])
    stop()
    saveDemoOrder(draft({ payment: { method: 'debito' } }), browser.tab(1))
    expect(changes).toHaveLength(2)
    expect(browser.channels.size).toBe(0)
  })

  it('mesma aba: o carrinho guarda e o painel (outro ouvinte) recebe na hora', () => {
    const browser = fakeBrowser()
    const changes: OrderChange[] = []
    createLocalOrdersSource(browser.tab(1)).listen((change) => changes.push(change), () => undefined)
    saveDemoOrder(draft(), browser.tab(1))
    expect(changes.map((change) => change.type)).toEqual(['INSERT'])
  })
})

describe('modo de demonstração: o mesmo caminho do pedido no site (2026-11-20)', () => {
  const twoJujubas = () => setQuantity(addExtraItem(EMPTY_CART, 'jujuba', {}, 'n1').cart, 'n1', 2)

  it('com a tentativa do site: reenvio devolve o mesmo pedido; tentativa nova é pedido novo (mesmo carrinho)', () => {
    const browser = fakeBrowser()
    expect(saveDemoOrder(draft(), browser.tab(1), 'tentativa-0000000001')).toMatchObject({ code: 'DEMO-0001', created: true })
    expect(saveDemoOrder(draft(), browser.tab(1), 'tentativa-0000000001')).toMatchObject({ code: 'DEMO-0001', created: false })
    expect(saveDemoOrder(draft(), browser.tab(1), 'tentativa-0000000002')).toMatchObject({ code: 'DEMO-0002', created: true })
  })

  it('o histórico guarda o recebido e cada situação, com o horário', async () => {
    const browser = fakeBrowser()
    saveDemoOrder(draft(), browser.tab(1))
    await createLocalOrdersSource(browser.tab(1)).setStatus('id-1', 'preparando')
    expect(findDemoOrder('id-1', browser.tab(1))?.events.map((event) => [event.kind, event.status])).toEqual([
      ['status', 'novo'],
      ['status', 'preparando'],
    ])
  })

  it('acrescentar: soma sem frete, guarda o lote, não repete a mesma tentativa e o painel recebe UPDATE', () => {
    const browser = fakeBrowser()
    const changes: OrderChange[] = []
    createLocalOrdersSource(browser.tab(2)).listen((change) => changes.push(change), () => undefined)
    saveDemoOrder(draft(), browser.tab(1))
    expect(addDemoItems('id-1', { attemptId: 'acrescimo-01', cart: twoJujubas() }, browser.tab(1))).toEqual({ ok: true, totalCents: 300, subtotalCents: 300, changeForCents: null, repeated: false })
    expect(addDemoItems('id-1', { attemptId: 'acrescimo-01', cart: twoJujubas() }, browser.tab(1))).toMatchObject({ ok: true, repeated: true, totalCents: 300 })
    const row = findDemoOrder('id-1', browser.tab(1))
    expect([row?.additions.length, row?.items.length, row?.events.at(-1)?.kind, changes.map((change) => change.type)]).toEqual([1, 1, 'itens', ['INSERT', 'UPDATE']])
  })

  it('acrescentar depois de pronto, ou com troco menor que o total novo: recusado sem mudar nada', async () => {
    const browser = fakeBrowser()
    saveDemoOrder(draft({ payment: { method: 'dinheiro', changeForCents: 200 } }), browser.tab(1))
    expect(addDemoItems('id-1', { attemptId: 'acrescimo-02', cart: twoJujubas() }, browser.tab(1))).toEqual({ ok: false, reason: 'troco', totalCents: 300 })
    expect(addDemoItems('id-1', { attemptId: 'acrescimo-03', cart: twoJujubas(), changeForCents: 500, changeSet: true }, browser.tab(1))).toMatchObject({ ok: true, changeForCents: 500 })
    await createLocalOrdersSource(browser.tab(1)).setStatus('id-1', 'pronto_consumo')
    expect(addDemoItems('id-1', { attemptId: 'acrescimo-04', cart: twoJujubas() }, browser.tab(1))).toEqual({ ok: false, reason: 'situacao', detail: 'pronto_consumo' })
    expect(findDemoOrder('id-1', browser.tab(1))?.total_cents).toBe(300)
  })
})
