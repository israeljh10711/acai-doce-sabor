import { describe, expect, it } from 'vitest'
import {
  type PanelOrder,
  canCancel,
  comandaItems,
  feeLine,
  filterCounts,
  filterOrders,
  newOrders,
  nextStep,
  ordersSince,
  parseOrderRow,
  paymentText,
  storeDayStart,
} from './ordersPanel.ts'

/** Uma linha da tabela `orders` como a função `pedido` grava (entrega com GPS). */
const ROW = {
  id: '6f1c0f7e-1111-4c2a-9d1e-000000000001',
  number: 7,
  code: 'ADS-0007',
  created_at: '2026-11-20T18:42:10.123+00:00',
  status: 'novo',
  customer_name: 'Maria',
  customer_phone: '(83) 99999-0000',
  fulfillment: 'entrega',
  address: { street: 'Rua das Flores', number: '12A', district: 'Centro', reference: 'portão azul' },
  delivery_fee: 'taxa',
  delivery_fee_cents: 300,
  delivery_zone: 'Centro',
  customer_lat: -7.220987,
  customer_lng: -37.254124,
  maps_url: 'https://www.google.com/maps?q=-7.220987,-37.254124',
  payment_method: 'dinheiro',
  change_for_cents: 5000,
  subtotal_cents: 3100,
  total_cents: 3400,
  antecipado: false,
  items: [{ name: 'Açaí Tradicional (Isopor M)', quantity: 1, unit_cents: 2500, total_cents: 2500, note: 'pouco gelo' }],
  message: [
    '🍧 *NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍧',
    '🔖 *Pedido:* ADS-0007',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '🍨 *ITENS DO PEDIDO*',
    '',
    '1️⃣ *1x Açaí Tradicional* (Isopor M) — *R$ 25,00*',
    '   ✨ *Montagem:* COMPLETO',
    '   🚫 *RETIRAR (SEM):* Farinha láctea',
    '   📝 *Observação:* pouco gelo',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '🧾 *RESUMO FINANCEIRO*',
  ].join('\n'),
}
const order = (patch: Record<string, unknown> = {}): PanelOrder => {
  const parsed = parseOrderRow({ ...ROW, ...patch })
  if (!parsed) throw new Error('linha recusada')
  return parsed
}

describe('leitura dos pedidos no painel (pedido de 2026-11-20, etapa 2)', () => {
  it('entrega com GPS: tudo o que a equipe precisa, com o link refeito das coordenadas validadas', () => {
    expect(order()).toEqual({
      id: ROW.id,
      number: 7,
      code: 'ADS-0007',
      createdAt: Date.parse('2026-11-20T18:42:10.123Z'),
      status: 'novo',
      customerName: 'Maria',
      customerPhone: '(83) 99999-0000',
      deliveryType: 'entrega',
      address: { street: 'Rua das Flores', number: '12A', district: 'Centro', reference: 'portão azul' },
      gps: { lat: -7.220987, lng: -37.254124 },
      mapsUrl: 'https://www.google.com/maps?q=-7.220987,-37.254124',
      fee: { kind: 'taxa', cents: 300, zone: 'Centro' },
      paymentMethod: 'dinheiro',
      changeForCents: 5000,
      subtotalCents: 3100,
      totalCents: 3400,
      antecipado: false,
      items: [{ name: 'Açaí Tradicional (Isopor M)', quantity: 1, totalCents: 2500, note: 'pouco gelo' }],
      message: ROW.message,
    })
  })

  it('link de mapa gravado diferente das coordenadas: vale o refeito das coordenadas', () => {
    expect(order({ maps_url: 'https://exemplo.com/?q=1,2' }).mapsUrl).toBe('https://www.google.com/maps?q=-7.220987,-37.254124')
  })

  it('entrega sem GPS, ou com coordenadas inválidas ou pela metade: sem botão de GPS', () => {
    for (const patch of [
      { customer_lat: null, customer_lng: null, maps_url: null },
      { customer_lat: 200 },
      { customer_lng: null },
      { customer_lat: '-7.2' },
    ]) {
      expect([order(patch).gps, order(patch).mapsUrl]).toEqual([null, null])
    }
  })

  it('retirar e comer no local: nunca endereço nem GPS, mesmo que venham na linha', () => {
    for (const fulfillment of ['retirada', 'local']) {
      const parsed = order({ fulfillment, delivery_fee: fulfillment, delivery_fee_cents: 0 })
      expect([parsed.deliveryType, parsed.address, parsed.gps, parsed.mapsUrl]).toEqual([fulfillment, null, null, null])
    }
  })

  it('pedido antigo (antes de 2026-11-20, sem as colunas novas): aparece normalmente', () => {
    const old = Object.fromEntries(Object.entries(ROW).filter(([key]) => !['customer_lat', 'customer_lng', 'maps_url'].includes(key)))
    const parsed = parseOrderRow({ ...old, fulfillment: 'retirada', address: null, delivery_fee: 'retirada', delivery_fee_cents: 0, delivery_zone: null })
    expect(parsed && [parsed.deliveryType, parsed.gps, parsed.mapsUrl, parsed.code]).toEqual(['retirada', null, null, 'ADS-0007'])
  })

  it('campos estranhos viram vazio; modalidade desconhecida fica "não informada"', () => {
    const parsed = order({ fulfillment: 'mesa', customer_phone: 5, items: 'x', payment_method: 'boleto', subtotal_cents: -1, antecipado: 'sim', message: null })
    expect([parsed.deliveryType, parsed.customerPhone, parsed.items, parsed.paymentMethod, parsed.subtotalCents, parsed.antecipado, parsed.message]).toEqual([
      null,
      null,
      [],
      null,
      0,
      false,
      '',
    ])
  })

  it('linha sem id, código ou situação válida fica de fora', () => {
    for (const patch of [{ id: null }, { code: '' }, { status: 'voando' }]) expect(parseOrderRow({ ...ROW, ...patch })).toBeNull()
    for (const raw of [null, 'x', [], 5]) expect(parseOrderRow(raw)).toBeNull()
  })
})

describe('situação do pedido (pedido de 2026-11-20, etapa 2)', () => {
  it('entrega: Confirmar → Preparando → Pronto → Saiu para entrega → Concluído', () => {
    const steps = ['novo', 'confirmado', 'preparando', 'pronto', 'saiu_para_entrega', 'concluido'].map((status) => nextStep(order({ status })))
    expect(steps).toEqual([
      { status: 'confirmado', label: 'Confirmar' },
      { status: 'preparando', label: 'Preparando' },
      { status: 'pronto', label: 'Pronto' },
      { status: 'saiu_para_entrega', label: 'Saiu para entrega' },
      { status: 'concluido', label: 'Concluído' },
      null,
    ])
  })

  it('retirar e comer no local: de Pronto direto para Concluído', () => {
    for (const fulfillment of ['retirada', 'local']) {
      expect(nextStep(order({ fulfillment, status: 'pronto' }))).toEqual({ status: 'concluido', label: 'Concluído' })
    }
  })

  it('cancelar até concluir; cancelado não volta', () => {
    expect(['novo', 'confirmado', 'preparando', 'pronto', 'saiu_para_entrega'].every((status) => canCancel(order({ status })))).toBe(true)
    expect([canCancel(order({ status: 'concluido' })), canCancel(order({ status: 'cancelado' })), nextStep(order({ status: 'cancelado' }))]).toEqual([false, false, null])
  })
})

describe('filtro por situação (pedido de 2026-11-20, etapa 2)', () => {
  const list = ['novo', 'novo', 'preparando', 'pronto', 'saiu_para_entrega', 'concluido', 'cancelado'].map((status, index) =>
    order({ status, id: `id-${index}`, code: `ADS-000${index}` }),
  )

  it('em andamento: de novo até saiu para entrega; cada situação; todos', () => {
    expect(filterOrders(list, 'andamento').map((item) => item.status)).toEqual(['novo', 'novo', 'preparando', 'pronto', 'saiu_para_entrega'])
    expect(filterOrders(list, 'novo')).toHaveLength(2)
    expect(filterOrders(list, 'cancelado').map((item) => item.code)).toEqual(['ADS-0006'])
    expect(filterOrders(list, 'todos')).toHaveLength(7)
  })

  it('contagens de cada filtro', () => {
    expect(filterCounts(list)).toEqual({
      andamento: 5,
      novo: 2,
      confirmado: 0,
      preparando: 1,
      pronto: 1,
      saiu_para_entrega: 1,
      concluido: 1,
      cancelado: 1,
      todos: 7,
    })
  })
})

describe('textos do cartão (pedido de 2026-11-20, etapa 2)', () => {
  it('pagamento: Pix, cartão (maquininha só na entrega) e dinheiro com o troco', () => {
    expect(paymentText(order({ payment_method: 'pix' }))).toBe('Pix')
    expect(paymentText(order({ payment_method: 'credito' }))).toBe('Cartão de crédito (levar maquininha)')
    expect(paymentText(order({ payment_method: 'debito', fulfillment: 'local' }))).toBe('Cartão de débito')
    expect(paymentText(order())).toBe('Dinheiro: troco para R$ 50,00 (levar R$ 16,00)')
    expect(paymentText(order({ change_for_cents: null }))).toBe('Dinheiro, sem troco')
    expect(paymentText(order({ delivery_fee: 'combinar', delivery_fee_cents: 0 }))).toBe('Dinheiro: troco para R$ 50,00 (frete a combinar)')
    expect(paymentText(order({ payment_method: null }))).toBe('Não informado')
  })

  it('frete de cada modalidade, distinguindo grátis de a combinar', () => {
    expect(feeLine(order())).toEqual({ label: 'Frete (Centro)', value: 'R$ 3,00' })
    expect(feeLine(order({ delivery_fee: 'gratis', delivery_fee_cents: 0, delivery_zone: null }))).toEqual({ label: 'Frete', value: 'Grátis' })
    expect(feeLine(order({ delivery_fee: 'combinar', delivery_fee_cents: 0, delivery_zone: null }))).toEqual({ label: 'Frete', value: 'A combinar' })
    expect(feeLine(order({ fulfillment: 'retirada', delivery_fee: 'retirada', delivery_fee_cents: 0 }))).toEqual({ label: 'Retirada na loja', value: 'Grátis' })
    expect(feeLine(order({ fulfillment: 'local', delivery_fee: 'local', delivery_fee_cents: 0 }))).toEqual({ label: 'Consumo no local', value: 'Grátis' })
  })

  it('itens como saíram na comanda, sem as marcas do WhatsApp', () => {
    expect(comandaItems(ROW.message)).toEqual([
      '1️⃣ 1x Açaí Tradicional (Isopor M) — R$ 25,00',
      '   ✨ Montagem: COMPLETO',
      '   🚫 RETIRAR (SEM): Farinha láctea',
      '   📝 Observação: pouco gelo',
    ])
    expect(comandaItems('texto sem a parte dos itens')).toEqual([])
  })
})

describe('pedidos novos e o dia da loja (pedido de 2026-11-20, etapa 2)', () => {
  it('pedido novo: ainda não visto e na situação "novo"', () => {
    const list = [order({ id: 'a' }), order({ id: 'b' }), order({ id: 'c', status: 'confirmado' })]
    expect(newOrders(new Set(['a']), list).map((item) => item.id)).toEqual(['b'])
  })

  it('o dia da loja começa às 5h de Brasília', () => {
    // 20/11 às 15:42 em Brasília: desde 20/11 às 5h.
    expect(storeDayStart(Date.parse('2026-11-20T15:42:31.250-03:00'))).toBe(Date.parse('2026-11-20T05:00:00-03:00'))
    // 21/11 às 2h (madrugada, pedido antecipado): ainda é o dia 20.
    expect(storeDayStart(Date.parse('2026-11-21T02:10:00-03:00'))).toBe(Date.parse('2026-11-20T05:00:00-03:00'))
    expect(ordersSince(Date.parse('2026-11-20T15:42:00-03:00'))).toBe('2026-11-20T08:00:00.000Z')
  })
})
