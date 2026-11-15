import { describe, expect, it } from 'vitest'
import {
  DRAWERS,
  EXTRA_ITEMS,
  choiceGroupsOf,
  choiceRows,
  choiceValueText,
  cleanOtherText,
  extraForProduct,
  getExtraItem,
  itemsOf,
  normalizeChoices,
} from './extras.ts'
import { PRODUCTS } from './menu.ts'

const byName = (name: string) => {
  const item = EXTRA_ITEMS.find((candidate) => candidate.name === name)
  if (!item) throw new Error(`Item não encontrado: ${name}`)
  return item
}

/** Os 43 itens do pedido de 2026-11-15, gaveta a gaveta: [nome, preço, preço riscado?]. */
const PEDIDO: Record<string, [name: string, cents: number, original?: number][]> = {
  'combos-e-ofertas': [
    ['Kit Completo Casquinha', 4100],
    ['Kit Completo', 4100],
    ['Pote de Açaí 1 Litro Montado', 3000, 3300],
    ['Combo 1 Litro', 2400],
    ['Combo de Sorvete', 2000],
  ],
  'barcas-e-potes': [
    ['Barca de Açaí', 3000],
    ['Pote de Açaí 2 Litros (Açaímix)', 3500],
    ['Açaí de 1 Litro (Açaímix)', 2300],
    ['Pote de Sorvete 1,5 Litro', 3000],
    ['Pote de Sorvete 2 Litros (Sabores Especiais)', 2800],
    ['Pote de Sorvete 2 Litros (Tradicional)', 2600],
    ['Pote de Sorvete 1 Litro (Sabores Especiais)', 1800],
    ['Pote de Sorvete 1 Litro (Tradicional)', 1600],
    ['Açaí com Creme Ninho (Pronto)', 1200],
    ['Açaí Mix 150 ml', 500],
  ],
  'picoles-e-sorvetes': [
    ['Copo Diamante Negro', 1200],
    ['Copão 400 ml', 950],
    ['Sundae', 700],
    ['Cascão DUO', 700],
    ['Cobertura Sterbom (Frasco)', 700],
    ['Moreninha', 350],
    ['Picolé Trufado', 300],
    ['Picolé Gourmet', 300],
    ['Garrafinha', 300],
    ['Roscão Mel', 200],
    ['Picolé Comum', 150],
    ['Cremosinho', 150],
  ],
  bebidas: [
    ['Refrigerante 350 ml', 500],
    ['Água Mineral 500 ml', 200],
  ],
  'doces-e-bomboniere': [
    ['Quadradinho de Brownie', 599, 600],
    ["Pippo's", 375],
    ['Trufas', 250, 300],
    ['Trident', 250],
    ['Batom ao Leite', 200],
    ['Mentos', 200],
    ['Halls', 200],
    ['Pipoca Kigarot 75g', 200],
    ['Pipoca Kigarot 45g', 150],
    ['Fini Gelatinas', 150],
    ['Docile Canudinho', 150],
    ['Jujuba', 100],
    ['Nucita', 50],
    ['Chocolate Recheado', 50],
  ],
}

describe('gavetas de "Mais opções do cardápio"', () => {
  it('são 5, na ordem e com os atalhos pedidos; só a primeira começa aberta', () => {
    expect(DRAWERS.map((drawer) => [drawer.title, drawer.shortcut, drawer.defaultOpen])).toEqual([
      ['Combos e Ofertas', 'Combos e Ofertas', true],
      ['Barcas e Potes Família (1L, 1,5L e 2L)', 'Barcas e Potes 1L/2L', false],
      ['Picolés e Sorvetes', 'Picolés e Sorvetes', false],
      ['Bebidas', 'Bebidas', false],
      ['Doces e Bomboniere', 'Doces e Bomboniere', false],
    ])
  })

  it('têm os 43 itens do pedido (5 + 10 + 12 + 2 + 14), com nomes, preços e preços riscados', () => {
    expect(EXTRA_ITEMS).toHaveLength(43)
    for (const drawer of DRAWERS) {
      const items = itemsOf(drawer.id).map((item) => [item.name, item.priceCents, item.originalPriceCents])
      expect(items, drawer.id).toEqual(PEDIDO[drawer.id].map(([name, cents, original]) => [name, cents, original]))
    }
  })

  it('identificadores únicos; preços inteiros em centavos; preço riscado maior que o atual', () => {
    expect(new Set(EXTRA_ITEMS.map((item) => item.id)).size).toBe(EXTRA_ITEMS.length)
    for (const item of EXTRA_ITEMS) {
      expect(Number.isInteger(item.priceCents) && item.priceCents > 0, item.id).toBe(true)
      if (item.originalPriceCents !== undefined) expect(item.originalPriceCents, item.id).toBeGreaterThan(item.priceCents)
      expect(getExtraItem(item.id)).toBe(item)
    }
  })

  it('nenhum item tem foto ainda: todos com image null (o cartão mostra o emblema)', () => {
    expect(EXTRA_ITEMS.filter((item) => item.image !== null)).toEqual([])
  })

  it('o tipo de cada item segue o pedido: direto, escolha de sabor ou personalizador', () => {
    const typeOf = (name: string) => byName(name).action.type
    for (const name of ['Combo de Sorvete', 'Pote de Açaí 2 Litros (Açaímix)', 'Açaí Mix 150 ml', 'Cascão DUO', 'Água Mineral 500 ml', 'Nucita']) {
      expect(typeOf(name), name).toBe('direct_confirm')
    }
    for (const name of ['Kit Completo Casquinha', 'Combo 1 Litro', 'Copão 400 ml', 'Picolé Gourmet', 'Refrigerante 350 ml', 'Halls']) {
      expect(typeOf(name), name).toBe('flavor_modal')
    }
    expect(typeOf('Pote de Açaí 1 Litro Montado')).toBe('customizer')
    expect(typeOf('Barca de Açaí')).toBe('customizer')
    expect(EXTRA_ITEMS.filter((item) => item.action.type === 'customizer')).toHaveLength(2)
  })

  it('os dois itens de personalizador custam o mesmo que o produto deles', () => {
    for (const slug of ['pote-de-acai-1-litro', 'barca-de-acai'] as const) {
      const item = extraForProduct(slug)
      expect(item.priceCents, slug).toBe(PRODUCTS[slug].sizes[0].priceCents)
    }
    expect(byName('Pote de Açaí 1 Litro Montado').badge).toBe('Oferta')
  })

  it('os sabores do pedido, com "Outro sabor" só onde ele pediu', () => {
    const groups = (name: string) =>
      choiceGroupsOf(byName(name)).map((group) => [group.label, group.options.join(', '), Boolean(group.allowOther)])
    expect(groups('Kit Completo Casquinha')).toEqual([
      ['Sabor do sorvete (2 litros)', 'Napolitano, Chocolate, Morango, Flocos, Creme, Sensação', true],
      ['Sabor da cobertura', 'Chocolate, Morango, Caramelo, Leite Condensado, Frutas Vermelhas', false],
    ])
    expect(groups('Kit Completo')).toEqual(groups('Kit Completo Casquinha'))
    expect(groups('Pote de Sorvete 2 Litros (Sabores Especiais)')).toEqual([
      ['Sabor', 'Sensação, Napolitano, Chocolate Trufado, Maracujá', true],
    ])
    expect(groups('Refrigerante 350 ml')).toEqual([
      ['Sabor', 'Coca-Cola, Guaraná Antarctica, Fanta Laranja, Fanta Uva, Sprite', false],
    ])
    expect(groups('Picolé Comum')).toEqual([['Sabor', 'Coco, Chocolate, Morango, Uva, Limão, Maracujá', false]])
    const withOther = EXTRA_ITEMS.filter((item) => choiceGroupsOf(item).some((group) => group.allowOther)).map((item) => item.name)
    expect(withOther).toEqual([
      'Kit Completo Casquinha',
      'Kit Completo',
      'Pote de Sorvete 1,5 Litro',
      'Pote de Sorvete 2 Litros (Sabores Especiais)',
    ])
    for (const item of EXTRA_ITEMS) {
      for (const group of choiceGroupsOf(item)) {
        expect(group.options.length, item.id).toBeGreaterThanOrEqual(2)
        expect(new Set(group.options).size, item.id).toBe(group.options.length)
      }
    }
  })
})

describe('escolhas de um item', () => {
  const gourmet = byName('Picolé Gourmet')
  const kit = byName('Kit Completo Casquinha')

  it('aceita só opções da lista, uma por grupo', () => {
    expect(normalizeChoices(gourmet, { sabor: 'Nutella' })).toEqual({ sabor: 'Nutella' })
    expect(normalizeChoices(gourmet, { sabor: 'Pistache' })).toBeNull()
    expect(normalizeChoices(gourmet, {})).toBeNull()
    expect(normalizeChoices(kit, { sorvete: 'Flocos' })).toBeNull()
    expect(normalizeChoices(kit, { sorvete: 'Flocos', cobertura: 'Caramelo', extra: 'x' })).toEqual({ sorvete: 'Flocos', cobertura: 'Caramelo' })
  })

  it('itens sem escolha ficam vazios; itens de personalizador não entram direto', () => {
    expect(normalizeChoices(byName('Água Mineral 500 ml'), {})).toEqual({})
    expect(normalizeChoices(byName('Barca de Açaí'), {})).toBeNull()
  })

  it('"Outro sabor" só onde é aceito, limpo e com até 40 caracteres', () => {
    expect(normalizeChoices(kit, { sorvete: '  *Ninho*   com   morango_ ', cobertura: 'Chocolate' })).toEqual({
      sorvete: 'Ninho com morango',
      cobertura: 'Chocolate',
    })
    expect(normalizeChoices(kit, { sorvete: 'Flocos', cobertura: 'Pistache' })).toBeNull()
    expect(normalizeChoices(kit, { sorvete: '   ', cobertura: 'Chocolate' })).toBeNull()
    expect(cleanOtherText('a'.repeat(60))).toHaveLength(40)
    expect(cleanOtherText('linha\nnova\ttab')).toBe('linha nova tab')
  })

  it('"Outro sabor" igual a uma opção vira a própria opção', () => {
    expect(normalizeChoices(kit, { sorvete: 'sensacao', cobertura: 'Chocolate' })).toEqual({ sorvete: 'Sensação', cobertura: 'Chocolate' })
  })

  it('mostra o "outro sabor" marcado como tal', () => {
    const [sorvete] = choiceGroupsOf(kit)
    expect(choiceValueText(sorvete, 'Flocos')).toBe('Flocos')
    expect(choiceValueText(sorvete, 'ninho com morango')).toBe('Ninho com morango (outro sabor)')
    expect(choiceRows(kit, { sorvete: 'Flocos', cobertura: 'Caramelo' })).toEqual([
      { label: 'Sabor do sorvete (2 litros)', value: 'Flocos' },
      { label: 'Sabor da cobertura', value: 'Caramelo' },
    ])
  })
})
