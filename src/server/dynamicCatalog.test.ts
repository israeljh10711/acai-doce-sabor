/**
 * A função do pedido com o cardápio do banco (cardápio dinâmico, 2026-11-21): produtos, tamanhos,
 * grupos e ofertas criados pelo vendedor, conferidos e cobrados pelo servidor; formas de pagamento e
 * bairros das Configurações da loja; leitura do banco sem atalhos.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, addItem, serializeCart } from '../features/cart/cart.ts'
import { NO_CHANGES } from '../features/catalog/catalogChanges.ts'
import { setCatalogChanges, setCatalogRecords } from '../features/catalog/catalogState.ts'
import { PRODUCTS, type ProductSlug } from '../features/catalog/menu.ts'
import { applyDraft, newDraft, settleDraft } from '../features/catalog/productDraft.ts'
import { type CatalogRecords, type OfferRecord, parseCatalogRecords } from '../features/catalog/records.ts'
import { EMPTY_SELECTION, addTopping, chooseSize } from '../features/catalog/selection.ts'
import { type CustomerDraft, EMPTY_CUSTOMER } from '../features/checkout/delivery.ts'
import type { PaymentDraft } from '../features/checkout/payment.ts'
import type { ChangeRow } from '../services/supabaseRest.ts'
import { all, catalogWith, editProduct } from './catalogFixtures.ts'
import { type OrderDeps, type OrderRow, type StoredOrder, handleOrder } from './orderServer.ts'

afterEach(() => {
  setCatalogRecords(null)
  setCatalogChanges(NO_CHANGES)
})

const NOW = Date.parse('2026-11-21T15:00:00-03:00')
const MARIA: CustomerDraft = { ...EMPTY_CUSTOMER, name: 'Maria', kind: 'retirada' }
const PIX: PaymentDraft = { method: 'pix', changeFor: '', exact: false }

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fakeDeps({ catalog = catalogWith() as unknown, rows = [] as ChangeRow[], failCatalog = false } = {}) {
  const orders: (OrderRow & StoredOrder)[] = []
  const calls = { changes: 0, catalog: 0, number: 0 }
  const deps: OrderDeps = {
    readChanges: async () => {
      calls.changes++
      return rows
    },
    readCatalog: async () => {
      calls.catalog++
      if (failCatalog) throw new Error('Supabase respondeu 503 em /rest/v1/rpc/catalogo_publico')
      return JSON.parse(JSON.stringify(catalog))
    },
    findOrder: async (key) => orders.find((order) => order.attempt_key === key) ?? null,
    nextNumber: async () => {
      calls.number++
      return orders.length + 1
    },
    insertOrder: async (row) => {
      const stored = { ...row, id: `pedido-${row.number}`, created_at: new Date(NOW).toISOString() }
      orders.push(stored)
      return stored
    },
    now: () => NOW,
    sha256,
  }
  return { deps, orders, calls }
}

/** Monta o carrinho como o cliente montou, com o cardápio que ele via. */
function cartWith(records: CatalogRecords, build: () => string): string {
  setCatalogRecords(records)
  const cart = build()
  setCatalogRecords(null)
  return cart
}
const records = (change?: (records: CatalogRecords) => CatalogRecords) => parseCatalogRecords(catalogWith(change))
const order = (cart: string, expectedTotalCents: number, patch: Record<string, unknown> = {}) => ({ cart, customer: MARIA, payment: PIX, expectedTotalCents, ...patch })

/** Um açaí montável criado pelo vendedor: copo de R$ 15,00 com 1 adicional grátis, adicionais e frutas. */
function withSellerProduct(base: CatalogRecords): CatalogRecords {
  const draft = newDraft(base, 'montavel', 'barcas-e-potes')
  draft.product.name = 'Açaí Zero'
  draft.product.priceCents = 1500
  draft.variants = [
    { productId: '', id: '', name: 'Copo 300 ml', container: 'copo', priceCents: 1500, freeCount: 1, available: true, position: 0 },
    { productId: '', id: '', name: 'Copo 500 ml', container: 'copo', priceCents: 2000, freeCount: 2, available: true, position: 1 },
  ]
  draft.groups = [
    { productId: '', groupId: 'dry', position: 0, maxSelect: null },
    { productId: '', groupId: 'fruit', position: 1, maxSelect: null },
  ]
  return applyDraft(base, settleDraft(draft, new Set(base.products.map((product) => product.id))))
}
const zeroCart = (sizeId: string, toppings: string[]) =>
  serializeCart(
    (() => {
      const product = PRODUCTS['acai-zero' as ProductSlug]
      let selection = chooseSize(product, EMPTY_SELECTION, sizeId).selection
      for (const id of toppings) selection = addTopping(product, selection, id)
      return addItem(EMPTY_CART, 'acai-zero' as ProductSlug, selection, 'z1').cart
    })(),
  )

describe('produto criado pelo vendedor', () => {
  it('montável novo: o servidor confere e cobra pelo banco', async () => {
    const seller = withSellerProduct(records())
    const cart = cartWith(seller, () => zeroCart('copo-300-ml', ['granola', 'kiwi']))
    const { deps, orders } = fakeDeps({ catalog: catalogWith(withSellerProduct) })
    const result = await handleOrder(order(cart, 1500), deps)
    expect(result).toMatchObject({ ok: true, totalCents: 1500 })
    expect(orders[0].items).toEqual([{ name: 'Açaí Zero (Copo 300 ml)', quantity: 1, unit_cents: 1500, total_cents: 1500 }])
    expect(result.ok && result.message).toContain('Açaí Zero')
  })

  it('o banco sem o produto (o cliente com o cardápio antigo): recusa', async () => {
    const cart = cartWith(withSellerProduct(records()), () => zeroCart('copo-300-ml', []))
    const { deps, orders } = fakeDeps()
    expect(await handleOrder(order(cart, 1500), deps)).toEqual({ ok: false, reason: 'item-indisponivel' })
    expect(orders).toHaveLength(0)
  })

  it('tamanho esgotado: recusa com o nome do tamanho', async () => {
    const cart = cartWith(withSellerProduct(records()), () => zeroCart('copo-500-ml', []))
    const soldOut = all(withSellerProduct, (base) => ({ ...base, variants: base.variants.map((variant) => (variant.id === 'copo-500-ml' ? { ...variant, available: false } : variant)) }))
    const { deps } = fakeDeps({ catalog: catalogWith(soldOut) })
    expect(await handleOrder(order(cart, 2000), deps)).toEqual({ ok: false, reason: 'esgotado', detail: 'Copo 500 ml' })
  })

  it('categoria oculta leva o produto junto', async () => {
    const cart = cartWith(withSellerProduct(records()), () => zeroCart('copo-300-ml', []))
    const hidden = all(withSellerProduct, (base) => ({ ...base, categories: base.categories.map((category) => (category.id === 'barcas-e-potes' ? { ...category, visible: false } : category)) }))
    const { deps } = fakeDeps({ catalog: catalogWith(hidden) })
    expect(await handleOrder(order(cart, 1500), deps)).toEqual({ ok: false, reason: 'item-indisponivel' })
  })

  it('máximo do grupo baixado depois de montar: recusa com o nome do item, sem cortar em silêncio', async () => {
    const cart = cartWith(withSellerProduct(records()), () => zeroCart('copo-300-ml', ['kiwi', 'morango', 'banana']))
    const lowered = all(withSellerProduct, (base) => ({ ...base, groups: base.groups.map((group) => (group.id === 'fruit' ? { ...group, maxSelect: 2 } : group)) }))
    const { deps } = fakeDeps({ catalog: catalogWith(lowered) })
    expect(await handleOrder(order(cart, 1500), deps)).toEqual({ ok: false, reason: 'item-indisponivel', detail: 'Açaí Zero (Copo 300 ml)' })
  })

  it('grupo obrigatório (mínimo) sem escolha: recusa', async () => {
    const cart = cartWith(withSellerProduct(records()), () => zeroCart('copo-300-ml', []))
    const required = all(withSellerProduct, (base) => ({ ...base, groups: base.groups.map((group) => (group.id === 'fruit' ? { ...group, minSelect: 1 } : group)) }))
    const { deps } = fakeDeps({ catalog: catalogWith(required) })
    expect(await handleOrder(order(cart, 1500), deps)).toEqual({ ok: false, reason: 'item-indisponivel' })
  })

  it('grupo esgotado: recusa com o complemento', async () => {
    const cart = cartWith(withSellerProduct(records()), () => zeroCart('copo-300-ml', ['kiwi']))
    const soldOut = all(withSellerProduct, (base) => ({ ...base, groups: base.groups.map((group) => (group.id === 'fruit' ? { ...group, available: false } : group)) }))
    const { deps } = fakeDeps({ catalog: catalogWith(soldOut) })
    expect(await handleOrder(order(cart, 1500), deps)).toEqual({ ok: false, reason: 'esgotado', detail: 'Kiwi' })
  })

  it('grátis e preço extra do grupo: o servidor cobra as unidades a mais', async () => {
    const extra = all(withSellerProduct, (base) => ({ ...base, groups: base.groups.map((group) => (group.id === 'fruit' ? { ...group, freeCount: 1, extraPriceCents: 250 } : group)) }))
    const cart = cartWith(records(extra), () => zeroCart('copo-300-ml', ['kiwi', 'morango', 'banana']))
    const { deps, orders } = fakeDeps({ catalog: catalogWith(extra) })
    expect(await handleOrder(order(cart, 1500), deps)).toMatchObject({ ok: false, reason: 'total-mudou', totalCents: 2000 })
    expect(await handleOrder(order(cart, 2000), deps)).toMatchObject({ ok: true, totalCents: 2000 })
    expect(orders[0].items[0]).toMatchObject({ total_cents: 2000 })
  })

  it('produto com variações criado pelo vendedor: o preço é o do tamanho escolhido', async () => {
    const withSizes = (base: CatalogRecords) => {
      const draft = newDraft(base, 'variacoes', 'bebidas')
      draft.product.name = 'Suco Natural'
      draft.variants = [
        { productId: '', id: '', name: '300 ml', container: null, priceCents: 600, freeCount: 0, available: true, position: 0 },
        { productId: '', id: '', name: '500 ml', container: null, priceCents: 900, freeCount: 0, available: true, position: 1 },
      ]
      draft.choices = [{ productId: '', id: '', label: 'Sabor', allowOther: false, photoAlt: null, position: 0, options: [{ productId: '', choiceId: '', id: '', name: 'Laranja', photo: null, available: true, position: 0 }] }]
      return applyDraft(base, settleDraft(draft, new Set(base.products.map((product) => product.id))))
    }
    const cart = cartWith(records(withSizes), () => serializeCart(addExtraItem(EMPTY_CART, 'suco-natural', { tamanho: '500 ml', sabor: 'Laranja' }, 's1').cart))
    const { deps, orders } = fakeDeps({ catalog: catalogWith(withSizes) })
    expect(await handleOrder(order(cart, 900), deps)).toMatchObject({ ok: true, totalCents: 900 })
    expect(orders[0].items).toEqual([{ name: 'Suco Natural', quantity: 1, unit_cents: 900, total_cents: 900 }])
  })
})

describe('ofertas', () => {
  const promo = (patch: Partial<OfferRecord>) => (base: CatalogRecords) => ({
    ...base,
    offers: [...base.offers, { ...base.offers[0], id: 'agua-promo', productId: 'agua-mineral-500-ml', promoPriceCents: 150, position: 0, ...patch }],
  })
  const waterCart = () => serializeCart(addExtraItem(EMPTY_CART, 'agua-mineral-500-ml', {}, 'w1').cart)

  it('oferta ativa: o servidor cobra o preço promocional, com a hora dele', async () => {
    const { deps } = fakeDeps({ catalog: catalogWith(promo({})) })
    expect(await handleOrder(order(waterCart(), 200), deps)).toMatchObject({ ok: false, reason: 'total-mudou', totalCents: 150 })
    expect(await handleOrder(order(waterCart(), 150), deps)).toMatchObject({ ok: true, totalCents: 150 })
  })

  it('oferta pausada, encerrada ou que ainda não começou: preço normal (o cliente não força a promoção)', async () => {
    for (const patch of [{ status: 'pausada' as const }, { endsAt: '2026-11-21T17:59:00Z' }, { startsAt: '2026-11-22T00:00:00Z' }]) {
      const { deps } = fakeDeps({ catalog: catalogWith(promo(patch)) })
      expect(await handleOrder(order(waterCart(), 150), deps)).toMatchObject({ ok: false, reason: 'total-mudou', totalCents: 200 })
    }
  })
})

describe('Configurações da loja no servidor', () => {
  const jujubaCart = () => serializeCart(addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart)
  const settings = (data: Record<string, unknown>): ChangeRow[] => [{ kind: 'settings', id: 'loja', data }]

  it('forma de pagamento desligada: recusa, mesmo que o cliente mande', async () => {
    const { deps, orders } = fakeDeps({ rows: settings({ payments: { pix: true, dinheiro: true, cartao: false } }) })
    expect(await handleOrder(order(jujubaCart(), 100, { payment: { method: 'credito', changeFor: '', exact: false } }), deps)).toEqual({
      ok: false,
      reason: 'pagamento-invalido',
      detail: 'A loja não está aceitando Cartão de crédito agora. Escolha outra forma de pagamento.',
    })
    expect(orders).toHaveLength(0)
  })

  it('Pix desligado: recusa o Pix', async () => {
    const { deps } = fakeDeps({ rows: settings({ pix: { enabled: false, type: 'cpf', key: '', holder: '' } }) })
    expect(await handleOrder(order(jujubaCart(), 100), deps)).toMatchObject({ ok: false, reason: 'pagamento-invalido' })
  })

  it('bairro desligado: recusa a entrega nele', async () => {
    const rows = settings({ delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300, active: false }, { id: 'alto', name: 'Alto', feeCents: 500 }] } })
    const customer = { ...EMPTY_CUSTOMER, name: 'Maria', kind: 'entrega', street: 'Rua A', number: '1', zoneId: 'centro', phone: '83999990000' }
    const { deps } = fakeDeps({ rows })
    expect(await handleOrder(order(jujubaCart(), 400, { customer }), deps)).toMatchObject({ ok: false, reason: 'dados-invalidos' })
  })
})

describe('leitura do banco', () => {
  it('uma leitura de cada por pedido (sem uma consulta por item)', async () => {
    const cart = serializeCart(addExtraItem(addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart, 'agua-mineral-500-ml', {}, 'a1').cart)
    const { deps, calls } = fakeDeps()
    expect(await handleOrder(order(cart, 300), deps)).toMatchObject({ ok: true })
    expect(calls).toMatchObject({ changes: 1, catalog: 1 })
  })

  it('cardápio fora do ar: o erro sobe (a função responde 500) e nada é gravado', async () => {
    const { deps, orders, calls } = fakeDeps({ failCatalog: true })
    await expect(handleOrder(order(serializeCart(addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart), 100), deps)).rejects.toThrow('503')
    expect([orders.length, calls.number]).toEqual([0, 0])
  })

  it('cardápio fora do formato: o erro sobe, sem usar o cardápio do código', async () => {
    const { deps, orders } = fakeDeps({ catalog: { products: 'quebrado' } })
    await expect(handleOrder(order(serializeCart(addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart), 100), deps)).rejects.toThrow(/Cardápio do banco/)
    expect(orders).toHaveLength(0)
  })

  it('o preço que o cliente manda não vale: o servidor cobra o do banco', async () => {
    const { deps, orders } = fakeDeps({ catalog: catalogWith(editProduct('jujuba', { priceCents: 999 })) })
    expect(await handleOrder(order(serializeCart(addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart), 100), deps)).toMatchObject({ ok: false, reason: 'total-mudou', totalCents: 999 })
    expect(orders).toHaveLength(0)
  })
})
