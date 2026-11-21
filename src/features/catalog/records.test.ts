import { describe, expect, it } from 'vitest'
import { formatBRL } from '../../utils/money.ts'
import { BASE_OFFER_RECORDS, offerText } from '../offers/baseOffers.ts'
import { featuredOffers } from '../offers/offerNotifications.ts'
import { VITRINE_TITLE, baseCatalogRecords, slugOf, uniqueIds } from './baseRecords.ts'
import { BASE_CATEGORIES } from './categories.ts'
import { BASE_MONTE_TITLE } from './catalogNav.ts'
import { BASE_DRAWERS, BASE_EXTRA_ITEMS } from './extras.ts'
import { BASE_PRODUCTS, BASE_TOPPING_GROUPS, BASE_TOPPINGS } from './menu.ts'
import { type CatalogRecords, ID_PATTERN, LIMITS, RECORD_TABLES, parseCatalogRecords, toRow } from './records.ts'
import { offerState, recordsToCatalog } from './recordsAdapter.ts'

const NOW = Date.parse('2026-11-21T15:00:00Z')
const base = baseCatalogRecords()

/** Os registros como o banco devolve (snake_case), para passar pela leitura. */
const asDatabase = (records: CatalogRecords) => ({
  revision: records.revision,
  categories: records.categories.map(toRow),
  products: records.products.map(toRow),
  variants: records.variants.map(toRow),
  choices: records.choices.map(toRow),
  choice_options: records.choiceOptions.map(toRow),
  groups: records.groups.map(toRow),
  options: records.options.map(toRow),
  product_groups: records.productGroups.map(toRow),
  offers: records.offers.map(toRow),
})

const edit = (patch: Partial<CatalogRecords>): CatalogRecords => ({ ...base, ...patch })

describe('cardápio do código em registros e de volta', () => {
  const data = recordsToCatalog(base, { now: NOW })

  it('devolve exatamente os itens das seções', () => {
    expect(data.items).toEqual(BASE_EXTRA_ITEMS)
  })
  it('devolve exatamente os complementos, na ordem', () => {
    expect(data.toppings).toEqual(BASE_TOPPINGS)
  })
  it('devolve exatamente os produtos do personalizador', () => {
    expect(data.products).toEqual(BASE_PRODUCTS)
  })
  it('devolve exatamente as categorias da vitrine e as seções', () => {
    expect(data.categories).toEqual(BASE_CATEGORIES)
    expect(data.drawers).toEqual(BASE_DRAWERS)
  })
  it('devolve os grupos de complementos e o título da vitrine', () => {
    expect(data.groups).toEqual(BASE_TOPPING_GROUPS)
    expect(VITRINE_TITLE).toBe(BASE_MONTE_TITLE)
    expect(data.groupTitles).toEqual({ monte: BASE_MONTE_TITLE })
  })
  it('passa pela leitura do banco sem perder nada', () => {
    expect(parseCatalogRecords(JSON.parse(JSON.stringify(asDatabase(base))))).toEqual(base)
  })
})

describe('registros da semente', () => {
  it('têm ids válidos e únicos em cada tabela', () => {
    for (const [field] of RECORD_TABLES) {
      const keys = (base[field] as readonly Record<string, unknown>[]).map((record) =>
        [record.productId, record.choiceId, record.groupId, record.id].filter((part) => part !== undefined).join('/'),
      )
      expect(new Set(keys).size, field).toBe(keys.length)
      for (const record of base[field] as readonly { id?: string }[]) {
        if (record.id === undefined) continue
        expect(record.id, field).toMatch(ID_PATTERN)
        expect(record.id.length, field).toBeLessThanOrEqual(LIMITS.idLength)
      }
    }
  })
  it('cabem nos limites do banco', () => {
    for (const product of base.products) {
      expect(product.name.length).toBeLessThanOrEqual(LIMITS.nameLength)
      expect(product.description.length).toBeLessThanOrEqual(LIMITS.textLength)
      expect(product.priceCents).toBeLessThanOrEqual(LIMITS.maxPriceCents)
      expect(product.keywords.length).toBeLessThanOrEqual(LIMITS.keywords)
    }
    for (const option of base.choiceOptions) expect(option.name.length).toBeLessThanOrEqual(LIMITS.nameLength)
  })
  it('ligam cada filho a um pai que existe', () => {
    const products = new Set(base.products.map((product) => product.id))
    const categories = new Set(base.categories.map((category) => category.id))
    const groups = new Set(base.groups.map((group) => group.id))
    for (const product of base.products) expect(categories.has(product.categoryId)).toBe(true)
    for (const child of [...base.variants, ...base.choices, ...base.productGroups, ...base.offers]) expect(products.has(child.productId)).toBe(true)
    for (const link of base.productGroups) expect(groups.has(link.groupId)).toBe(true)
    for (const option of base.options) expect(groups.has(option.groupId)).toBe(true)
  })
  it('separam os três tipos de produto', () => {
    const kinds = Object.fromEntries(base.products.map((product) => [product.id, product.kind]))
    expect(kinds['acai-oca']).toBe('montavel')
    expect(kinds['barca-de-acai']).toBe('montavel')
    expect(kinds['kit-completo-casquinha']).toBe('variacoes')
    expect(kinds['acai-do-oca-pronto']).toBe('variacoes')
    expect(kinds['pote-de-acai-2-litros']).toBe('direto')
    expect(base.variants.filter((variant) => variant.productId === 'acai-do-oca-pronto').map((variant) => variant.id)).toEqual(['500-ml', '1-litro'])
  })
  it('as ofertas da semente dizem o mesmo que os avisos de antes', () => {
    const data = recordsToCatalog(base, { now: NOW })
    const texts = data.offers.map((offer) => {
      const item = data.items.find((candidate) => candidate.id === offer.productId)
      return offerText(offer.subtitle, {
        price: formatBRL(offer.priceCents),
        oldPrice: item?.originalPriceCents ? formatBRL(item.originalPriceCents) : null,
      })
    })
    expect(data.offers.map((offer) => offer.id)).toEqual(featuredOffers().map((offer) => offer.id))
    expect(texts).toEqual(featuredOffers().map((offer) => offer.subtitle))
    expect(BASE_OFFER_RECORDS.map((offer) => offer.title)).toEqual(featuredOffers().map((offer) => offer.title))
  })
  it('gera ids pelo nome, sem repetir', () => {
    expect(slugOf('Trio (Chocolate, flocos e creme)')).toBe('trio-chocolate-flocos-e-creme')
    expect(uniqueIds(['Morango', 'morango', 'Açaí'])).toEqual(['morango', 'morango-2', 'acai'])
  })
})

describe('o que fica de fora', () => {
  it('produto oculto só aparece para o vendedor', () => {
    const records = edit({ products: base.products.map((product) => (product.id === 'jujuba' ? { ...product, visible: false } : product)) })
    expect(recordsToCatalog(records, { now: NOW }).items.some((item) => item.id === 'jujuba')).toBe(false)
    expect(recordsToCatalog(records, { now: NOW, includeHidden: true }).items.some((item) => item.id === 'jujuba')).toBe(true)
  })
  it('arquivado não aparece nem para o vendedor', () => {
    const records = edit({ products: base.products.map((product) => (product.id === 'jujuba' ? { ...product, archivedAt: '2026-11-21T10:00:00Z' } : product)) })
    expect(recordsToCatalog(records, { now: NOW, includeHidden: true }).items.some((item) => item.id === 'jujuba')).toBe(false)
  })
  it('categoria oculta leva os produtos junto', () => {
    const records = edit({ categories: base.categories.map((category) => (category.id === 'bebidas' ? { ...category, visible: false } : category)) })
    const data = recordsToCatalog(records, { now: NOW })
    expect(data.drawers.some((drawer) => drawer.id === 'bebidas')).toBe(false)
    expect(data.items.some((item) => item.drawer === 'bebidas')).toBe(false)
  })
  it('complemento arquivado sai; esgotado fica desligado', () => {
    const records = edit({
      options: base.options.map((option) =>
        option.id === 'kiwi' ? { ...option, archivedAt: '2026-11-21T10:00:00Z' } : option.id === 'banana' ? { ...option, available: false } : option,
      ),
    })
    const data = recordsToCatalog(records, { now: NOW })
    expect(data.toppings.some((topping) => topping.id === 'kiwi')).toBe(false)
    expect(data.toppings.find((topping) => topping.id === 'banana')?.available).toBe(false)
  })
  it('respeita a ordem das categorias e dos produtos', () => {
    const records = edit({
      categories: base.categories.map((category) => (category.id === 'bebidas' ? { ...category, position: 0 } : category)),
    })
    const data = recordsToCatalog(records, { now: NOW })
    expect(data.drawers[0].id).toBe('bebidas')
    expect(data.items[0].drawer).toBe('bebidas')
  })
})

describe('ofertas', () => {
  const offer = (patch: Partial<CatalogRecords['offers'][number]>) => ({ ...BASE_OFFER_RECORDS[0], ...patch })

  it('diz a situação pela hora', () => {
    expect(offerState(offer({}), NOW)).toBe('ativa')
    expect(offerState(offer({ status: 'pausada' }), NOW)).toBe('pausada')
    expect(offerState(offer({ startsAt: '2026-11-22T00:00:00Z' }), NOW)).toBe('agendada')
    expect(offerState(offer({ endsAt: '2026-11-21T14:59:59Z' }), NOW)).toBe('encerrada')
    expect(offerState(offer({ status: 'arquivada' }), NOW)).toBe('arquivada')
  })
  it('preço promocional troca o preço e risca o de antes', () => {
    const records = edit({ offers: [offer({ id: 'agua', productId: 'agua-mineral-500-ml', promoPriceCents: 150 })] })
    const regular = base.products.find((product) => product.id === 'agua-mineral-500-ml')!.priceCents
    const item = recordsToCatalog(records, { now: NOW }).items.find((candidate) => candidate.id === 'agua-mineral-500-ml')!
    expect(item.priceCents).toBe(150)
    expect(item.originalPriceCents).toBe(regular)
  })
  it('oferta fora das datas ou pausada não muda o preço', () => {
    for (const patch of [{ status: 'pausada' as const }, { endsAt: '2026-11-20T00:00:00Z' }, { startsAt: '2026-12-01T00:00:00Z' }]) {
      const records = edit({ offers: [offer({ id: 'agua', productId: 'agua-mineral-500-ml', promoPriceCents: 150, ...patch })] })
      const item = recordsToCatalog(records, { now: NOW }).items.find((candidate) => candidate.id === 'agua-mineral-500-ml')!
      expect(item.priceCents).toBeGreaterThan(150)
    }
  })
  it('preço "promocional" maior que o normal não vale', () => {
    const records = edit({ offers: [offer({ id: 'agua', productId: 'agua-mineral-500-ml', promoPriceCents: 99_999 })] })
    const item = recordsToCatalog(records, { now: NOW }).items.find((candidate) => candidate.id === 'agua-mineral-500-ml')!
    expect(item.priceCents).toBe(base.products.find((product) => product.id === 'agua-mineral-500-ml')!.priceCents)
  })
  it('oferta de um tamanho muda só aquele tamanho (montável e com variações)', () => {
    const records = edit({
      offers: [
        offer({ id: 'oca-200', productId: 'acai-oca', variantId: 'pote-200', promoPriceCents: 900 }),
        offer({ id: 'pronto-1l', productId: 'acai-do-oca-pronto', variantId: '1-litro', promoPriceCents: 3000 }),
      ],
    })
    const data = recordsToCatalog(records, { now: NOW })
    const sizes = data.products['acai-oca'].sizes
    expect(sizes.find((size) => size.id === 'pote-200')?.priceCents).toBe(900)
    expect(sizes.find((size) => size.id === 'pote-530')?.priceCents).toBe(2000)
    const pronto = data.items.find((item) => item.id === 'acai-do-oca-pronto')!
    expect(pronto.action.type === 'flavor_modal' && pronto.action.choices[0].prices).toEqual({ '500 ml': 1700, '1 Litro': 3000 })
  })
  it('com duas ofertas no mesmo produto, vale a de menor posição', () => {
    const records = edit({
      offers: [
        offer({ id: 'b', productId: 'agua-mineral-500-ml', promoPriceCents: 100, position: 2 }),
        offer({ id: 'a', productId: 'agua-mineral-500-ml', promoPriceCents: 200, position: 1 }),
      ],
    })
    expect(recordsToCatalog(records, { now: NOW }).items.find((item) => item.id === 'agua-mineral-500-ml')!.priceCents).toBe(200)
  })
  it('oferta de produto oculto ou de tamanho que não existe não aparece', () => {
    const records = edit({
      products: base.products.map((product) => (product.id === 'jujuba' ? { ...product, visible: false } : product)),
      offers: [offer({ id: 'x', productId: 'jujuba' }), offer({ id: 'y', productId: 'acai-oca', variantId: 'nao-existe' })],
    })
    expect(recordsToCatalog(records, { now: NOW }).offers).toEqual([])
  })
})

describe('leitura do banco', () => {
  it('recusa dado fora do formato', () => {
    const raw = asDatabase(base)
    expect(() => parseCatalogRecords(null)).toThrow(/Cardápio do banco/)
    expect(() => parseCatalogRecords({ ...raw, products: [{ ...raw.products[0], price_cents: -1 }] })).toThrow(/produto.price_cents/)
    expect(() => parseCatalogRecords({ ...raw, products: [{ ...raw.products[0], kind: 'outro' }] })).toThrow(/produto.kind/)
    expect(() => parseCatalogRecords({ ...raw, groups: [{ ...raw.groups[0], rule: 'x' }] })).toThrow(/grupo.rule/)
    expect(() => parseCatalogRecords({ ...raw, variants: 'x' })).toThrow(/variants/)
    expect(() => parseCatalogRecords({ ...raw, products: [{ ...raw.products[0], price_cents: 1.5 }] })).toThrow(/price_cents/)
  })
})
