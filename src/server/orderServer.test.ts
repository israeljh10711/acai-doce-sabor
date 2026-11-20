import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, serializeCart, setQuantity } from '../features/cart/cart.ts'
import { NO_CHANGES } from '../features/catalog/catalogChanges.ts'
import { setCatalogChanges } from '../features/catalog/catalogState.ts'
import { type CustomerDraft, EMPTY_CUSTOMER } from '../features/checkout/delivery.ts'
import type { PaymentDraft } from '../features/checkout/payment.ts'
import type { ChangeRow } from '../services/supabaseRest.ts'
import { type OrderDeps, type OrderRow, type StoredOrder, handleOrder, orderCode } from './orderServer.ts'

afterEach(() => setCatalogChanges(NO_CHANGES))

/** 17/11/2026 às 15:42 em Brasília: loja aberta pelo horário padrão (13h às 21h). */
const OPEN = Date.parse('2026-11-17T15:42:00-03:00')
const CLOSED = Date.parse('2026-11-17T22:10:00-03:00')

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Banco em memória, como a tabela `orders` com a chave de repetição única. */
function fakeDeps({ rows = [] as ChangeRow[], now = OPEN } = {}) {
  const orders: (OrderRow & StoredOrder)[] = []
  let sequence = 0
  const calls = { insert: 0, number: 0, read: 0 }
  const deps: OrderDeps = {
    readChanges: async () => {
      calls.read++
      return rows
    },
    findOrder: async (key) => orders.find((order) => order.attempt_key === key) ?? null,
    nextNumber: async () => {
      calls.number++
      return ++sequence
    },
    insertOrder: async (row) => {
      calls.insert++
      if (orders.some((order) => order.attempt_key === row.attempt_key)) return null
      const stored = { ...row, id: `pedido-${row.number}`, created_at: new Date(now).toISOString() }
      orders.push(stored)
      return stored
    },
    now: () => now,
    sha256,
  }
  return { deps, orders, calls }
}

/** Jujuba (R$ 1,00) e 2 águas (R$ 4,00): R$ 5,00. */
function cartString() {
  let cart = addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart
  cart = addExtraItem(cart, 'agua-mineral-500-ml', {}, 'a1').cart
  return serializeCart(setQuantity(cart, 'a1', 2))
}

const MARIA: CustomerDraft = { ...EMPTY_CUSTOMER, name: 'Maria', kind: 'retirada' }
const PIX: PaymentDraft = { method: 'pix', changeFor: '', exact: false }
const request = (patch: Record<string, unknown> = {}) => ({ cart: cartString(), customer: MARIA, payment: PIX, expectedTotalCents: 500, ...patch })

describe('função do pedido no servidor (opção A, pedido de 2026-11-17)', () => {
  it('pedido certo: grava com o código ADS-0001 e devolve a comanda do servidor com o código', async () => {
    const { deps, orders } = fakeDeps()
    const result = await handleOrder(request(), deps)
    expect(result).toMatchObject({ ok: true, code: 'ADS-0001', totalCents: 500, whatsapp: '5583996999980', repeated: false })
    if (!result.ok) throw new Error('esperava ok')
    const lines = result.message.split('\n')
    expect(lines.slice(0, 3)).toEqual(['🍧 *NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍧', '🔖 *Pedido:* ADS-0001', '📅 *Data/Hora:* 17/11/2026 às 15:42'])
    expect(lines).toContain('💰 *TOTAL A PAGAR:* *R$ 5,00*')
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({
      number: 1,
      code: 'ADS-0001',
      customer_name: 'Maria',
      customer_phone: null,
      fulfillment: 'retirada',
      address: null,
      delivery_fee: 'retirada',
      delivery_fee_cents: 0,
      payment_method: 'pix',
      change_for_cents: null,
      subtotal_cents: 500,
      total_cents: 500,
      antecipado: false,
      items: [
        { name: 'Jujuba', quantity: 1, unit_cents: 100, total_cents: 100 },
        { name: 'Água Mineral 500 ml', quantity: 2, unit_cents: 200, total_cents: 400 },
      ],
    })
    expect(orders[0].attempt_key).toMatch(/^[0-9a-f]{64}$/)
    expect(orders[0].message).toBe(result.message)
  })

  it('o mesmo pedido de novo (toque duplo, página recarregada) devolve o mesmo código e não grava outro', async () => {
    const { deps, orders, calls } = fakeDeps()
    const first = await handleOrder(request(), deps)
    const again = await handleOrder(request(), deps)
    expect(again).toMatchObject({ ok: true, code: 'ADS-0001', repeated: true })
    expect(first.ok && again.ok && again.message === first.message).toBe(true)
    expect([orders.length, calls.insert, calls.number]).toEqual([1, 1, 1])
    // Pedido mudado (outro pagamento) é tentativa nova.
    const other = await handleOrder(request({ payment: { method: 'dinheiro', changeFor: '', exact: true } }), deps)
    expect(other).toMatchObject({ ok: true, code: 'ADS-0002', repeated: false })
  })

  it('pedido já gravado, mandado de novo com outro total (preço mudou depois): volta o gravado, sem gravar outro', async () => {
    const { deps, orders } = fakeDeps()
    await handleOrder(request(), deps)
    expect(await handleOrder(request({ expectedTotalCents: 999 }), deps)).toMatchObject({ ok: true, code: 'ADS-0001', totalCents: 500, repeated: true })
    expect(orders).toHaveLength(1)
  })

  it('duas tentativas iguais ao mesmo tempo: a segunda acha a primeira gravada', async () => {
    const { deps } = fakeDeps()
    const results = await Promise.all([handleOrder(request(), deps), handleOrder(request(), deps)])
    expect(results.map((result) => result.ok && result.code)).toEqual(['ADS-0001', 'ADS-0001'])
  })

  it('total diferente do que o servidor calcula: recusa com o total certo e não grava', async () => {
    const { deps, orders } = fakeDeps()
    expect(await handleOrder(request({ expectedTotalCents: 100 }), deps)).toEqual({ ok: false, reason: 'total-mudou', totalCents: 500 })
    // Preço mudado pelo vendedor no banco: o servidor usa o preço novo.
    const priced = fakeDeps({ rows: [{ kind: 'items', id: 'jujuba', data: { priceCents: 150 } }] })
    expect(await handleOrder(request(), priced.deps)).toEqual({ ok: false, reason: 'total-mudou', totalCents: 550 })
    expect(await handleOrder(request({ expectedTotalCents: 550 }), priced.deps)).toMatchObject({ ok: true, totalCents: 550 })
    expect(orders).toHaveLength(0)
  })

  it('item esgotado no banco: recusa com o nome, sem gravar', async () => {
    const { deps, orders } = fakeDeps({ rows: [{ kind: 'items', id: 'jujuba', data: { available: false } }] })
    expect(await handleOrder(request(), deps)).toEqual({ ok: false, reason: 'esgotado', detail: 'Jujuba' })
    expect(orders).toHaveLength(0)
  })

  it('item que saiu do cardápio: recusa', async () => {
    const { deps } = fakeDeps({ rows: [{ kind: 'items', id: 'jujuba', data: { deleted: true } }] })
    expect(await handleOrder(request(), deps)).toEqual({ ok: false, reason: 'item-indisponivel' })
  })

  it('loja fechada: "bloquear" recusa; "antecipado" grava com o aviso na comanda', async () => {
    const blocked = fakeDeps({ now: CLOSED, rows: [{ kind: 'settings', id: 'loja', data: { closedOrders: 'bloquear' } }] })
    expect(await handleOrder(request(), blocked.deps)).toEqual({ ok: false, reason: 'loja-fechada', detail: 'amanhã a partir das 13h' })
    const early = fakeDeps({ now: CLOSED })
    const result = await handleOrder(request(), early.deps)
    expect(result.ok && result.message.split('\n').slice(2, 4)).toEqual(['📅 *Data/Hora:* 17/11/2026 às 22:10', '⏰ *Pedido antecipado:* enviado com a loja fechada'])
    expect(early.orders[0].antecipado).toBe(true)
  })

  it('entrega com bairro: o frete do banco entra no total, no endereço e no troco', async () => {
    const zones = { kind: 'settings' as const, id: 'loja', data: { delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] } } }
    const { deps, orders } = fakeDeps({ rows: [zones] })
    const customer: CustomerDraft = { ...MARIA, kind: 'entrega', street: 'Rua das Flores', number: '12', zoneId: 'centro', reference: 'casa azul' }
    const cash: PaymentDraft = { method: 'dinheiro', changeFor: '10', exact: false }
    const result = await handleOrder(request({ customer, payment: cash, expectedTotalCents: 800 }), deps)
    expect(result.ok && result.message.split('\n')).toContain('  🪙 *Troco para:* R$ 10,00 *(Levar R$ 2,00 de troco)*')
    expect(orders[0]).toMatchObject({
      fulfillment: 'entrega',
      address: { street: 'Rua das Flores', number: '12', district: 'Centro', reference: 'casa azul' },
      delivery_fee: 'taxa',
      delivery_fee_cents: 300,
      delivery_zone: 'Centro',
      change_for_cents: 1000,
      total_cents: 800,
    })
  })

  it('dados do cliente ou pagamento inválidos: recusa com o motivo', async () => {
    const { deps } = fakeDeps()
    expect(await handleOrder(request({ customer: { ...MARIA, name: ' ' } }), deps)).toEqual({ ok: false, reason: 'dados-invalidos', detail: 'Escreva seu nome.' })
    expect(await handleOrder(request({ payment: { method: 'dinheiro', changeFor: '2', exact: false } }), deps)).toEqual({
      ok: false,
      reason: 'pagamento-invalido',
      detail: 'O valor informado é menor que o total do pedido (R$ 5,00)',
    })
    expect(await handleOrder(request({ payment: { method: 'boleto' } }), deps)).toEqual({
      ok: false,
      reason: 'pagamento-invalido',
      detail: 'Selecione uma forma de pagamento para continuar',
    })
  })

  it('entrada estranha, carrinho vazio ou grande demais: recusa sem ler o banco', async () => {
    const { deps, calls } = fakeDeps()
    expect(await handleOrder('qualquer coisa', deps)).toEqual({ ok: false, reason: 'pedido-invalido' })
    expect(await handleOrder(request({ expectedTotalCents: -1 }), deps)).toEqual({ ok: false, reason: 'pedido-invalido' })
    expect(await handleOrder(request({ cart: 'x'.repeat(200_001) }), deps)).toEqual({ ok: false, reason: 'pedido-invalido' })
    expect(calls.read).toBe(0)
    expect(await handleOrder(request({ cart: serializeCart(EMPTY_CART) }), deps)).toEqual({ ok: false, reason: 'carrinho-vazio' })
  })

  it('código do pedido: ADS- e 4 dígitos, depois cresce', () => {
    expect([orderCode(1), orderCode(42), orderCode(12345)]).toEqual(['ADS-0001', 'ADS-0042', 'ADS-12345'])
  })
})

describe('modalidades e GPS gravados (pedido de 2026-11-20)', () => {
  const ZONES = { kind: 'settings' as const, id: 'loja', data: { delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] } } }
  const GPS = { lat: -7.220987, lng: -37.254124 }
  const ENTREGA: CustomerDraft = { ...MARIA, kind: 'entrega', street: 'Rua das Flores', number: '12A', zoneId: 'centro', reference: '' }

  it('entrega com GPS: coordenadas e link gravados, iguais aos da comanda', async () => {
    const { deps, orders } = fakeDeps({ rows: [ZONES] })
    const result = await handleOrder(request({ customer: { ...ENTREGA, gps: GPS }, expectedTotalCents: 800 }), deps)
    expect(orders[0]).toMatchObject({
      fulfillment: 'entrega',
      address: { street: 'Rua das Flores', number: '12A', district: 'Centro', reference: null },
      delivery_fee: 'taxa',
      delivery_fee_cents: 300,
      customer_lat: -7.220987,
      customer_lng: -37.254124,
      maps_url: 'https://www.google.com/maps?q=-7.220987,-37.254124',
      total_cents: 800,
    })
    expect(result.ok && result.message.split('\n')).toContain('• *Localização GPS:* https://www.google.com/maps?q=-7.220987,-37.254124')
  })

  it('entrega sem GPS: os três campos nulos', async () => {
    const { deps, orders } = fakeDeps({ rows: [ZONES] })
    await handleOrder(request({ customer: ENTREGA, expectedTotalCents: 800 }), deps)
    expect(orders[0]).toMatchObject({ fulfillment: 'entrega', customer_lat: null, customer_lng: null, maps_url: null })
  })

  it('retirar e comer no local: frete zero e sem endereço nem GPS, mesmo com bairro pago e GPS enviados juntos', async () => {
    for (const kind of ['retirada', 'local'] as const) {
      const { deps, orders } = fakeDeps({ rows: [ZONES] })
      const customer = { ...ENTREGA, kind, gps: GPS }
      // O total que o cliente viu na tela, sem frete: R$ 5,00. Com o frete do bairro (R$ 8,00), recusa.
      expect(await handleOrder(request({ customer, expectedTotalCents: 800 }), deps)).toEqual({ ok: false, reason: 'total-mudou', totalCents: 500 })
      const result = await handleOrder(request({ customer, expectedTotalCents: 500 }), deps)
      expect(result).toMatchObject({ ok: true, totalCents: 500 })
      expect(orders[0]).toMatchObject({
        fulfillment: kind,
        address: null,
        delivery_fee: kind,
        delivery_fee_cents: 0,
        delivery_zone: null,
        customer_lat: null,
        customer_lng: null,
        maps_url: null,
        total_cents: 500,
      })
      const message = result.ok ? result.message : ''
      expect([message.includes('GPS'), message.includes('Rua das Flores')]).toEqual([false, false])
    }
  })

  it('retirar e comer no local ficam distintos na linha e na comanda', async () => {
    const { deps, orders } = fakeDeps()
    const pickup = await handleOrder(request({ customer: { ...MARIA, kind: 'retirada' } }), deps)
    const dineIn = await handleOrder(request({ customer: { ...MARIA, kind: 'local' } }), deps)
    expect(orders.map((order) => order.fulfillment)).toEqual(['retirada', 'local'])
    expect(pickup.ok && pickup.message.split('\n')).toContain('• *Modalidade:* 🛍️ Retirar no Local (Levar para casa)')
    expect(dineIn.ok && dineIn.message.split('\n')).toContain('• *Modalidade:* 🍨 COMER NO LOCAL (Deixar pronto para chegada)')
  })

  it('GPS inválido ou incompleto enviado por fora: grava sem GPS, nunca pela metade', async () => {
    for (const gps of [{ lat: 200, lng: -37.2 }, { lat: -7.2 }, { lat: '-7.2', lng: '-37.2' }]) {
      const { deps, orders } = fakeDeps({ rows: [ZONES] })
      await handleOrder(request({ customer: { ...ENTREGA, gps }, expectedTotalCents: 800 }), deps)
      expect(orders[0]).toMatchObject({ customer_lat: null, customer_lng: null, maps_url: null })
    }
  })

  it('o mesmo pedido com outro GPS é outra tentativa (o ponto faz parte do pedido)', async () => {
    const { deps } = fakeDeps({ rows: [ZONES] })
    const first = await handleOrder(request({ customer: { ...ENTREGA, gps: GPS }, expectedTotalCents: 800 }), deps)
    const moved = await handleOrder(request({ customer: { ...ENTREGA, gps: { lat: -7.221, lng: -37.254 } }, expectedTotalCents: 800 }), deps)
    expect([first.ok && first.code, moved.ok && moved.code]).toEqual(['ADS-0001', 'ADS-0002'])
  })

  it('modalidade estranha: pede para escolher', async () => {
    const { deps } = fakeDeps()
    expect(await handleOrder(request({ customer: { ...MARIA, kind: 'mesa' } }), deps)).toEqual({
      ok: false,
      reason: 'dados-invalidos',
      detail: 'Escolha entrega, retirada ou comer no local.',
    })
  })
})

