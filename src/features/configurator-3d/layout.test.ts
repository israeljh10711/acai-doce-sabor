import { describe, expect, it } from 'vitest'
import type { IllustrationInput } from '../catalog/illustration/compose.ts'
import { TOPPINGS } from '../catalog/menu.ts'
import { domeGeometry, domeShape } from './dome.ts'
import { layoutScene } from './layout.ts'
import { MODEL_SPECS } from './models.ts'

const acai = (sizeId: string | null, toppings: Record<string, number> = {}): IllustrationInput => ({
  slug: 'acai-tradicional',
  sizeId,
  flavorId: null,
  toppings,
})

describe('MODEL_SPECS', () => {
  it('tem modelo para todo ingrediente do cardápio', () => {
    for (const topping of TOPPINGS) expect(MODEL_SPECS[topping.id], topping.id).toBeDefined()
  })
})

describe('layoutScene', () => {
  it('sem tamanho, mostra só o recipiente do primeiro tamanho, vazio', () => {
    const scene = layoutScene(acai(null, { granola: 1 }))
    expect(scene.containerFile).toBe('container-pote-150')
    expect(scene.baseFile).toBeNull()
    expect(scene.toppings).toEqual([])
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

  it('põe mais pedaços quando a quantidade aumenta, até um máximo', () => {
    const count = (q: number) =>
      layoutScene(acai('isopor-gg', { granola: q })).toppings[0].pieces.length
    expect(count(2)).toBeGreaterThan(count(1))
    expect(count(7)).toBeLessThanOrEqual(12)
    const kitKat = layoutScene(acai('isopor-gg', { 'kit-kat': 5 })).toppings[0]
    expect(kitKat.pieces.length).toBe(3)
  })

  it('caldas e pó são camadas ampliadas pelo raio do monte, cada uma com sua cor e giro', () => {
    const scene = layoutScene(
      acai('copo-500', { 'calda-chocolate': 1, 'calda-morango': 1, 'leite-em-po': 1 }),
    )
    const dome = domeGeometry('acai-tradicional', 'copo-500')
    const layers = scene.toppings.filter((t) => t.layer)
    expect(layers.map((t) => t.file)).toEqual(['topping-calda-acai', 'topping-calda-acai', 'topping-po-acai'])
    for (const layer of layers) {
      expect(layer.pieces).toHaveLength(1)
      expect(layer.pieces[0].scale).toBeCloseTo(dome.radius, 6)
      expect(layer.pieces[0].position).toEqual([0, dome.top, 0])
      expect(layer.color).toMatch(/^#[0-9a-f]{6}$/)
    }
    const rotations = layers.map((t) => t.pieces[0].rotationY)
    expect(new Set(rotations).size).toBe(rotations.length)
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

  it('dá sempre a mesma montagem para a mesma escolha', () => {
    const input = acai('copo-400', { granola: 2, kiwi: 1, cereja: 1 })
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
