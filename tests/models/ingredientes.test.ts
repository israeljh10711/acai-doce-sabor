import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import medidas from '../../src/features/configurator-3d/medidas.json'
import { readGlb } from './glb.ts'

const MODELS = join(import.meta.dirname, '..', '..', 'public', 'models')

/**
 * Peças em tamanho real, com a origem embaixo. Maior medida em metros.
 * Os adicionais miúdos são montinhos de vários pedaços (cerca de 2 cm), que o site repete pelo setor.
 */
const PIECES: Record<string, number> = {
  granola: 0.026,
  biscoito: 0.026,
  pacoca: 0.026,
  chocoball: 0.026,
  amendoim: 0.026,
  'gotas-de-chocolate': 0.026,
  canudinho: 0.065,
  bis: 0.03,
  sucrilhos: 0.028,
  marshmallow: 0.026,
  kiwi: 0.028,
  banana: 0.028,
  morango: 0.03,
  'creme-de-avela': 0.03,
  'creme-de-ninho': 0.03,
  cereja: 0.045, // com o cabinho
  'kit-kat': 0.05,
}

describe.each(Object.entries(PIECES))('peça %s', (name, maxSize) => {
  const file = join(MODELS, `topping-${name}.glb`)

  it('existe, é leve e está em tamanho real, apoiada no chão e centrada', () => {
    expect(existsSync(file), file).toBe(true)
    const glb = readGlb(file)
    expect(glb.bytes).toBeLessThan(100 * 1024)
    expect(glb.triangles).toBeLessThan(4000)
    expect(glb.min[1]).toBeCloseTo(0, 4)
    const extent = Math.max(glb.max[0] - glb.min[0], glb.max[1] - glb.min[1], glb.max[2] - glb.min[2])
    expect(extent).toBeGreaterThan(0.002)
    expect(extent).toBeLessThanOrEqual(maxSize)
    expect(Math.abs(glb.min[0] + glb.max[0])).toBeLessThan(0.002)
    expect(Math.abs(glb.min[2] + glb.max[2])).toBeLessThan(0.002)
  })
})

describe('camadas normalizadas (monte de raio 1)', () => {
  const { acai, shake, expoente } = medidas.monte
  void expoente

  it.each([
    ['calda-acai', acai],
    ['calda-shake', shake],
  ])('%s fica dentro do monte e logo acima dele', (name, monte) => {
    const glb = readGlb(join(MODELS, `topping-${name}.glb`))
    expect(glb.materialNames).toEqual(['calda'])
    expect(Math.max(Math.abs(glb.min[0]), glb.max[0], Math.abs(glb.min[2]), glb.max[2])).toBeLessThan(1)
    expect(glb.min[1]).toBeGreaterThan(0)
    expect(glb.max[1]).toBeLessThan(monte + 0.1)
  })

  it('po-acai cobre um setor do monte, acima da superfície no centro', () => {
    const glb = readGlb(join(MODELS, 'topping-po-acai.glb'))
    expect(glb.materialNames).toEqual(['po'])
    expect(glb.max[0]).toBeLessThan(1)
    // no centro do monte a camada fica acima do topo (altura `acai`)
    expect(glb.max[1]).toBeGreaterThan(acai)
    expect(glb.max[1]).toBeLessThan(acai + 0.08)
  })
})
