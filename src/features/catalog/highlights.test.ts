import { afterEach, describe, expect, it } from 'vitest'
import { BASE_CATEGORIES, setCategories } from './categories.ts'
import { FLAGSHIP_SLUGS, highlightItems, highlightProducts } from './highlights.ts'
import { searchMenu } from './search.ts'

afterEach(() => setCategories(BASE_CATEGORIES))

describe('faixa "Mais pedidos": carros-chefes na frente (2026-11-23)', () => {
  it('sem busca: os 4 carros-chefes, na ordem da loja', () => {
    expect(highlightProducts(searchMenu('')).map((category) => category.slug)).toEqual([...FLAGSHIP_SLUGS])
    expect(FLAGSHIP_SLUGS).toEqual(['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'])
  })

  it('os itens que já estavam na faixa continuam (os 5, depois dos carros-chefes)', () => {
    expect(highlightItems(searchMenu('')).map((item) => item.id)).toEqual([
      'pote-de-acai-1-litro',
      'barca-de-acai',
      'kit-completo-casquinha',
      'combo-1-litro',
      'pote-de-acai-2-litros',
    ])
  })

  it('na busca, só os carros-chefes encontrados', () => {
    expect(highlightProducts(searchMenu('batido')).map((category) => category.slug)).toEqual(['acai-batido'])
    expect(highlightProducts(searchMenu('milkshake')).map((category) => category.slug)).toEqual(['milk-shake'])
    expect(highlightProducts(searchMenu('refri'))).toEqual([])
  })

  it('um carro-chefe que o vendedor tirou do cardápio não aparece, sem quebrar os outros', () => {
    setCategories(BASE_CATEGORIES.filter((category) => category.slug !== 'acai-tradicional'))
    expect(highlightProducts(searchMenu('')).map((category) => category.slug)).toEqual(['acai-oca', 'acai-batido', 'milk-shake'])
  })
})
