import { describe, expect, it } from 'vitest'
import { PRODUCTS, TOPPINGS } from '../catalog/menu.ts'
import { type ComposerInput, FLAVOR_PREFIX, composeLayers, drizzlePath, sectorCoverage } from './layout.ts'
import { BATIDO_FLAVOR_TOPPINGS, SHAKE_COLORS, SIZE_SCALE, SPRITES, TOPPING_VISUALS, lookOf } from './visuals.ts'

const input = (partial: Partial<ComposerInput> & Pick<ComposerInput, 'slug'>): ComposerInput => ({
  sizeId: null,
  flavorId: null,
  toppings: {},
  ...partial,
})

/** Todos os ingredientes que aparecem em alguma camada. */
function layered(composition: ReturnType<typeof composeLayers>): Set<string> {
  return new Set(
    [
      ...composition.sectors,
      ...composition.scatter,
      ...composition.patches,
      ...composition.dollops,
      ...composition.pieces,
      ...composition.drizzles,
    ].map((layer) => layer.toppingId),
  )
}

describe('cobertura de dados', () => {
  it('todo ingrediente do cardápio tem aparência no compositor', () => {
    for (const topping of TOPPINGS) expect(TOPPING_VISUALS[lookOf(topping)], topping.id).toBeDefined()
  })

  it('todo tamanho tem escala, todo sabor de milk-shake tem cor e todo sabor de batido tem complementos', () => {
    for (const product of Object.values(PRODUCTS)) {
      for (const size of product.sizes) expect(SIZE_SCALE[size.id], size.id).toBeGreaterThan(0)
    }
    for (const flavor of PRODUCTS['milk-shake'].flavors) expect(SHAKE_COLORS[flavor.id], flavor.id).toMatch(/^#[0-9a-f]{6}$/)
    for (const flavor of PRODUCTS['acai-batido'].flavors) expect(BATIDO_FLAVOR_TOPPINGS[flavor.id], flavor.id).toContain('calda-leite-condensado')
  })

  it('as peças recortadas existem para tudo o que usa peças', () => {
    for (const visual of Object.values(TOPPING_VISUALS)) {
      if (visual.kind === 'piece' || visual.kind === 'scatter') expect(SPRITES[visual.sprite].length).toBeGreaterThan(0)
    }
  })
})

describe('só aparece o que foi escolhido', () => {
  it('sem tamanho: recipiente vazio, sem complementos', () => {
    const composition = composeLayers(input({ slug: 'acai-oca' }))
    expect(composition.empty).toBe(true)
    expect(layered(composition).size).toBe(0)
    expect(composition.shown).toEqual([])
  })

  it('mostra exatamente os ingredientes escolhidos, na ordem', () => {
    const toppings = { granola: 2, banana: 1, 'calda-chocolate': 1, 'creme-de-avela': 1, cereja: 1, 'kit-kat': 2 }
    const composition = composeLayers(input({ slug: 'acai-tradicional', sizeId: 'isopor-g', toppings }))
    expect(composition.shown).toEqual(Object.keys(toppings))
    expect(layered(composition)).toEqual(new Set(Object.keys(toppings)))
    expect(composition.pieces.filter((piece) => piece.toppingId === 'kit-kat')).toHaveLength(2)
  })

  it('ignora ingrediente que o produto não aceita', () => {
    const composition = composeLayers(input({ slug: 'milk-shake', sizeId: '400-ml', flavorId: 'ninho', toppings: { granola: 1 } }))
    expect(layered(composition).size).toBe(0)
  })

  it('cada ingrediente do cardápio, sozinho, aparece na foto', () => {
    for (const product of Object.values(PRODUCTS)) {
      for (const topping of TOPPINGS.filter((item) => product.groups.includes(item.group))) {
        const composition = composeLayers(
          input({ slug: product.slug, sizeId: product.sizes[0].id, flavorId: product.flavors[0]?.id ?? null, toppings: { [topping.id]: 1 } }),
        )
        expect(layered(composition).has(topping.id), `${product.slug}: ${topping.id}`).toBe(true)
      }
    }
  })
})

describe('recipiente', () => {
  it('muda com o tamanho: pote, copo ou isopor, maior quanto maior o tamanho', () => {
    const oca = (sizeId: string) => composeLayers(input({ slug: 'acai-oca', sizeId })).container
    expect(oca('pote-200').kind).toBe('pote')
    expect(oca('copo-500').kind).toBe('copo')
    expect(oca('isopor-gg').kind).toBe('isopor')
    expect(oca('isopor-gg').scale).toBeGreaterThan(oca('isopor-p').scale)
    expect(oca('pote-530').scale).toBeGreaterThan(oca('pote-200').scale)
  })

  it('isopor do Tradicional troca a foto do copo pela tigela vista de cima', () => {
    const copo = composeLayers(input({ slug: 'acai-tradicional', sizeId: 'copo-500', toppings: { morango: 1 } }))
    const isopor = composeLayers(input({ slug: 'acai-tradicional', sizeId: 'isopor-m', toppings: { morango: 1 } }))
    expect([copo.container.kind, isopor.container.kind]).toEqual(['copo', 'isopor'])
    expect(isopor.container.surface).toBeLessThan(copo.container.surface)
  })
})

describe('setores do açaí', () => {
  it('um ingrediente cobre uma parte; quatro ou mais cobrem tudo', () => {
    expect([1, 2, 3, 4, 6].map(sectorCoverage)).toEqual([140, 215, 290, 360, 360])
  })

  it('quantidade maior ganha setor maior, sem passar de três vezes', () => {
    const composition = composeLayers(
      input({ slug: 'acai-oca', sizeId: 'isopor-gg', toppings: { granola: 2, banana: 1, pacoca: 5, morango: 1 } }),
    )
    const sweep = Object.fromEntries(composition.sectors.map((sector) => [sector.toppingId, sector.sweep]))
    expect(sweep.granola).toBeCloseTo(2 * sweep.banana)
    expect(sweep.pacoca).toBeCloseTo(3 * sweep.banana)
    expect(composition.sectors.reduce((sum, sector) => sum + sector.sweep, 0)).toBeCloseTo(360)
  })

  it('rodelas de banana ficam dentro do círculo do açaí e do próprio setor', () => {
    const composition = composeLayers(input({ slug: 'acai-oca', sizeId: 'isopor-g', toppings: { banana: 1, granola: 1 } }))
    const banana = composition.sectors.find((sector) => sector.toppingId === 'banana')!
    const slices = composition.scatter.filter((piece) => piece.toppingId === 'banana')
    expect(slices.length).toBeGreaterThanOrEqual(4)
    for (const slice of slices) {
      const dx = slice.x - 0.5
      const dy = slice.y - 0.5
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(0.5)
      const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
      const offset = (angle - banana.start + 360) % 360
      expect(offset).toBeLessThanOrEqual(banana.sweep + 0.01)
    }
  })
})

describe('bebidas', () => {
  it('milk-shake ganha a cor do sabor', () => {
    const composition = composeLayers(input({ slug: 'milk-shake', sizeId: '500-ml', flavorId: 'pitaya' }))
    expect(composition.surface).toEqual({ kind: 'milkshake', tint: SHAKE_COLORS.pitaya })
  })

  it('cada sabor do batido mostra o que leva por cima, sem contar como ingrediente escolhido', () => {
    const batido = (flavorId: string) => composeLayers(input({ slug: 'acai-batido', sizeId: '300-ml', flavorId }))
    expect(batido('leite-condensado').drizzles.map((layer) => layer.toppingId)).toEqual([`${FLAVOR_PREFIX}calda-leite-condensado`])
    expect(batido('leite-condensado-amendoim').patches.map((layer) => layer.toppingId)).toEqual([`${FLAVOR_PREFIX}amendoim`])
    expect(batido('leite-condensado-pacoca').patches.map((layer) => layer.toppingId)).toEqual([`${FLAVOR_PREFIX}pacoca`])
    expect(batido('leite-condensado-pacoca').shown).toEqual([])
  })

  it('adicionais do batido aparecem: cremes em porções e Ovomaltine por cima', () => {
    const composition = composeLayers(
      input({
        slug: 'acai-batido',
        sizeId: '500-ml',
        flavorId: 'leite-condensado',
        toppings: { 'batido-creme-de-cookies': 2, 'batido-ovomaltine': 1 },
      }),
    )
    expect(composition.dollops.filter((layer) => layer.toppingId === 'batido-creme-de-cookies')).toHaveLength(2)
    expect(composition.patches.map((layer) => layer.toppingId)).toContain('batido-ovomaltine')
    expect(composition.sectors).toEqual([])
  })
})

describe('caldas e estabilidade', () => {
  it('cada calda tem o próprio fio, que atravessa o açaí de um lado ao outro', () => {
    const composition = composeLayers(
      input({ slug: 'acai-oca', sizeId: 'copo-500', toppings: { 'calda-chocolate': 1, 'calda-morango': 1 } }),
    )
    const [a, b] = composition.drizzles
    expect(a.d).not.toBe(b.d)
    const numbers = [...a.d.matchAll(/-?\d+\.\d+/g)].map((match) => Number(match[0]))
    // As voltas ficam um pouco fora do círculo (escondidas pelo recorte), nunca longe dele.
    for (const value of numbers) {
      expect(value).toBeGreaterThan(-25)
      expect(value).toBeLessThan(125)
    }
    // Duas levas que se cruzam: quatro passadas e mais três, cada leva começando com M.
    expect(a.d.match(/M/g)).toHaveLength(2)
    expect(a.d.match(/[ML]/g)).toHaveLength(7)
    expect(drizzlePath('x', 10)).toBe(drizzlePath('x', 10))
  })

  it('a mesma escolha gera sempre a mesma foto', () => {
    const choice = input({ slug: 'acai-oca', sizeId: 'isopor-m', toppings: { chocoball: 1, banana: 2, cereja: 1 } })
    expect(composeLayers(choice)).toEqual(composeLayers(choice))
  })
})
