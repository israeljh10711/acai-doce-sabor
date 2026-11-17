import { afterEach, describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, addItem, parseCart, serializeCart } from '../cart/cart.ts'
import { getOffer } from '../offers/offerNotifications.ts'
import { CATEGORIES } from './categories.ts'
import { NO_CHANGES } from './catalogChanges.ts'
import { navEntries } from './catalogNav.ts'
import { catalogVersion, getCatalogChanges, setCatalogChanges, setPhotoUrls, subscribeCatalog } from './catalogStore.ts'
import { EXTRA_ITEMS, getExtraItem } from './extras.ts'
import { highlightItems } from './highlights.ts'
import { PRODUCTS, getTopping } from './menu.ts'
import { searchMenu } from './search.ts'
import { EMPTY_SELECTION, addBlocker, applyComplete, chooseSize, completeToppings } from './selection.ts'

afterEach(() => {
  setPhotoUrls({})
  setCatalogChanges(NO_CHANGES)
})

describe('as mudanças do vendedor chegam a todo o site (catalogStore)', () => {
  it('troca os dados que todo o site lê e avisa quem está ouvindo', () => {
    let calls = 0
    const stop = subscribeCatalog(() => calls++)
    const before = catalogVersion()
    setCatalogChanges({ ...NO_CHANGES, items: { sundae: { priceCents: 950 } } })
    expect(getExtraItem('sundae')?.priceCents).toBe(950)
    expect(EXTRA_ITEMS.find((item) => item.id === 'sundae')?.priceCents).toBe(950)
    expect(getCatalogChanges().items.sundae).toEqual({ priceCents: 950 })
    expect(catalogVersion()).toBe(before + 1)
    expect(calls).toBe(1)
    stop()
  })

  it('item novo aparece na busca, na contagem da seção e entra no carrinho', () => {
    setCatalogChanges({
      ...NO_CHANGES,
      items: {
        'novo-picole-trufado': { created: true, drawer: 'picoles-e-sorvetes', name: 'Picolé trufado', priceCents: 300, description: 'Picolé trufado sabor chocolate' },
      },
    })
    expect([...(searchMenu('trufado').drawers.get('picoles-e-sorvetes') ?? [])].map((item) => item.id)).toContain('novo-picole-trufado')
    expect(navEntries(searchMenu('')).find((entry) => entry.id === 'picoles-e-sorvetes')?.count).toBe(13)
    const { cart } = addExtraItem(EMPTY_CART, 'novo-picole-trufado', {})
    expect(cart.items).toHaveLength(1)
  })

  it('excluído some de tudo e sai do carrinho; esgotado não entra e sai do carrinho', () => {
    const saved = serializeCart(addExtraItem(addExtraItem(EMPTY_CART, 'agua-mineral-500-ml', {}).cart, 'jujuba', {}).cart)
    setCatalogChanges({ ...NO_CHANGES, items: { 'agua-mineral-500-ml': { deleted: true }, jujuba: { available: false } } })
    expect(getExtraItem('agua-mineral-500-ml')).toBeUndefined()
    expect(searchMenu('agua').total).toBe(0)
    expect(addExtraItem(EMPTY_CART, 'jujuba', {}).cart.items).toHaveLength(0)
    expect(parseCart(saved).items).toEqual([])
    // Esgotado continua aparecendo na busca (com o aviso na tela).
    expect(searchMenu('jujuba').total).toBe(1)
  })

  it('destaque excluído sai da faixa; preço novo chega à faixa e à oferta', () => {
    setCatalogChanges({ ...NO_CHANGES, items: { 'combo-1-litro': { deleted: true }, 'barca-de-acai': { priceCents: 3200 } } })
    expect(highlightItems(searchMenu('')).map((item) => item.id)).not.toContain('combo-1-litro')
    expect(highlightItems(searchMenu('')).find((item) => item.id === 'barca-de-acai')?.priceCents).toBe(3200)
    expect(PRODUCTS['barca-de-acai'].sizes[0].priceCents).toBe(3200)
    expect(getOffer('barca-de-acai')?.priceText).toBe('R$ 32,00')
  })

  it('preço do tamanho do Oca chega ao carrinho; nome novo chega às categorias e à busca', () => {
    setCatalogChanges({ ...NO_CHANGES, products: { 'acai-oca': { name: 'Oca Premium', sizePrices: { 'pote-200': 1100 } } } })
    expect(CATEGORIES[0].name).toBe('Oca Premium')
    expect(searchMenu('premium').main).toEqual(['acai-oca'])
    const { item } = addItem(EMPTY_CART, 'acai-oca', chooseSize(PRODUCTS['acai-oca'], EMPTY_SELECTION, 'pote-200').selection)
    expect(item && item.kind === 'product' ? PRODUCTS['acai-oca'].sizes.find((size) => size.id === item.selection.sizeId)?.priceCents : 0).toBe(1100)
  })

  it('complemento novo entra no Completo; esgotado fica de fora e não pode ser escolhido', () => {
    setCatalogChanges({
      ...NO_CHANGES,
      toppings: { 'novo-ovomaltine': { created: true, group: 'dry', name: 'Ovomaltine', priceCents: 0 }, 'farinha-lactea': { available: false } },
    })
    const oca = PRODUCTS['acai-oca']
    const names = completeToppings(oca).map((topping) => topping.name)
    expect(names).toContain('Ovomaltine')
    expect(names).not.toContain('Farinha láctea')
    expect(Object.keys(applyComplete(oca, EMPTY_SELECTION).toppings)).toHaveLength(24)
    expect(addBlocker(oca, EMPTY_SELECTION, 'farinha-lactea')).toBe('unavailable')
    expect(getTopping('novo-ovomaltine')?.name).toBe('Ovomaltine')
  })

  it('foto guardada no aparelho (idb:) vira endereço quando carrega; antes disso, fica a foto do código', () => {
    setCatalogChanges({ ...NO_CHANGES, items: { sundae: { image: 'idb:foto-1' } } })
    expect(getExtraItem('sundae')?.image).toBe('images/catalogo/sundae.jpg')
    setPhotoUrls({ 'idb:foto-1': 'blob:http://localhost/abc' })
    expect(getExtraItem('sundae')?.image).toBe('blob:http://localhost/abc')
  })
})
