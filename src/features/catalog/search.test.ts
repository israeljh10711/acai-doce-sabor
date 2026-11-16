import { describe, expect, it } from 'vitest'
import { EXTRA_ITEMS } from './extras.ts'
import { matchesQuery, normalizeSearch, searchMenu } from './search.ts'

/** Nomes encontrados: produtos principais e itens das gavetas, na ordem do cardápio. */
function found(query: string) {
  const result = searchMenu(query)
  return {
    main: [...result.main],
    extras: [...result.drawers.values()].flat().map((item) => item.name),
    drawers: [...result.drawers.keys()],
    total: result.total,
  }
}

describe('normalização', () => {
  it('ignora acentos, maiúsculas e pontuação', () => {
    expect(normalizeSearch('  AÇAÍ  ')).toBe('acai')
    expect(normalizeSearch('Picolé')).toBe('picole')
    expect(normalizeSearch("Pippo's")).toBe('pippos')
    expect(normalizeSearch('Coca-Cola')).toBe('coca cola')
    expect(normalizeSearch('Sorvete 1,5 Litro')).toBe('sorvete 1.5 litro')
    expect(normalizeSearch('variados.')).toBe('variados')
    expect(normalizeSearch('!!!')).toBe('')
  })

  it('a frase precisa começar uma palavra', () => {
    expect(matchesQuery(['refrigerante'], 'refri')).toBe(true)
    expect(matchesQuery(['10 casquinhas'], 'casquinha')).toBe(true)
    expect(matchesQuery(['batido'], 'atido')).toBe(false)
    expect(matchesQuery(['qualquer'], '')).toBe(true)
  })
})

describe('busca do cardápio', () => {
  it('sem busca, mostra tudo: 4 produtos e 44 itens', () => {
    const all = found('')
    expect(all.main).toEqual(['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'])
    expect(all.extras).toHaveLength(44)
    expect(all.total).toBe(48)
  })

  it('"acai" (sem acento) acha os açaís principais e os das gavetas', () => {
    const result = found('acai')
    expect(result.main).toEqual(expect.arrayContaining(['acai-oca', 'acai-tradicional', 'acai-batido']))
    expect(result.extras).toEqual(
      expect.arrayContaining([
        'Pote de Açaí 1 Litro Montado',
        'Barca de Açaí',
        'Açaí Mix 150 ml',
        'Açaí de 1 Litro (Açaímix Brazil)',
        'Açaí do Oca (Pote Pronto)',
      ]),
    )
  })

  it('"picole" acha os picolés, não a gaveta inteira', () => {
    expect(found('picole')).toMatchObject({ main: [], extras: ['Picolé Trufado', 'Picolé Gourmet', 'Picolé Comum'] })
  })

  it('"batida" acha o Açaí Batido', () => {
    expect(found('batida')).toMatchObject({ main: ['acai-batido'], extras: [] })
  })

  it('"dindin", "sacole" e "geladinho" acham Cremosinho e Garrafinha', () => {
    for (const query of ['dindin', 'sacole', 'sacolé', 'geladinho']) {
      expect(found(query), query).toMatchObject({ main: [], extras: ['Garrafinha', 'Cremosinho'] })
    }
  })

  it('"refri", "refrigerante", "coca", "guarana" e "lata" acham o Refrigerante 350 ml', () => {
    for (const query of ['refri', 'refrigerante', 'coca', 'guaraná', 'lata']) {
      expect(found(query), query).toMatchObject({ main: [], extras: ['Refrigerante 350 ml'] })
    }
  })

  it('"agua" acha a Água Mineral 500 ml', () => {
    expect(found('agua')).toMatchObject({ main: [], extras: ['Água Mineral 500 ml'] })
  })

  it('"casquinha" e "cascao" acham os cinco itens com casquinha', () => {
    const five = ['Kit Completo Casquinha DUO', 'Combo 1 Litro', 'Combo de Sorvete', 'Cascão DUO', 'Moreninha']
    expect(found('cascão').extras).toEqual(five)
    // O Kit Completo também leva casquinhas (está na descrição).
    expect(found('casquinha').extras).toEqual(['Kit Completo Casquinha DUO', 'Kit Completo', 'Combo 1 Litro', 'Combo de Sorvete', 'Cascão DUO', 'Moreninha'])
  })

  it('"barca" acha a Barca de Açaí', () => {
    expect(found('barca')).toMatchObject({ main: [], extras: ['Barca de Açaí'] })
  })

  it('"1 litro" e "1l" acham os potes e combos de 1 litro, sem o de 1,5', () => {
    const potes = [
      'Pote de Açaí 1 Litro Montado',
      'Combo 1 Litro',
      'Combo de Sorvete',
      'Açaí de 1 Litro (Açaímix Brazil)',
      'Açaí do Oca (Pote Pronto)',
      'Pote de Sorvete 1 Litro (Qbombom Premium)',
      'Pote de Sorvete 1 Litro (Tradicional)',
    ]
    expect(found('1 litro').extras).toEqual(potes)
    expect(found('1l').extras).toEqual(potes)
    expect(found('1,5').extras).toEqual(['Pote de Sorvete 1,5 Litro (Qbombom)'])
  })

  it('"2 litros" e "2l" acham os potes e kits de 2 litros', () => {
    const doisLitros = [
      'Kit Completo Casquinha DUO',
      'Kit Completo',
      'Pote de Açaí 2 Litros (Açaímix Brazil)',
      'Pote de Sorvete 2 Litros (Qbombom Premium)',
      'Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)',
    ]
    expect(found('2 litros').extras).toEqual(doisLitros)
    expect(found('2l').extras).toEqual(doisLitros)
  })

  it('palavras da gaveta acham a gaveta toda: "bebida" e "doces"', () => {
    expect(found('bebida')).toMatchObject({ extras: ['Refrigerante 350 ml', 'Água Mineral 500 ml'], drawers: ['bebidas'] })
    expect(found('doces').extras).toHaveLength(14)
  })

  it('várias palavras sem número valem soltas', () => {
    expect(found('sorvete chocolate').extras).toEqual(expect.arrayContaining(['Copo Diamante Negro', 'Pote de Sorvete 1 Litro (Tradicional)']))
  })

  it('acha pelos sabores e ingredientes: "nutella", "kit kat", "sprite"', () => {
    expect(found('nutella').extras).toEqual(['Picolé Trufado', 'Picolé Gourmet'])
    expect(found('kit kat').main).toEqual(['acai-oca', 'acai-tradicional', 'milk-shake'])
    expect(found('sprite').extras).toEqual(['Refrigerante 350 ml'])
  })

  it('acha pelas marcas e sabores do catálogo da loja: "qbombom", "dueto", "unicórnio", "oca"', () => {
    expect(found('qbombom').extras).toEqual([
      'Combo 1 Litro',
      'Pote de Sorvete 1,5 Litro (Qbombom)',
      'Pote de Sorvete 2 Litros (Qbombom Premium)',
      'Pote de Sorvete 1 Litro (Qbombom Premium)',
    ])
    expect(found('dueto').extras).toEqual(['Combo de Sorvete'])
    expect(found('unicórnio').extras).toEqual(['Kit Completo Casquinha DUO', 'Kit Completo', 'Pote de Sorvete 2 Litros (Qbombom Premium)'])
    expect(found('oca')).toMatchObject({ main: ['acai-oca'], extras: ['Açaí do Oca (Pote Pronto)'] })
  })

  it('nada encontrado: zero resultados', () => {
    expect(found('pizza de calabresa')).toEqual({ main: [], extras: [], drawers: [], total: 0 })
  })

  it('a contagem por gaveta bate com os itens encontrados', () => {
    const result = searchMenu('chocolate')
    const counted = [...result.drawers.values()].reduce((sum, items) => sum + items.length, 0)
    expect(result.total).toBe(result.main.length + counted)
    expect(counted).toBeLessThanOrEqual(EXTRA_ITEMS.length)
  })
})
