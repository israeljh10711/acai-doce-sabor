import { describe, expect, it } from 'vitest'
import { legacyAnchors, mainAnchor, navAnchors, navEntries, offersAnchor } from './catalogNav.ts'
import { HIGHLIGHT_IDS, highlightItems } from './highlights.ts'
import { searchMenu } from './search.ts'

describe('entradas da navegação do cardápio (barra lateral, menu do celular e botões da barra fixa)', () => {
  it('são as 9 seções, em 2 grupos, com as âncoras, os nomes, as dicas e as contagens do catálogo', () => {
    const all = navEntries(searchMenu(''))
    expect(all.map((entry) => entry.anchor)).toEqual(navAnchors())
    expect(navAnchors()).toEqual([
      'secao-acai-oca',
      'secao-acai-tradicional',
      'secao-acai-batido',
      'secao-milkshake',
      'secao-combos',
      'secao-barcas-potes',
      'secao-picoles-sorvetes',
      'secao-bebidas',
      'secao-doces-bomboniere',
    ])
    expect(all.map((entry) => [entry.group, entry.label, entry.shortLabel, entry.hint, entry.count, entry.available])).toEqual([
      ['monte', 'Açaí Oca', 'Açaí Oca', 'Especialidade da casa', null, true],
      ['monte', 'Açaí Tradicional', 'Tradicional', 'A partir de R$ 6,00', null, true],
      ['monte', 'Açaí Batido', 'Batido', '300 ml e 500 ml', null, true],
      ['monte', 'Milk-shake', 'Milk-shake', '13 sabores', null, true],
      ['catalogo', 'Combos e Ofertas', 'Combos', null, 5, true],
      ['catalogo', 'Barcas e Potes Família', 'Barcas e Potes', null, 11, true],
      ['catalogo', 'Picolés e Sorvetes', 'Picolés e Sorvetes', null, 12, true],
      ['catalogo', 'Bebidas', 'Bebidas', null, 2, true],
      ['catalogo', 'Doces e Bomboniere', 'Doces', null, 14, true],
    ])
    expect(all.map((entry) => entry.icon)).toEqual([
      'crown',
      'iceCreamBowl',
      'cupSoda',
      'iceCreamCone',
      'gift',
      'sailboat',
      'popsicle',
      'glassWater',
      'candy',
    ])
    expect(offersAnchor()).toBe('secao-combos')
    expect(mainAnchor('milk-shake')).toBe('secao-milkshake')
  })

  it('na busca, as contagens são as do resultado e as seções sem resultado ficam indisponíveis', () => {
    const refri = navEntries(searchMenu('refri'))
    expect(refri.map((entry) => [entry.count, entry.available])).toEqual([
      [null, false],
      [null, false],
      [null, false],
      [null, false],
      [0, false],
      [0, false],
      [0, false],
      [1, true],
      [0, false],
    ])
    expect(navEntries(searchMenu('batida')).filter((entry) => entry.available).map((entry) => entry.id)).toEqual(['acai-batido'])
    expect(navEntries(searchMenu('xyz123')).some((entry) => entry.available)).toBe(false)
  })

  it('os endereços antigos (#acai-oca, #bebidas...) levam às seções novas', () => {
    expect(legacyAnchors()).toEqual({
      'acai-oca': 'secao-acai-oca',
      'acai-tradicional': 'secao-acai-tradicional',
      'acai-batido': 'secao-acai-batido',
      'milk-shake': 'secao-milkshake',
      'combos-e-ofertas': 'secao-combos',
      'barcas-e-potes': 'secao-barcas-potes',
      'picoles-e-sorvetes': 'secao-picoles-sorvetes',
      bebidas: 'secao-bebidas',
      'doces-e-bomboniere': 'secao-doces-bomboniere',
    })
  })
})

describe('faixa "Mais pedidos & ofertas do dia"', () => {
  it('tem os 5 carros-chefes do pedido, com os preços do catálogo', () => {
    expect(HIGHLIGHT_IDS).toEqual(['pote-de-acai-1-litro', 'barca-de-acai', 'kit-completo-casquinha', 'combo-1-litro', 'pote-de-acai-2-litros'])
    expect(highlightItems(searchMenu('')).map((item) => [item.id, item.priceCents, item.originalPriceCents ?? null])).toEqual([
      ['pote-de-acai-1-litro', 3000, 3300],
      ['barca-de-acai', 3000, null],
      ['kit-completo-casquinha', 4100, null],
      ['combo-1-litro', 2399, null],
      ['pote-de-acai-2-litros', 3500, null],
    ])
  })

  it('na busca, mostra só os destaques encontrados (e nenhum quando nada bate)', () => {
    expect(highlightItems(searchMenu('barca')).map((item) => item.id)).toEqual(['barca-de-acai'])
    expect(highlightItems(searchMenu('refri'))).toEqual([])
  })
})

describe('busca: sinônimos citados no pedido de 2026-11-16', () => {
  it('batida, dindin, refri, agua, casquinha e barca acham os produtos', () => {
    expect(['batida', 'dindin', 'refri', 'agua', 'casquinha', 'barca'].map((query) => searchMenu(query).total)).toEqual([1, 2, 1, 1, 6, 1])
  })
})

describe('produto novo da vitrine (cardápio dinâmico)', () => {
  it('ganha âncora secao-<id> e as âncoras ficam as mesmas enquanto o cardápio não muda', () => {
    expect(mainAnchor('acai-zero')).toBe('secao-acai-zero')
    expect(navAnchors()).toBe(navAnchors())
    expect(legacyAnchors()).toBe(legacyAnchors())
  })
})
