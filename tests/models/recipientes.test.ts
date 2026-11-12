import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '../../src/features/catalog/menu.ts'
import medidas from '../../src/features/configurator-3d/medidas.json'
import { readGlb } from './glb.ts'

const MODELS = join(import.meta.dirname, '..', '..', 'public', 'models')

type Medida = (typeof medidas.acai)['pote-150']

// Recipientes de açaí (Oca e Tradicional usam os mesmos) e copos de milk-shake.
const containers: [string, Medida, 'acai' | 'shake'][] = [
  ...Object.entries(medidas.acai).map(([id, m]) => [id, m, 'acai'] as [string, Medida, 'acai']),
  ...Object.entries(medidas.shake).map(([id, m]) => [`shake-${id}`, m, 'shake'] as [string, Medida, 'shake']),
]

describe('tabela de medidas', () => {
  it('tem medida para todo tamanho do cardápio', () => {
    for (const slug of ['acai-oca', 'acai-tradicional'] as const) {
      for (const size of PRODUCTS[slug].sizes) expect(medidas.acai, size.id).toHaveProperty(size.id)
    }
    for (const size of PRODUCTS['milk-shake'].sizes) expect(medidas.shake, size.id).toHaveProperty(size.id)
  })

  it('tem boca maior que o fundo e parede fina', () => {
    for (const [id, m] of containers) {
      expect(m.raioBoca, id).toBeGreaterThan(m.raioFundo)
      expect(m.parede, id).toBeLessThan(m.raioFundo / 4)
    }
  })
})

describe.each(containers)('modelos do recipiente %s', (id, m, product) => {
  const containerFile = join(MODELS, `container-${id}.glb`)
  const baseFile = join(MODELS, `base-${product}-${id.replace('shake-', '')}.glb`)

  it('existem em public/models', () => {
    expect(existsSync(containerFile), containerFile).toBe(true)
    expect(existsSync(baseFile), baseFile).toBe(true)
  })

  it('o recipiente tem a altura e a largura da tabela, apoiado no chão e centrado', () => {
    const glb = readGlb(containerFile)
    expect(glb.version).toBe('2.0')
    expect(glb.hasCameras || glb.hasAnimations).toBe(false)
    expect(glb.min[1]).toBeCloseTo(0, 4)
    expect(glb.max[1]).toBeGreaterThanOrEqual(m.altura - 0.001)
    expect(glb.max[1]).toBeLessThanOrEqual(m.altura + 0.004)
    expect(glb.max[0]).toBeGreaterThanOrEqual(m.raioBoca - 0.001)
    expect(glb.max[0]).toBeLessThanOrEqual(m.raioBoca + 0.005)
    expect(glb.min[0] + glb.max[0]).toBeCloseTo(0, 3)
    expect(glb.min[2] + glb.max[2]).toBeCloseTo(0, 3)
  })

  it('a base fica dentro do recipiente e o monte passa da borda', () => {
    const base = readGlb(baseFile)
    expect(base.min[1]).toBeGreaterThanOrEqual(0)
    expect(base.max[0]).toBeLessThan(m.raioBoca)
    const dome = medidas.monte[product] * (m.raioBoca - m.parede)
    expect(base.max[1]).toBeGreaterThan(m.altura * 0.9)
    expect(base.max[1]).toBeLessThanOrEqual(m.altura + dome + 0.004)
  })

  it('é leve para o celular', () => {
    const container = readGlb(containerFile)
    const base = readGlb(baseFile)
    expect(container.bytes).toBeLessThan(150 * 1024)
    expect(base.bytes).toBeLessThan(150 * 1024)
    expect(container.triangles).toBeLessThan(9000)
    // o monte tem as marcas de espátula; nos copos e potes, mais as duas faixas de creme
    expect(base.triangles).toBeLessThan(16000)
  })

  it('usa os materiais com os nomes que o site espera', () => {
    const material = { pote: 'pp', copo: 'pet', isopor: 'eps', shake: 'vidro' }[m.tipo]
    expect(readGlb(containerFile).materialNames).toEqual([material])
    const base = product === 'shake' ? ['shake', 'shake-lado'] : ['acai', 'acai-lado']
    const bands = m.tipo === 'copo' || m.tipo === 'pote' ? ['camada'] : []
    expect(readGlb(baseFile).materialNames).toEqual([...base, ...bands])
  })
})
