import { describe, expect, it } from 'vitest'
import type { IllustrationInput } from '../catalog/illustration/compose.ts'
import { TOPPINGS } from '../catalog/menu.ts'
import { domeGeometry, domeShape } from './dome.ts'
import { MAX_PIECES, type ToppingNode, layoutScene } from './layout.ts'
import { MODEL_SPECS } from './models.ts'

const acai = (sizeId: string | null, toppings: Record<string, number> = {}): IllustrationInput => ({
  slug: 'acai-tradicional',
  sizeId,
  flavorId: null,
  toppings,
})

const TAU = Math.PI * 2
const angleOf = ([x, , z]: [number, number, number]) => (Math.atan2(z, x) + TAU) % TAU

/** Quanto da volta as peças ocupam: a volta inteira menos o maior vão entre elas. */
function angularSpread(node: ToppingNode): number {
  const angles = node.pieces.map((piece) => angleOf(piece.position)).sort((a, b) => a - b)
  let gap = TAU - angles[angles.length - 1] + angles[0]
  for (let i = 1; i < angles.length; i++) gap = Math.max(gap, angles[i] - angles[i - 1])
  return TAU - gap
}

const byId = (toppings: ToppingNode[], id: string) => toppings.find((t) => t.toppingId === id) as ToppingNode

describe('MODEL_SPECS', () => {
  it('tem modelo para todo ingrediente do cardápio', () => {
    for (const topping of TOPPINGS) expect(MODEL_SPECS[topping.id], topping.id).toBeDefined()
  })
})

describe('layoutScene', () => {
  it('sem tamanho, mostra só o recipiente do primeiro tamanho, vazio', () => {
    const scene = layoutScene(acai(null, { granola: 1, 'creme-de-ninho': 1 }))
    expect(scene.containerFile).toBe('container-pote-150')
    expect(scene.baseFile).toBeNull()
    expect(scene.toppings).toEqual([])
    expect(scene.bands).toEqual([])
  })

  it('usa o recipiente e a base do tamanho escolhido', () => {
    const scene = layoutScene(acai('copo-500'))
    expect(scene.containerFile).toBe('container-copo-500')
    expect(scene.baseFile).toBe('base-acai-copo-500')
    expect(layoutScene({ ...acai('copo-500'), slug: 'acai-oca' }).baseFile).toBe('base-acai-copo-500')
  })

  it('no milk-shake, usa o copo próprio e a cor do sabor', () => {
    const scene = layoutScene({ slug: 'milk-shake', sizeId: '400-ml', flavorId: 'morango', toppings: {} })
    expect(scene.containerFile).toBe('container-shake-400-ml')
    expect(scene.baseFile).toBe('base-shake-400-ml')
    expect(scene.baseColor).toBe('#ee8fa3')
  })

  it('desenha só os ingredientes escolhidos', () => {
    const scene = layoutScene(acai('isopor-gg', { granola: 2, banana: 1, 'calda-chocolate': 1, 'kit-kat': 1 }))
    expect(scene.toppings.map((t) => t.toppingId).sort()).toEqual([
      'banana',
      'calda-chocolate',
      'granola',
      'kit-kat',
    ])
  })

  it('apoia cada peça sobre o monte, dentro da borda', () => {
    const input = acai('pote-530', { granola: 3, morango: 1, cereja: 1, 'creme-de-ninho': 1, chocoball: 2 })
    const dome = domeGeometry('acai-tradicional', 'pote-530')
    for (const topping of layoutScene(input).toppings) {
      for (const piece of topping.pieces) {
        const [x, y, z] = piece.position
        const rho = Math.hypot(x, z) / dome.radius
        expect(rho, topping.toppingId).toBeLessThanOrEqual(0.9)
        const surface = dome.top + dome.height * domeShape(rho)
        expect(Math.abs(y - surface), topping.toppingId).toBeLessThan(0.004)
      }
    }
  })

  it('dá a cada adicional, fruta e creme um setor do topo, sem invadir o dos outros', () => {
    const scene = layoutScene(acai('isopor-gg', { granola: 1, amendoim: 1, banana: 1, morango: 1 }))
    for (const id of ['granola', 'amendoim', 'banana', 'morango']) {
      // quatro setores iguais: cada um ocupa um quarto da volta
      expect(angularSpread(byId(scene.toppings, id)), id).toBeLessThanOrEqual(TAU / 4 + 0.05)
    }
    // com um ingrediente só, o setor é a volta inteira
    expect(angularSpread(layoutScene(acai('isopor-gg', { granola: 1 })).toppings[0])).toBeGreaterThan(TAU * 0.8)
  })

  it('cobre o topo com fartura: mais pedaços no recipiente maior e na quantidade maior', () => {
    const granola = (sizeId: string, toppings: Record<string, number>) =>
      byId(layoutScene(acai(sizeId, toppings)).toppings, 'granola').pieces.length
    expect(granola('isopor-gg', { granola: 1 })).toBeGreaterThan(granola('pote-150', { granola: 1 }))
    expect(granola('isopor-gg', { granola: 1 })).toBeGreaterThanOrEqual(30)
    expect(granola('isopor-gg', { granola: 2, amendoim: 1 })).toBeGreaterThan(
      granola('isopor-gg', { granola: 1, amendoim: 1 }),
    )
  })

  it('nunca passa do limite de pedaços, mesmo com tudo escolhido', () => {
    const everything = Object.fromEntries(TOPPINGS.map((topping) => [topping.id, 3]))
    const scene = layoutScene(acai('isopor-gg', everything))
    const total = scene.toppings.reduce((sum, topping) => sum + topping.pieces.length, 0)
    expect(total).toBeLessThanOrEqual(MAX_PIECES + 20)
    const kitKat = byId(layoutScene(acai('isopor-gg', { 'kit-kat': 5 })).toppings, 'kit-kat')
    expect(kitKat.pieces.length).toBe(3)
  })

  it('caldas passam por cima de tudo; o pó vira para o próprio setor', () => {
    const scene = layoutScene(
      acai('copo-500', { 'calda-chocolate': 1, 'calda-morango': 1, 'leite-em-po': 1, granola: 1 }),
    )
    const dome = domeGeometry('acai-tradicional', 'copo-500')
    const syrups = scene.toppings.filter((t) => t.file === 'topping-calda-acai')
    expect(syrups).toHaveLength(2)
    for (const syrup of syrups) {
      expect(syrup.layer).toBe(true)
      expect(syrup.pieces).toHaveLength(1)
      expect(syrup.pieces[0].scale).toBeCloseTo(dome.radius, 6)
      expect(syrup.pieces[0].position[1]).toBeGreaterThan(dome.top)
      expect(syrup.color).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(syrups[0].pieces[0].rotationY).not.toBe(syrups[1].pieces[0].rotationY)

    const powder = byId(scene.toppings, 'leite-em-po')
    expect(powder.layer).toBe(true)
    expect(powder.pieces[0].position).toEqual([0, dome.top, 0])
    // o pó fica no lado oposto ao da granola (cada um tem metade da volta, ou quase)
    const granola = byId(scene.toppings, 'granola')
    const granolaMiddle = Math.atan2(
      granola.pieces.reduce((s, p) => s + p.position[2], 0),
      granola.pieces.reduce((s, p) => s + p.position[0], 0),
    )
    const powderMiddle = -powder.pieces[0].rotationY
    const difference = Math.abs(((granolaMiddle - powderMiddle + 3 * Math.PI) % TAU) - Math.PI)
    expect(difference).toBeGreaterThan(Math.PI / 2)
  })

  it('no milk-shake, a calda usa o modelo do monte de espuma', () => {
    const scene = layoutScene({
      slug: 'milk-shake',
      sizeId: '500-ml',
      flavorId: 'chocolate',
      toppings: { 'calda-morango': 1 },
    })
    expect(scene.toppings[0].file).toBe('topping-calda-shake')
  })

  it('mostra faixas de creme no copo e no pote só para os cremes escolhidos, no máximo duas', () => {
    const scene = layoutScene(
      acai('copo-500', { 'calda-leite-condensado': 1, 'creme-de-avela': 1, 'creme-de-ninho': 1, granola: 1 }),
    )
    expect(scene.bands).toEqual([
      { mesh: 'base-acai-copo-500-camada-1', toppingId: 'creme-de-ninho', color: '#f5ead0' },
      { mesh: 'base-acai-copo-500-camada-2', toppingId: 'creme-de-avela', color: '#5a3420' },
    ])
    expect(layoutScene(acai('pote-200', { 'calda-leite-condensado': 1 })).bands).toEqual([
      { mesh: 'base-acai-pote-200-camada-1', toppingId: 'calda-leite-condensado', color: '#fff6dc' },
    ])
    expect(layoutScene(acai('copo-500', { granola: 1, 'calda-chocolate': 1 })).bands).toEqual([])
    // o isopor não deixa ver o que há dentro
    expect(layoutScene(acai('isopor-m', { 'creme-de-ninho': 1 })).bands).toEqual([])
  })

  it('dá sempre a mesma montagem para a mesma escolha', () => {
    const input = acai('copo-400', { granola: 2, kiwi: 1, cereja: 1, 'creme-de-ninho': 1 })
    expect(layoutScene(input)).toEqual(layoutScene(input))
  })

  it('lista os arquivos que a cena precisa baixar, sem repetir', () => {
    const scene = layoutScene(acai('copo-400', { 'calda-acai': 1, 'calda-morango': 1, granola: 1 }))
    expect(scene.files).toEqual([
      'container-copo-400',
      'base-acai-copo-400',
      'topping-calda-acai',
      'topping-granola',
    ])
  })
})
