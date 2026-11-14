import { describe, expect, it } from 'vitest'
import { startingPriceCents } from './showcase.ts'

describe('vitrine', () => {
  it('mostra o menor preço real de cada categoria', () => {
    expect(startingPriceCents('acai-oca')).toBe(1000)
    expect(startingPriceCents('acai-tradicional')).toBe(600)
    expect(startingPriceCents('acai-batido')).toBe(1000)
    expect(startingPriceCents('milk-shake')).toBe(1000)
  })
})
