import { describe, expect, it } from 'vitest'
import {
  DRAWERS,
  EXTRA_ITEMS,
  choiceGroupsOf,
  choiceRows,
  choiceValueText,
  cleanOtherText,
  drawerById,
  extraForProduct,
  flavorCount,
  extraPhoto,
  extraPriceCents,
  getExtraItem,
  hasPricedChoices,
  itemsOf,
  normalizeChoices,
} from './extras.ts'
import { PRODUCTS } from './menu.ts'

const byName = (name: string) => {
  const item = EXTRA_ITEMS.find((candidate) => candidate.name === name)
  if (!item) throw new Error(`Item não encontrado: ${name}`)
  return item
}

/**
 * Os itens de cada gaveta: [nome, preço, preço riscado?]. Os de 2026-11-15, com as gavetas 1 e 2
 * do pedido de 2026-11-16 (catálogo do WhatsApp): nomes, Combo 1 Litro a R$ 23,99 e o Açaí do Oca.
 */
const PEDIDO: Record<string, [name: string, cents: number, original?: number][]> = {
  'combos-e-ofertas': [
    ['Kit Completo Casquinha DUO', 4100],
    ['Kit Completo', 4100],
    ['Pote de Açaí 1 Litro Montado', 3000, 3300],
    ['Combo 1 Litro', 2399],
    ['Combo de Sorvete', 2000],
  ],
  'barcas-e-potes': [
    ['Barca de Açaí', 3000],
    ['Pote de Açaí 2 Litros (Açaímix Brazil)', 3500],
    ['Açaí de 1 Litro (Açaímix Brazil)', 2300],
    ['Açaí do Oca (Pote Pronto)', 1700],
    ['Pote de Sorvete 1,5 Litro (Qbombom)', 3000],
    ['Pote de Sorvete 2 Litros (Qbombom Premium)', 2800],
    ['Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)', 2600],
    ['Pote de Sorvete 1 Litro (Qbombom Premium)', 1800],
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

describe('seções do catálogo (as antigas gavetas de "Mais opções do cardápio")', () => {
  it('são 5, na ordem, com o título, o nome na navegação, o nome curto, a âncora e o ícone (pedido de 2026-11-16)', () => {
    expect(DRAWERS.map((drawer) => [drawer.id, drawer.navLabel, drawer.pillLabel, drawer.anchor, drawer.icon])).toEqual([
      ['combos-e-ofertas', 'Combos e Ofertas', 'Combos', 'secao-combos', 'gift'],
      ['barcas-e-potes', 'Barcas e Potes Família', 'Barcas e Potes', 'secao-barcas-potes', 'sailboat'],
      ['picoles-e-sorvetes', 'Picolés e Sorvetes', 'Picolés e Sorvetes', 'secao-picoles-sorvetes', 'popsicle'],
      ['bebidas', 'Bebidas', 'Bebidas', 'secao-bebidas', 'glassWater'],
      ['doces-e-bomboniere', 'Doces e Bomboniere', 'Doces', 'secao-doces-bomboniere', 'candy'],
    ])
    expect(DRAWERS.map((drawer) => drawer.title)).toEqual([
      'Combos e Ofertas',
      'Barcas e Potes Família (1L, 1,5L e 2L)',
      'Picolés e Sorvetes',
      'Bebidas',
      'Doces e Bomboniere',
    ])
    expect(DRAWERS.every((drawer) => drawer.subtitle.length > 10)).toBe(true)
    expect(DRAWERS.map((drawer) => drawerById(drawer.id))).toEqual(DRAWERS)
  })

  it('selo "N sabores": as opções do primeiro grupo de sabor, sem contar "Outro sabor" nem o tamanho', () => {
    const count = (id: string) => flavorCount(EXTRA_ITEMS.find((item) => item.id === id)!)
    expect(
      [
        'kit-completo-casquinha',
        'pote-de-sorvete-2-litros-especiais',
        'pote-de-sorvete-1-5-litro',
        'combo-de-sorvete',
        'refrigerante-350-ml',
        'acai-do-oca-pronto',
        'agua-mineral-500-ml',
        'pote-de-acai-1-litro',
      ].map(count),
    ).toEqual([12, 12, 6, 6, 5, 0, 0, 0])
  })

  it('têm os 44 itens (5 + 11 + 12 + 2 + 14), com nomes, preços e preços riscados', () => {
    expect(EXTRA_ITEMS).toHaveLength(44)
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

  it('todo item tem foto local em images/catalogo, com texto alternativo; quase todas da loja', () => {
    // As 30 do pedido de 2026-11-16 (gavetas 1 e 2) e as de 29 itens cuja captura do WhatsApp traz o
    // nome do item (a lista do pedido chegou cortada). Uma só continua de banco.
    const FOTOS: Record<string, string> = {
      'kit-completo-casquinha': 'kit-completo-casquinha-duo.jpg',
      'kit-completo': 'kit-completo.jpg',
      'pote-de-acai-1-litro': 'pote-1-litro-acai-montado.jpg',
      'combo-1-litro': 'combo-1-litro.jpg',
      'combo-de-sorvete': 'combo-de-sorvete.jpg',
      'barca-de-acai': 'barca-de-acai.jpg',
      'pote-de-acai-2-litros': 'pote-acai-2-litros.jpg',
      'acai-de-1-litro': 'acai-1-litro.jpg',
      'acai-do-oca-pronto': 'acai-do-oca-pote.jpg',
      'pote-de-sorvete-1-5-litro': 'pote-1-5l-qgresco.jpg',
      'pote-de-sorvete-2-litros-especiais': 'pote-2l-sensacao.jpg',
      'pote-de-sorvete-2-litros-tradicional': 'pote-2l-sterbom-4em1.jpg',
      'pote-de-sorvete-1-litro-especiais': 'pote-1l-qbrounie.jpg',
      'pote-de-sorvete-1-litro-tradicional': 'pote-sorvete-1l-tradicional.jpg',
      'acai-com-creme-ninho': 'acai-creme-ninho-pronto.jpg',
      'acai-mix-150-ml': 'acai-mix-150ml.jpg',
      'copo-diamante-negro': 'copo-diamante-negro.jpg',
      'copao-400-ml': 'copao-400ml.jpg',
      sundae: 'sundae.jpg',
      'cascao-duo': 'cascao-duo.jpg',
      'cobertura-sterbom': 'cobertura-sterbom.jpg',
      moreninha: 'moreninha.jpg',
      'picole-trufado': 'picole-trufado.jpg',
      'picole-gourmet': 'picole-gourmet.jpg',
      garrafinha: 'garrafinha.jpg',
      'roscao-mel': 'roscao-mel.jpg',
      'picole-comum': 'picole-comum.jpg',
      cremosinho: 'cremosinho.jpg',
      'refrigerante-350-ml': 'refrigerante-350ml.jpg',
      'agua-mineral-500-ml': 'agua-mineral-500ml.jpg',
      'quadradinho-de-brownie': 'quadradinho-brownie.jpg',
      pippos: 'pippos.jpg',
      trufas: 'trufas.jpg',
      trident: 'trident.jpg',
      'batom-ao-leite': 'batom-ao-leite.jpg',
      mentos: 'mentos.jpg',
      halls: 'halls.jpg',
      'pipoca-kigarot-75g': 'pipoca-kigarot-75g.jpg',
      'pipoca-kigarot-45g': 'pipoca-kigarot-45g.jpg',
      'fini-gelatinas': 'fini-gelatinas.jpg',
      'docile-canudinho': 'docile-canudinho.jpg',
      jujuba: 'jujuba.jpg',
      nucita: 'nucita.jpg',
      'chocolate-recheado': 'chocolate-recheado.jpg',
    }
    expect(Object.fromEntries(EXTRA_ITEMS.map((item) => [item.id, item.image]))).toEqual(
      Object.fromEntries(Object.entries(FOTOS).map(([id, file]) => [id, `images/catalogo/${file}`])),
    )
    for (const item of EXTRA_ITEMS) {
      expect(item.image, item.id).not.toMatch(/^(https?:)?\/\//)
      expect(item.imageAlt.trim().length, item.id).toBeGreaterThan(10)
    }
    expect(new Set(EXTRA_ITEMS.map((item) => item.image)).size, 'uma foto diferente por item').toBe(EXTRA_ITEMS.length)
  })

  it('a foto do pote de cada sabor, onde a loja mandou (1,5 L, 2 L e 1 L Qbombom)', () => {
    const photos = (name: string) => choiceGroupsOf(byName(name))[0].photos ?? {}
    expect(Object.keys(photos('Pote de Sorvete 1,5 Litro (Qbombom)'))).toHaveLength(6)
    expect(Object.keys(photos('Pote de Sorvete 2 Litros (Qbombom Premium)'))).toEqual([
      'Sensação',
      'Chocolate',
      'Unicórnio',
      'Pavê',
      'Crocante',
      'Creme com passas',
      'Nata com goiabada',
      'Sonho de valsa',
      'Trio (Chocolate, flocos e creme)',
      'Napolitano',
    ])
    expect(photos('Pote de Sorvete 1 Litro (Qbombom Premium)')).toEqual({
      Qbrounie: 'images/catalogo/pote-1l-qbrounie.jpg',
      Brigadeiro: 'images/catalogo/pote-1l-brigadeiro.jpg',
      Flocos: 'images/catalogo/pote-1l-flocos.jpg',
      Napolitano: 'images/catalogo/pote-1l-napolitano.jpg',
    })
    // Toda foto de sabor é de uma opção que existe, e a foto do item é a do primeiro sabor da lista do pedido.
    for (const item of EXTRA_ITEMS) {
      for (const group of choiceGroupsOf(item)) {
        for (const option of Object.keys(group.photos ?? {})) expect(group.options, `${item.id}: ${option}`).toContain(option)
        if (group.photos) expect(Object.values(group.photos), item.id).toContain(item.image)
      }
    }
  })

  it('com o sabor escolhido, a foto daquele sabor; sem foto do sabor, a do item', () => {
    const pote = byName('Pote de Sorvete 2 Litros (Qbombom Premium)')
    expect(extraPhoto(pote)).toEqual({ image: pote.image, alt: pote.imageAlt })
    expect(extraPhoto(pote, { sabor: 'Unicórnio' })).toEqual({
      image: 'images/catalogo/pote-2l-unicornio.jpg',
      alt: 'Pote de sorvete Qbombom Premium de 2 litros, sabor Unicórnio',
    })
    // Toffee e Brownie não têm foto: fica a do item.
    expect(extraPhoto(pote, { sabor: 'Toffee' }).image).toBe(pote.image)
    // "Outro sabor" escrito pelo cliente: a do item.
    expect(extraPhoto(pote, { sabor: 'Ninho com morango' }).image).toBe(pote.image)
  })

  it('Açaí do Oca: o tamanho muda o preço; o cartão mostra "a partir de"', () => {
    const oca = byName('Açaí do Oca (Pote Pronto)')
    expect(choiceGroupsOf(oca)).toEqual([
      { id: 'tamanho', label: 'Tamanho', options: ['500 ml', '1 Litro'], prices: { '500 ml': 1700, '1 Litro': 3300 } },
    ])
    expect([hasPricedChoices(oca), oca.priceCents, extraPriceCents(oca), extraPriceCents(oca, { tamanho: '1 Litro' })]).toEqual([
      true,
      1700,
      1700,
      3300,
    ])
    expect(EXTRA_ITEMS.filter(hasPricedChoices).map((item) => item.id)).toEqual(['acai-do-oca-pronto'])
    // Os outros itens: o preço do item, com qualquer sabor.
    expect(extraPriceCents(byName('Picolé Gourmet'), { sabor: 'Nutella' })).toBe(300)
  })

  it('o tipo de cada item segue o pedido: direto, escolha de sabor ou personalizador', () => {
    const typeOf = (name: string) => byName(name).action.type
    for (const name of [
      'Pote de Açaí 2 Litros (Açaímix Brazil)',
      'Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)',
      'Açaí Mix 150 ml',
      'Cascão DUO',
      'Água Mineral 500 ml',
      'Nucita',
    ]) {
      expect(typeOf(name), name).toBe('direct_confirm')
    }
    for (const name of [
      'Kit Completo Casquinha DUO',
      'Combo 1 Litro',
      'Combo de Sorvete',
      'Açaí do Oca (Pote Pronto)',
      'Copão 400 ml',
      'Picolé Gourmet',
      'Refrigerante 350 ml',
      'Halls',
    ]) {
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
    const DOIS_LITROS =
      'Sensação, Chocolate, Napolitano, Unicórnio, Pavê, Toffee, Crocante, Brownie, Creme com passas, Nata com goiabada, Sonho de valsa, Trio (Chocolate, flocos e creme)'
    expect(groups('Kit Completo Casquinha DUO')).toEqual([
      ['Sabor do sorvete (2 litros)', DOIS_LITROS, true],
      ['Sabor da cobertura', 'Uva, Morango, Chocolate, Caramelo, Leite condensado', false],
    ])
    expect(groups('Kit Completo')).toEqual(groups('Kit Completo Casquinha DUO'))
    expect(groups('Pote de Sorvete 2 Litros (Qbombom Premium)')).toEqual([['Sabor', DOIS_LITROS, true]])
    expect(groups('Pote de Sorvete 1,5 Litro (Qbombom)')).toEqual([
      ['Sabor', 'Mousse de maracujá, Leitinho trufado, Iogurte grego, Qmaltine, Cookies cream, Qgresco', true],
    ])
    expect(groups('Pote de Sorvete 1 Litro (Qbombom Premium)')).toEqual([['Sabor', 'Qbrounie, Brigadeiro, Flocos, Napolitano', false]])
    expect(groups('Combo 1 Litro')).toEqual([['Sabor do sorvete (1 litro)', 'Qbrounie, Brigadeiro, Flocos, Napolitano', false]])
    expect(groups('Combo de Sorvete')).toEqual([
      [
        'Sabor do Ster Bom Dueto (1 litro)',
        'Azul com Creme, Nata Uva, Abacaxi com Coco, Nata com Morango, Nata com Chocolate, Morango com Chocolate',
        false,
      ],
    ])
    expect(groups('Refrigerante 350 ml')).toEqual([
      ['Sabor', 'Coca-Cola, Guaraná Antarctica, Fanta Laranja, Fanta Uva, Sprite', false],
    ])
    expect(groups('Picolé Comum')).toEqual([['Sabor', 'Coco, Chocolate, Morango, Uva, Limão, Maracujá', false]])
    const withOther = EXTRA_ITEMS.filter((item) => choiceGroupsOf(item).some((group) => group.allowOther)).map((item) => item.name)
    expect(withOther).toEqual([
      'Kit Completo Casquinha DUO',
      'Kit Completo',
      'Pote de Sorvete 1,5 Litro (Qbombom)',
      'Pote de Sorvete 2 Litros (Qbombom Premium)',
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
  const kit = byName('Kit Completo Casquinha DUO')

  it('aceita só opções da lista, uma por grupo', () => {
    expect(normalizeChoices(gourmet, { sabor: 'Nutella' })).toEqual({ sabor: 'Nutella' })
    expect(normalizeChoices(gourmet, { sabor: 'Pistache' })).toBeNull()
    expect(normalizeChoices(gourmet, {})).toBeNull()
    expect(normalizeChoices(kit, { sorvete: 'Pavê' })).toBeNull()
    expect(normalizeChoices(kit, { sorvete: 'Pavê', cobertura: 'Caramelo', extra: 'x' })).toEqual({ sorvete: 'Pavê', cobertura: 'Caramelo' })
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
    expect(normalizeChoices(kit, { sorvete: 'Pavê', cobertura: 'Pistache' })).toBeNull()
    expect(normalizeChoices(kit, { sorvete: '   ', cobertura: 'Chocolate' })).toBeNull()
    expect(cleanOtherText('a'.repeat(60))).toHaveLength(40)
    expect(cleanOtherText('linha\nnova\ttab')).toBe('linha nova tab')
  })

  it('"Outro sabor" igual a uma opção vira a própria opção', () => {
    expect(normalizeChoices(kit, { sorvete: 'sensacao', cobertura: 'Chocolate' })).toEqual({ sorvete: 'Sensação', cobertura: 'Chocolate' })
  })

  it('mostra o "outro sabor" marcado como tal', () => {
    const [sorvete] = choiceGroupsOf(kit)
    expect(choiceValueText(sorvete, 'Pavê')).toBe('Pavê')
    expect(choiceValueText(sorvete, 'ninho com morango')).toBe('Ninho com morango (outro sabor)')
    expect(choiceRows(kit, { sorvete: 'Pavê', cobertura: 'Caramelo' })).toEqual([
      { label: 'Sabor do sorvete (2 litros)', value: 'Pavê' },
      { label: 'Sabor da cobertura', value: 'Caramelo' },
    ])
  })
})
