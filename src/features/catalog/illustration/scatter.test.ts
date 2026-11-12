import { describe, expect, it } from 'vitest'
import { scatter } from './scatter.ts'

const area = { cx: 120, cy: 90, rx: 40, ry: 12 }

describe('scatter', () => {
  it('devolve a quantidade pedida de pontos', () => {
    expect(scatter('granola', 9, area)).toHaveLength(9)
    expect(scatter('granola', 0, area)).toEqual([])
  })

  it('devolve sempre os mesmos pontos para a mesma semente', () => {
    expect(scatter('granola', 12, area)).toEqual(scatter('granola', 12, area))
  })

  it('devolve pontos diferentes para sementes diferentes', () => {
    expect(scatter('granola', 6, area)).not.toEqual(scatter('pacoca', 6, area))
  })

  it('mantém todos os pontos dentro da elipse', () => {
    for (const seed of ['granola', 'pacoca', 'kiwi', 'calda-acai']) {
      for (const point of scatter(seed, 30, area)) {
        const inside = ((point.x - area.cx) / area.rx) ** 2 + ((point.y - area.cy) / area.ry) ** 2
        expect(inside).toBeLessThanOrEqual(1)
        expect(point.r).toBeGreaterThanOrEqual(0)
        expect(point.r).toBeLessThan(360)
      }
    }
  })
})
