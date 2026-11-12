import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import vitrine from '../../assets/blender/vitrine.json'
import { CATEGORIES } from '../../src/features/catalog/categories.ts'
import { showcaseOf } from '../../src/features/catalog/showcase.ts'
import { layoutScene } from '../../src/features/configurator-3d/layout.ts'

const SHOWCASE = join(import.meta.dirname, '..', '..', 'src', 'assets', 'showcase')

/**
 * Igualdade com tolerância nos números: o JSON foi gravado pelo navegador, e o motor de
 * JavaScript dele arredonda o último dígito de algumas contas de forma diferente do Node.
 */
function differences(a: unknown, b: unknown, path = ''): string[] {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= 1e-9 ? [] : [`${path}: ${a} != ${b}`]
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a === b ? [] : [`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`]
  }
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: tipos diferentes`]
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].flatMap((key) =>
    differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`),
  )
}

describe('imagens de vitrine da página inicial', () => {
  it.each(CATEGORIES.map((category) => category.slug))('%s: as imagens existem e são leves', (slug) => {
    for (const width of [480, 960]) {
      const file = join(SHOWCASE, `${slug}-${width}.webp`)
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size).toBeLessThan(width === 480 ? 40 * 1024 : 110 * 1024)
    }
  })

  it.each(CATEGORIES.map((category) => category.slug))(
    '%s: o render foi feito com a montagem que o site faz hoje',
    (slug) => {
      // Se falhar, a montagem mudou no site: rode exportar-vitrine.mjs, vitrine.py e vitrine-webp.mjs.
      const current = JSON.parse(JSON.stringify(layoutScene(showcaseOf(slug))))
      expect(differences(vitrine[slug as keyof typeof vitrine].layout, current)).toEqual([])
    },
  )
})
