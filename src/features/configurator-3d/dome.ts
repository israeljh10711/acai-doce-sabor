/**
 * Medidas do monte de açaí (ou da espuma do milk-shake) de cada recipiente.
 * É a mesma conta do script do Blender (assets/blender/scripts/recipientes.py e comum.py);
 * o teste tests/models/dome.test.ts confere a conta contra os arquivos GLB.
 */
import type { CategorySlug } from '../catalog/categories.ts'
import medidas from './medidas.json'

export type Measures = (typeof medidas.acai)['pote-150']

/** Folga entre a base e a parede, igual à do Blender. */
const GAP = 0.0004

export function measuresFor(slug: CategorySlug, sizeId: string): Measures | undefined {
  const table: Record<string, Measures> = slug === 'milk-shake' ? medidas.shake : medidas.acai
  return Object.hasOwn(table, sizeId) ? table[sizeId] : undefined
}

/** Forma do monte, de 1 no centro (rho = 0) a 0 na borda (rho = 1). Superelipse. */
export function domeShape(rho: number): number {
  const r = Math.min(Math.max(rho, 0), 1)
  const e = 2 / medidas.monte.expoente
  const cosT = r ** (1 / e)
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
  return sinT ** e
}

export type Dome = {
  /** Altura, em metros, onde o monte começa (a borda do conteúdo). */
  top: number
  /** Raio do monte na base dele. */
  radius: number
  /** Altura do monte acima de `top`. */
  height: number
  /** Proporção altura/raio do monte padrão usado pelas camadas (calda, pó). */
  ratio: number
}

const outerRadius = (m: Measures, z: number) => m.raioFundo + (m.raioBoca - m.raioFundo) * (z / m.altura)

export function domeGeometry(slug: CategorySlug, sizeId: string): Dome {
  const m = measuresFor(slug, sizeId)
  if (!m) throw new Error(`Sem medidas para ${slug} ${sizeId}`)

  const shake = slug === 'milk-shake'
  const ratio = shake ? medidas.monte.shake : medidas.monte.acai
  const top = m.altura * (shake ? 0.9 : 1 - 0.0015 / m.altura)
  return {
    top,
    radius: outerRadius(m, top) - m.parede - GAP,
    height: ratio * (m.raioBoca - m.parede),
    ratio,
  }
}
