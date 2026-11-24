import { afterEach, describe, expect, it } from 'vitest'
import { baseCatalogRecords } from './baseRecords.ts'
import { setCatalogRecords } from './catalogState.ts'
import { PRODUCTS, type ProductSlug } from './menu.ts'
import type { CatalogRecords, GroupRecord } from './records.ts'
import {
  EMPTY_SELECTION,
  type Selection,
  addBlocker,
  addTopping,
  applyComplete,
  chooseSize,
  completeToppings,
  missingChoiceText,
  missingChoices,
  priceOf,
} from './selection.ts'

const base = baseCatalogRecords()

/** O cardápio do banco com os grupos mudados (e o produto novo "acai-teste", se pedido). */
function withGroups(patch: (group: GroupRecord) => GroupRecord, extra: Partial<CatalogRecords> = {}) {
  setCatalogRecords({ ...base, groups: base.groups.map(patch), ...extra })
}
const product = (slug: string) => PRODUCTS[slug as ProductSlug]
const add = (slug: string, selection: Selection, ...ids: string[]) => ids.reduce((current, id) => addTopping(product(slug), current, id), selection)
const sized = (slug: string, sizeId: string) => chooseSize(product(slug), EMPTY_SELECTION, sizeId).selection

afterEach(() => setCatalogRecords(null))

describe('regras de grupo vindas do banco', () => {
  it('sem mudança, o cardápio do banco cobra igual ao do código', () => {
    setCatalogRecords(base)
    const selection = add('acai-oca', sized('acai-oca', 'pote-200'), 'granola', 'kiwi', 'creme-de-ninho', 'kit-kat', 'kit-kat')
    expect(priceOf(product('acai-oca'), selection)?.totalCents).toBe(1000 + 300 + 400)
  })

  it('grupo com grátis e preço extra cobra cada unidade além das grátis', () => {
    withGroups((group) => (group.id === 'fruit' ? { ...group, freeCount: 1, extraPriceCents: 200 } : group))
    const one = add('acai-oca', sized('acai-oca', 'pote-200'), 'kiwi')
    expect(priceOf(product('acai-oca'), one)?.totalCents).toBe(1000)
    const three = add('acai-oca', one, 'morango', 'banana')
    const price = priceOf(product('acai-oca'), three)!
    expect(price.totalCents).toBe(1000 + 2 * 200)
    expect(price.paidLines.at(-1)).toMatchObject({ toppingId: 'grupo:fruit', quantity: 2, unitCents: 200, totalCents: 400 })
  })

  it('preço extra soma com o preço do complemento', () => {
    withGroups((group) => (group.id === 'paid' ? { ...group, freeCount: 0, extraPriceCents: 50 } : group))
    const selection = add('acai-oca', sized('acai-oca', 'pote-200'), 'cereja')
    expect(priceOf(product('acai-oca'), selection)?.totalCents).toBe(1000 + 300 + 50)
  })

  it('máximo do grupo bloqueia o próximo', () => {
    withGroups((group) => (group.id === 'paid' ? { ...group, maxSelect: 1 } : group))
    const one = add('acai-oca', sized('acai-oca', 'pote-200'), 'kit-kat')
    expect(addBlocker(product('acai-oca'), one, 'cereja')).toBe('group-limit')
  })

  it('o máximo do produto vale mais que o do grupo (a barca: 2 frutas)', () => {
    withGroups((group) => (group.id === 'fruit' ? { ...group, maxSelect: 3 } : group))
    const barca = add('barca-de-acai', sized('barca-de-acai', 'barca'), 'kiwi', 'morango')
    expect(addBlocker(product('barca-de-acai'), barca, 'banana')).toBe('group-limit')
    const oca = add('acai-oca', sized('acai-oca', 'pote-200'), 'kiwi', 'morango')
    expect(addBlocker(product('acai-oca'), oca, 'banana')).toBeNull()
  })

  it('mínimo do grupo é escolha obrigatória', () => {
    withGroups((group) => (group.id === 'fruit' ? { ...group, minSelect: 2 } : group))
    const selection = add('acai-oca', sized('acai-oca', 'pote-200'), 'kiwi')
    expect(missingChoices(product('acai-oca'), selection)).toEqual(['grupo:fruit'])
    expect(missingChoiceText('grupo:fruit', 'o sabor')).toBe('pelo menos 2 em Frutas')
    expect(missingChoices(product('acai-oca'), add('acai-oca', selection, 'banana'))).toEqual([])
  })

  it('grupo esgotado desliga todos os complementos dele (e sai do Completo)', () => {
    withGroups((group) => (group.id === 'fruit' ? { ...group, available: false } : group))
    expect(addBlocker(product('acai-tradicional'), sized('acai-tradicional', 'pote-200'), 'kiwi')).toBe('unavailable')
    expect(completeToppings(product('acai-tradicional')).some((topping) => topping.group === 'fruit')).toBe(false)
  })

  it('o Completo segue o grupo marcado no banco e o complemento fora dele', () => {
    withGroups((group) => (group.id === 'fruit' ? { ...group, inCompleto: false } : group), {
      options: base.options.map((option) => (option.id === 'granola' ? { ...option, noCompleto: true } : option)),
    })
    const ids = completeToppings(product('acai-tradicional')).map((topping) => topping.id)
    expect(ids).not.toContain('kiwi')
    expect(ids).not.toContain('granola')
    expect(ids).not.toContain('leite-condensado')
    expect(ids).toContain('pacoca')
    const complete = applyComplete(product('acai-tradicional'), sized('acai-tradicional', 'pote-200'))
    expect(priceOf(product('acai-tradicional'), complete)?.totalCents).toBe(700)
  })

  it('produto montável novo, criado no banco, funciona no personalizador', () => {
    setCatalogRecords({
      ...base,
      products: [
        ...base.products,
        { ...base.products.find((record) => record.id === 'pote-de-acai-1-litro')!, id: 'acai-teste', name: 'Açaí Teste', position: 99 },
      ],
      variants: [...base.variants, { productId: 'acai-teste', id: 'unico', name: 'Único', container: 'copo', priceCents: 1500, freeCount: 1, available: true, position: 0 }],
      productGroups: [...base.productGroups, { productId: 'acai-teste', groupId: 'dry', position: 0, maxSelect: null }],
    })
    const selection = add('acai-teste', sized('acai-teste', 'unico'), 'granola')
    expect(priceOf(product('acai-teste'), selection)?.totalCents).toBe(1500)
    expect(addBlocker(product('acai-teste'), selection, 'pacoca')).toBe('free-limit')
    expect(addBlocker(product('acai-teste'), selection, 'kiwi')).toBe('not-in-product')
  })
})
