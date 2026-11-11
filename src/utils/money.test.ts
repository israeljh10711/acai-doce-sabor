import { describe, expect, it } from 'vitest'
import { formatBRL } from './money.ts'

describe('formatBRL', () => {
  it('formata centavos como reais no padrão brasileiro', () => {
    expect(formatBRL(600)).toBe('R$ 6,00')
    expect(formatBRL(1300)).toBe('R$ 13,00')
    expect(formatBRL(3850)).toBe('R$ 38,50')
  })

  it('usa ponto como separador de milhar', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56')
  })

  it('formata zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })

  it('usa espaço comum entre o símbolo e o valor', () => {
    const nonBreakingSpace = String.fromCharCode(160)

    expect(formatBRL(600)).not.toContain(nonBreakingSpace)
    expect(formatBRL(600).charCodeAt(2)).toBe(32)
  })

  it('formata valores negativos', () => {
    expect(formatBRL(-300)).toBe('-R$ 3,00')
  })

  it('recusa valores que não são centavos inteiros', () => {
    expect(() => formatBRL(6.5)).toThrow(RangeError)
    expect(() => formatBRL(Number.NaN)).toThrow(RangeError)
  })
})
