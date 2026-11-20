import { describe, expect, it } from 'vitest'
import {
  ORDER_FILTERS,
  type PanelOrder,
  STATUS_LABEL,
  canCancel,
  feeLine,
  filterCounts,
  filterOrders,
  newOrders,
  nextStep,
  ordersSince,
  parseOrderRow,
  parseComandaItems,
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
      additions: [],
    })
  })

  it('itens acrescentados pelo cliente (2026-11-20): cada lote com a hora, os itens e o valor', () => {
    const additions = [
      { created_at: '2026-11-20T19:00:00.000Z', subtotal_cents: 700, itemsBlock: 'bloco', items: [{ name: 'Picolé', quantity: 2, total_cents: 700 }] },
      'estragado',
    ]
    expect(order({ additions }).additions).toEqual([
      { createdAt: Date.parse('2026-11-20T19:00:00.000Z'), subtotalCents: 700, itemsBlock: 'bloco', items: [{ name: 'Picolé', quantity: 2, totalCents: 700, note: null }] },
    ])
    expect(order({ additions: null }).additions).toEqual([])
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

describe('fluxo de situação por modalidade (painel ao vivo, 2026-11-20)', () => {
  const flow = (fulfillment: string) =>
    ['novo', 'preparando'].map((status) => nextStep(order({ fulfillment, status, delivery_fee: fulfillment === 'entrega' ? 'taxa' : fulfillment })))

  it('novo: "Aceitar / Preparar" leva a preparando, em qualquer modalidade', () => {
    for (const fulfillment of ['entrega', 'retirada', 'local']) expect(flow(fulfillment)[0]).toEqual({ status: 'preparando', label: 'Aceitar / Preparar' })
    // Pedido antigo já confirmado (fluxo anterior): também vai para preparando.
    expect(nextStep(order({ status: 'confirmado' }))).toEqual({ status: 'preparando', label: 'Aceitar / Preparar' })
  })

  it('preparando: o próximo passo é próprio de cada modalidade, com estados distintos', () => {
    expect(flow('entrega')[1]).toEqual({ status: 'saiu_para_entrega', label: '🛵 Saiu para Entrega' })
    expect(flow('retirada')[1]).toEqual({ status: 'pronto_retirada', label: '🛍️ Pronto para Retirada' })
    expect(flow('local')[1]).toEqual({ status: 'pronto_consumo', label: '🍨 Pronto para Consumo' })
  })

  it('saiu / pronto: "✅ Concluir"; concluído e cancelado não têm mais passos', () => {
    for (const status of ['saiu_para_entrega', 'pronto_retirada', 'pronto_consumo', 'pronto']) {
      expect(nextStep(order({ status }))).toEqual({ status: 'concluido', label: '✅ Concluir' })
    }
    expect([nextStep(order({ status: 'concluido' })), nextStep(order({ status: 'cancelado' }))]).toEqual([null, null])
  })

  it('cancelar até concluir; concluído ou cancelado não cancela', () => {
    const open = ['novo', 'confirmado', 'preparando', 'pronto', 'pronto_retirada', 'pronto_consumo', 'saiu_para_entrega']
    expect(open.every((status) => canCancel(order({ status })))).toBe(true)
    expect([canCancel(order({ status: 'concluido' })), canCancel(order({ status: 'cancelado' }))]).toEqual([false, false])
  })

  it('as situações novas são lidas; os rótulos dizem a modalidade', () => {
    expect([order({ status: 'pronto_retirada' }).status, STATUS_LABEL.pronto_retirada, STATUS_LABEL.pronto_consumo, STATUS_LABEL.saiu_para_entrega]).toEqual([
      'pronto_retirada',
      'Pronto para retirada',
      'Pronto para consumo',
      'Saiu para entrega',
    ])
  })
})

describe('filtros rápidos (painel ao vivo, 2026-11-20)', () => {
  const list = ['novo', 'novo', 'confirmado', 'preparando', 'saiu_para_entrega', 'pronto_retirada', 'pronto_consumo', 'pronto', 'concluido', 'cancelado'].map(
    (status, index) => order({ status, id: `id-${index}`, code: `ADS-000${index}` }),
  )

  it('os 5 filtros, na ordem pedida', () => {
    expect(ORDER_FILTERS.map((filter) => filter.label)).toEqual(['Todos', '🆕 Novos', '🍨 Preparando', '🛵 Saiu / Pronto', '✅ Concluídos'])
  })

  it('cada filtro mostra só os seus; cancelado aparece em Todos e não conta como concluído', () => {
    expect(filterOrders(list, 'todos')).toHaveLength(10)
    expect(filterOrders(list, 'novos').map((item) => item.status)).toEqual(['novo', 'novo'])
    expect(filterOrders(list, 'preparando').map((item) => item.status)).toEqual(['confirmado', 'preparando'])
    expect(filterOrders(list, 'saiu_pronto').map((item) => item.status)).toEqual(['saiu_para_entrega', 'pronto_retirada', 'pronto_consumo', 'pronto'])
    expect(filterOrders(list, 'concluidos').map((item) => item.status)).toEqual(['concluido'])
  })

  it('contagens de cada filtro', () => {
    expect(filterCounts(list)).toEqual({ todos: 10, novos: 2, preparando: 2, saiu_pronto: 4, concluidos: 1 })
  })
})

describe('textos do cartão (painel ao vivo, 2026-11-20)', () => {
  it('pagamento: 💠 Pix, 💳 Cartão (maquininha só na entrega) e 💵 Dinheiro com troco só quando informado', () => {
    expect(paymentText(order({ payment_method: 'pix' }))).toBe('💠 Pix')
    expect(paymentText(order({ payment_method: 'credito' }))).toBe('💳 Cartão de crédito (levar maquininha)')
    expect(paymentText(order({ payment_method: 'debito', fulfillment: 'local' }))).toBe('💳 Cartão de débito')
    expect(paymentText(order())).toBe('💵 Dinheiro — Troco para R$ 50,00 (levar R$ 16,00)')
    expect(paymentText(order({ change_for_cents: null }))).toBe('💵 Dinheiro')
    expect(paymentText(order({ delivery_fee: 'combinar', delivery_fee_cents: 0 }))).toBe('💵 Dinheiro — Troco para R$ 50,00 (frete a combinar)')
    expect(paymentText(order({ payment_method: null }))).toBe('Não informado')
  })

  it('frete de cada modalidade, distinguindo grátis de a combinar', () => {
    expect(feeLine(order())).toEqual({ label: 'Frete (Centro)', value: 'R$ 3,00' })
    expect(feeLine(order({ delivery_fee: 'gratis', delivery_fee_cents: 0, delivery_zone: null }))).toEqual({ label: 'Frete', value: 'Grátis' })
    expect(feeLine(order({ delivery_fee: 'combinar', delivery_fee_cents: 0, delivery_zone: null }))).toEqual({ label: 'Frete', value: 'A combinar' })
    expect(feeLine(order({ fulfillment: 'retirada', delivery_fee: 'retirada', delivery_fee_cents: 0 }))).toEqual({ label: 'Retirada na loja', value: 'Grátis' })
    expect(feeLine(order({ fulfillment: 'local', delivery_fee: 'local', delivery_fee_cents: 0 }))).toEqual({ label: 'Consumo no local', value: 'Grátis' })
  })

  it('itens lidos da comanda: tamanho, Completo, SEM, pagos, acompanhamentos e observação', () => {
    const message = [
      '🍨 *ITENS DO PEDIDO*',
      '',
      '1️⃣ *1x Açaí Tradicional* (Isopor M) — *R$ 25,00*',
      '   ✨ *Montagem:* COMPLETO',
      '   🚫 *RETIRAR (SEM):* Farinha láctea, Granola',
      '   ➕ *Cremes / Extras Pagos:* Creme de ninho (+R$ 3,00), 2x Kit Kat (+R$ 8,00)',
      '   🥄 *Acompanhamentos:*',
      '      • Adicionais: Leite em pó, Paçoca',
      '      • Frutas: Banana',
      '   📝 *Observação:* pouco gelo',
      '',
      '2️⃣ *2x Picolé Gourmet* (Sabor: Nutella) — *R$ 6,00*',
      '',
      '1️⃣0️⃣ *1x Kit Completo Casquinha DUO* — *R$ 41,00*',
      '   • *Sabor do sorvete (2 litros):* Trio (Chocolate, flocos e creme)',
      '   • *Sabor da cobertura:* Caramelo',
      '',
      '━━━━━━━━━━━━━━━━━━━━',
    ].join('\n')
    const empty = { details: null, montagem: null, removed: [], paid: null, included: [], rows: [], note: null }
    expect(parseComandaItems(message)).toEqual([
      {
        ...empty,
        quantity: 1,
        name: 'Açaí Tradicional',
        details: 'Isopor M',
        total: 'R$ 25,00',
        montagem: 'COMPLETO',
        removed: ['Farinha láctea', 'Granola'],
        paid: 'Creme de ninho (+R$ 3,00), 2x Kit Kat (+R$ 8,00)',
        included: [
          { label: 'Adicionais', names: 'Leite em pó, Paçoca' },
          { label: 'Frutas', names: 'Banana' },
        ],
        note: 'pouco gelo',
      },
      { ...empty, quantity: 2, name: 'Picolé Gourmet', details: 'Sabor: Nutella', total: 'R$ 6,00' },
      {
        ...empty,
        quantity: 1,
        name: 'Kit Completo Casquinha DUO',
        total: 'R$ 41,00',
        rows: [
          { label: 'Sabor do sorvete (2 litros)', value: 'Trio (Chocolate, flocos e creme)' },
          { label: 'Sabor da cobertura', value: 'Caramelo' },
        ],
      },
    ])
  })

  it('comanda sem a parte dos itens: nada (o cartão usa a lista gravada)', () => {
    expect(parseComandaItems('texto sem a parte dos itens')).toEqual([])
    expect(parseComandaItems(ROW.message)).toHaveLength(1)
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
