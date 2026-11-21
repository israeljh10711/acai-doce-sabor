import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, serializeCart, setQuantity } from '../features/cart/cart.ts'
import { NO_CHANGES } from '../features/catalog/catalogChanges.ts'
import { setCatalogChanges, setCatalogRecords } from '../features/catalog/catalogState.ts'
import { type CustomerDraft, EMPTY_CUSTOMER } from '../features/checkout/delivery.ts'
import type { ChangeRow } from '../services/supabaseRest.ts'
import type { AddItemsArgs, EventRecord, OrderRecord, PedidoDeps } from './customerOrders.ts'
import { handleRequest } from './orderRequest.ts'
import type { OrderRow } from './orderServer.ts'
import { catalogWith, editProduct } from './catalogFixtures.ts'

afterEach(() => {
  setCatalogRecords(null)
  setCatalogChanges(NO_CHANGES)
})

const OPEN = Date.parse('2026-11-20T15:42:00-03:00')
const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Banco em memória: orders, order_events e a função SQL de acréscimo (com as mesmas regras). */
function fakeDeps({ rows = [] as ChangeRow[], now = OPEN, catalog = catalogWith() as unknown } = {}) {
  const orders: (OrderRow & OrderRecord)[] = []
  const events: (EventRecord & { order_id: string })[] = []
  const tokens: Record<string, string> = { 'token-ana': 'ana', 'token-bia': 'bia' }
  const calls = { addItems: [] as AddItemsArgs[], verify: [] as string[] }
  let sequence = 0
  const deps: PedidoDeps = {
    readChanges: async () => rows,
    readCatalog: async () => JSON.parse(JSON.stringify(catalog)),
    findOrder: async (key) => orders.find((order) => order.attempt_key === key) ?? null,
    nextNumber: async () => ++sequence,
    insertOrder: async (row) => {
      if (orders.some((order) => order.attempt_key === row.attempt_key)) return null
      const created = new Date(now).toISOString()
      const stored = { ...row, id: `pedido-${row.number}`, created_at: created, updated_at: created, status: 'novo', additions: [] } as unknown as OrderRow & OrderRecord
      orders.push(stored)
      events.push({ order_id: stored.id, kind: 'status', status: 'novo', created_at: created })
      return stored
    },
    now: () => now,
    sha256,
    verifyCustomer: async (token) => {
      calls.verify.push(token)
      return tokens[token] ?? null
    },
    findOrderById: async (id) => orders.find((order) => order.id === id) ?? null,
    listCustomerOrders: async (customerId, since) => orders.filter((order) => order.customer_user_id === customerId && order.created_at >= since),
    readEvents: async (orderId) => events.filter((event) => event.order_id === orderId),
    addItems: async (args) => {
      calls.addItems.push(args)
      const order = orders.find((candidate) => candidate.id === args.orderId)
      if (!order || order.customer_user_id !== args.customerId) return { ok: false, reason: 'nao-encontrado' }
      const additions = order.additions as { attempt_key: string }[]
      if (additions.some((entry) => entry.attempt_key === args.attemptKey)) return { ok: true, repeated: true, total_cents: order.total_cents, subtotal_cents: order.subtotal_cents, change_for_cents: order.change_for_cents }
      if (order.status !== 'novo' && order.status !== 'preparando') return { ok: false, reason: 'situacao', status: order.status }
      const total = order.total_cents + args.subtotalCents
      const change = order.payment_method === 'dinheiro' && args.changeSet ? args.changeForCents : order.change_for_cents
      if (order.payment_method === 'dinheiro' && change !== null && change < total) return { ok: false, reason: 'troco', total_cents: total }
      additions.push({ ...args.batch, attempt_key: args.attemptKey, created_at: new Date(now).toISOString(), subtotal_cents: args.subtotalCents } as never)
      order.subtotal_cents += args.subtotalCents
      order.total_cents = total
      order.change_for_cents = order.payment_method === 'dinheiro' ? change : order.change_for_cents
      events.push({ order_id: order.id, kind: 'itens', status: order.status, created_at: new Date(now).toISOString() })
      return { ok: true, repeated: false, total_cents: total, subtotal_cents: order.subtotal_cents, change_for_cents: change }
    },
  }
  return { deps, orders, events, calls }
}

/** Jujuba (R$ 1,00) e 2 águas (R$ 4,00): R$ 5,00. */
function cartString() {
  let cart = addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart
  cart = addExtraItem(cart, 'agua-mineral-500-ml', {}, 'a1').cart
  return serializeCart(setQuantity(cart, 'a1', 2))
}
/** 3 jujubas: R$ 3,00. */
const moreCart = () => serializeCart(setQuantity(addExtraItem(EMPTY_CART, 'jujuba', {}, 'x1').cart, 'x1', 3))

const MARIA: CustomerDraft = { ...EMPTY_CUSTOMER, name: 'Maria', phone: '83999990000', kind: 'local' }
const PIX = { method: 'pix', changeFor: '', exact: false }
const ATTEMPT = 'tentativa-0000000001'
const create = (deps: PedidoDeps, token: string | null, patch: Record<string, unknown> = {}) =>
  handleRequest({ cart: cartString(), customer: MARIA, payment: PIX, expectedTotalCents: 500, attemptId: ATTEMPT, ...patch }, deps, token)

describe('criar: pedido ligado à sessão do cliente (2026-11-20)', () => {
  it('com a sessão: grava o dono e devolve id, código, horário e "acompanhado"', async () => {
    const { deps, orders } = fakeDeps()
    expect(await create(deps, 'token-ana')).toMatchObject({ ok: true, id: 'pedido-1', code: 'ADS-0001', createdAt: new Date(OPEN).toISOString(), tracked: true, totalCents: 500, repeated: false })
    expect(orders[0].customer_user_id).toBe('ana')
  })

  it('sem sessão, ou com token inválido: grava do mesmo jeito, sem acompanhamento (nenhuma venda perdida)', async () => {
    const { deps, orders } = fakeDeps()
    expect(await create(deps, null)).toMatchObject({ ok: true, tracked: false })
    expect(await create(deps, 'token-falso', { attemptId: 'tentativa-0000000002' })).toMatchObject({ ok: true, tracked: false })
    expect(orders.map((order) => order.customer_user_id)).toEqual([null, null])
  })

  it('a mesma tentativa de novo (toque duplo, internet caída): o mesmo pedido', async () => {
    const { deps, orders } = fakeDeps()
    await create(deps, 'token-ana')
    expect(await create(deps, 'token-ana')).toMatchObject({ ok: true, code: 'ADS-0001', repeated: true })
    expect(orders).toHaveLength(1)
  })

  it('o mesmo carrinho numa tentativa nova (outro dia): pedido novo, não o antigo', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    expect(await create(deps, 'token-ana', { attemptId: 'tentativa-0000000009' })).toMatchObject({ ok: true, code: 'ADS-0002', repeated: false })
  })

  it('a tentativa de outra sessão não devolve o pedido de ninguém', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    expect(await create(deps, 'token-bia')).toEqual({ ok: false, reason: 'pedido-invalido' })
  })

  it('site antigo (sem id de tentativa e sem op): continua funcionando como antes', async () => {
    const { deps } = fakeDeps()
    const old = { cart: cartString(), customer: MARIA, payment: PIX, expectedTotalCents: 500 }
    expect(await handleRequest(old, deps, null)).toMatchObject({ ok: true, code: 'ADS-0001' })
    expect(await handleRequest(old, deps, null)).toMatchObject({ ok: true, code: 'ADS-0001', repeated: true })
    expect(await handleRequest({ ...old, attemptId: 'curto' }, deps, null)).toEqual({ ok: false, reason: 'pedido-invalido' })
  })
})

describe('consultar e meus: só o próprio pedido, na visão reduzida (2026-11-20)', () => {
  it('o dono vê situação, itens, valores e histórico; sem nome, telefone, GPS nem dados internos', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    const result = (await handleRequest({ op: 'consultar', orderId: 'pedido-1' }, deps, 'token-ana')) as { ok: true; order: Record<string, unknown> }
    expect(result.ok).toBe(true)
    expect(result.order).toMatchObject({ id: 'pedido-1', code: 'ADS-0001', status: 'novo', fulfillment: 'local', address: null, subtotalCents: 500, totalCents: 500, paymentMethod: 'pix' })
    expect(result.order.events).toEqual([{ kind: 'status', status: 'novo', at: new Date(OPEN).toISOString() }])
    expect(String(result.order.itemsBlock).split('\n')[0]).toBe('🍨 *ITENS DO PEDIDO*')
    const json = JSON.stringify(result.order)
    for (const secret of ['Maria', '99999', 'customer_user_id', 'attempt_key', 'whatsapp', 'maps_url']) expect(json.includes(secret)).toBe(false)
  })

  it('o código não autoriza: outra sessão, ou sem sessão, não vê o pedido (nem que ele existe)', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    expect(await handleRequest({ op: 'consultar', orderId: 'pedido-1' }, deps, 'token-bia')).toEqual({ ok: false, reason: 'nao-encontrado' })
    expect(await handleRequest({ op: 'consultar', orderId: 'pedido-1' }, deps, null)).toEqual({ ok: false, reason: 'sem-sessao' })
    expect(await handleRequest({ op: 'consultar', orderId: 'pedido-1' }, deps, 'token-falso')).toEqual({ ok: false, reason: 'sem-sessao' })
    expect(await handleRequest({ op: 'consultar', orderId: 'pedido-999' }, deps, 'token-ana')).toEqual({ ok: false, reason: 'nao-encontrado' })
    expect(await handleRequest({ op: 'consultar', code: 'ADS-0001' }, deps, 'token-ana')).toEqual({ ok: false, reason: 'pedido-invalido' })
  })

  it('pedido de mais de 30 dias: "expirado"', async () => {
    const old = fakeDeps({ now: OPEN })
    await create(old.deps, 'token-ana')
    const later = { ...old.deps, now: () => OPEN + 31 * 24 * 60 * 60 * 1000 }
    expect(await handleRequest({ op: 'consultar', orderId: 'pedido-1' }, later, 'token-ana')).toEqual({ ok: false, reason: 'expirado' })
  })

  it('meus: só os pedidos da sessão, sem dados pessoais', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    await create(deps, 'token-bia', { attemptId: 'tentativa-0000000003' })
    expect(await handleRequest({ op: 'meus' }, deps, 'token-ana')).toEqual({
      ok: true,
      orders: [{ id: 'pedido-1', code: 'ADS-0001', createdAt: new Date(OPEN).toISOString(), status: 'novo', fulfillment: 'local', totalCents: 500 }],
    })
    expect(await handleRequest({ op: 'meus' }, deps, null)).toEqual({ ok: false, reason: 'sem-sessao' })
  })
})

describe('adicionar: itens a mais no mesmo pedido (2026-11-20)', () => {
  const add = (deps: PedidoDeps, token: string | null, patch: Record<string, unknown> = {}) =>
    handleRequest({ op: 'adicionar', orderId: 'pedido-1', attemptId: 'acrescimo-000000001', cart: moreCart(), expectedSubtotalCents: 300, ...patch }, deps, token)

  it('acrescenta com o preço do cardápio do servidor: soma, mesmo código, itens originais intactos', async () => {
    const { deps, orders, calls } = fakeDeps()
    await create(deps, 'token-ana')
    const itemsBefore = JSON.stringify(orders[0].items)
    expect(await add(deps, 'token-ana')).toEqual({ ok: true, totalCents: 800, subtotalCents: 800, changeForCents: null, repeated: false })
    expect([orders.length, orders[0].code, JSON.stringify(orders[0].items) === itemsBefore]).toEqual([1, 'ADS-0001', true])
    expect(calls.addItems[0]).toMatchObject({ orderId: 'pedido-1', customerId: 'ana', subtotalCents: 300, changeSet: false })
    expect(calls.addItems[0].batch.itemsBlock.split('\n')).toEqual(['🍨 *ITENS DO PEDIDO*', '', '1️⃣ *3x Jujuba* — *R$ 3,00*'])
    expect(calls.addItems[0].attemptKey).toMatch(/^[0-9a-f]{64}$/)
  })

  it('cardápio do banco mudou depois do pedido: só os itens novos usam o preço novo (2026-11-21)', async () => {
    const { deps, orders } = fakeDeps()
    await create(deps, 'token-ana')
    const later = { ...deps, readCatalog: async () => catalogWith(editProduct('jujuba', { priceCents: 150 })) }
    expect(await add(later, 'token-ana', { expectedSubtotalCents: 450 })).toMatchObject({ ok: true, totalCents: 950, subtotalCents: 950 })
    // Os itens gravados no pedido continuam com o preço de quando foram pedidos.
    expect(orders[0].items).toContainEqual({ name: 'Jujuba', quantity: 1, unit_cents: 100, total_cents: 100 })
    expect((orders[0].additions as { items: unknown[] }[])[0].items).toEqual([{ name: 'Jujuba', quantity: 3, unit_cents: 150, total_cents: 450 }])
  })

  it('preço mudou no cardápio: recusa com o valor certo, sem gravar', async () => {
    const { deps, calls } = fakeDeps({ catalog: catalogWith(editProduct('jujuba', { priceCents: 150 })) })
    await create(deps, 'token-ana', { expectedTotalCents: 550 })
    expect(await add(deps, 'token-ana')).toEqual({ ok: false, reason: 'total-mudou', totalCents: 450 })
    expect(calls.addItems).toHaveLength(0)
  })

  it('o mesmo acréscimo de novo: não soma outra vez (nem chega ao banco)', async () => {
    const { deps, calls } = fakeDeps()
    await create(deps, 'token-ana')
    await add(deps, 'token-ana')
    expect(await add(deps, 'token-ana')).toEqual({ ok: true, totalCents: 800, subtotalCents: 800, changeForCents: null, repeated: true })
    expect(calls.addItems).toHaveLength(1)
  })

  it('pedido que já passou de "preparando": recusado com a situação', async () => {
    const { deps, orders } = fakeDeps()
    await create(deps, 'token-ana')
    orders[0].status = 'pronto_consumo'
    expect(await add(deps, 'token-ana')).toEqual({ ok: false, reason: 'situacao', detail: 'pronto_consumo' })
  })

  it('o vendedor muda a situação no meio (o banco recusa): a recusa chega ao cliente', async () => {
    const { deps, orders } = fakeDeps()
    await create(deps, 'token-ana')
    const raced: PedidoDeps = {
      ...deps,
      addItems: async (args) => {
        orders[0].status = 'cancelado'
        return deps.addItems(args)
      },
    }
    expect(await add(raced, 'token-ana')).toEqual({ ok: false, reason: 'situacao', detail: 'cancelado' })
    expect(orders[0].total_cents).toBe(500)
  })

  it('outra sessão, ou sem sessão: não acrescenta', async () => {
    const { deps, calls } = fakeDeps()
    await create(deps, 'token-ana')
    expect(await add(deps, 'token-bia')).toEqual({ ok: false, reason: 'nao-encontrado' })
    expect(await add(deps, null)).toEqual({ ok: false, reason: 'sem-sessao' })
    expect(calls.addItems).toHaveLength(0)
  })

  it('item esgotado no acréscimo: recusado com o nome', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    const soldOut = { ...deps, readCatalog: async () => catalogWith(editProduct('jujuba', { available: false })) }
    expect(await add(soldOut, 'token-ana')).toEqual({ ok: false, reason: 'esgotado', detail: 'Jujuba' })
  })

  it('dinheiro: troco menor que o total novo é recusado; com o troco novo, aceito', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana', { payment: { method: 'dinheiro', changeFor: '6', exact: false } })
    expect(await add(deps, 'token-ana')).toEqual({ ok: false, reason: 'troco', totalCents: 800 })
    expect(await add(deps, 'token-ana', { payment: { changeFor: 'abc', exact: false } })).toEqual({ ok: false, reason: 'pagamento-invalido', detail: 'Digite o valor em reais, por exemplo 50,00.' })
    expect(await add(deps, 'token-ana', { payment: { changeFor: '10,00', exact: false } })).toEqual({ ok: true, totalCents: 800, subtotalCents: 800, changeForCents: 1000, repeated: false })
  })

  it('entrada estranha: recusada sem chegar ao banco', async () => {
    const { deps, calls } = fakeDeps()
    await create(deps, 'token-ana')
    expect(await add(deps, 'token-ana', { attemptId: 'x' })).toEqual({ ok: false, reason: 'pedido-invalido' })
    expect(await add(deps, 'token-ana', { expectedSubtotalCents: -1 })).toEqual({ ok: false, reason: 'pedido-invalido' })
    expect(await add(deps, 'token-ana', { cart: serializeCart(EMPTY_CART), expectedSubtotalCents: 0 })).toEqual({ ok: false, reason: 'carrinho-vazio' })
    expect(await handleRequest({ op: 'apagar' }, deps, 'token-ana')).toEqual({ ok: false, reason: 'pedido-invalido' })
    expect(calls.addItems).toHaveLength(0)
  })

  it('o histórico registra o acréscimo e a visão mostra o lote', async () => {
    const { deps } = fakeDeps()
    await create(deps, 'token-ana')
    await add(deps, 'token-ana')
    const result = (await handleRequest({ op: 'consultar', orderId: 'pedido-1' }, deps, 'token-ana')) as { order: { additions: unknown[]; events: { kind: string }[]; totalCents: number } }
    expect(result.order.totalCents).toBe(800)
    expect(result.order.additions).toMatchObject([{ subtotalCents: 300, items: [{ name: 'Jujuba', quantity: 3, totalCents: 300 }] }])
    expect(result.order.events.map((event) => event.kind)).toEqual(['status', 'itens'])
  })
})
