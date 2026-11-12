import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { domeGeometry, domeShape, measuresFor } from '../../src/features/configurator-3d/dome.ts'
import medidas from '../../src/features/configurator-3d/medidas.json'
import { readGlb } from './glb.ts'

const MODELS = join(import.meta.dirname, '..', '..', 'public', 'models')

describe('conta do monte igual à do Blender', () => {
  it.each(Object.keys(medidas.acai))('açaí %s: o topo do GLB bate com a conta do site', (sizeId) => {
    const dome = domeGeometry('acai-tradicional', sizeId)
    const glb = readGlb(join(MODELS, `base-acai-${sizeId}.glb`))
    // a base tem ondulações de creme de até 6% da altura do monte
    expect(glb.max[1]).toBeGreaterThan(dome.top + dome.height * 0.9)
    expect(glb.max[1]).toBeLessThan(dome.top + dome.height * 1.07)
    expect(glb.max[0]).toBeLessThanOrEqual(dome.radius + 1e-4)
  })

  it.each(Object.keys(medidas.shake))('milk-shake %s: o topo do GLB bate com a conta do site', (sizeId) => {
    const dome = domeGeometry('milk-shake', sizeId)
    const glb = readGlb(join(MODELS, `base-shake-${sizeId}.glb`))
    expect(glb.max[1]).toBeGreaterThan(dome.top + dome.height * 0.9)
    expect(glb.max[1]).toBeLessThan(dome.top + dome.height * 1.07)
  })
})

describe('domeShape', () => {
  it('vale 1 no centro e 0 na borda, descendo sempre', () => {
    expect(domeShape(0)).toBeCloseTo(1, 6)
    expect(domeShape(1)).toBeCloseTo(0, 6)
    let previous = 2
    for (let rho = 0; rho <= 1; rho += 0.05) {
      const value = domeShape(rho)
      expect(value).toBeLessThanOrEqual(previous)
      previous = value
    }
  })
})

describe('measuresFor', () => {
  it('usa as medidas do açaí nos dois açaís e as do copo no milk-shake', () => {
    expect(measuresFor('acai-oca', 'copo-500')).toBe(medidas.acai['copo-500'])
    expect(measuresFor('acai-tradicional', 'pote-150')).toBe(medidas.acai['pote-150'])
    expect(measuresFor('milk-shake', '500-ml')).toBe(medidas.shake['500-ml'])
    expect(measuresFor('milk-shake', 'pote-150')).toBeUndefined()
  })
})
