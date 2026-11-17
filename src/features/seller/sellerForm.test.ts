import { describe, expect, it } from 'vitest'
import { fitWithin, formatPriceInput, newId, parseFlavors, parsePriceInput } from './sellerForm.ts'

describe('formulário do vendedor: contas e textos', () => {
  it('preço em reais: "3,00", "3.5", "3" e "R$ 12,90" viram centavos; vazio e texto, não', () => {
    expect(['3,00', '3.5', '3', 'R$ 12,90', ' 0,00 ', '1.234,56'].map(parsePriceInput)).toEqual([300, 350, 300, 1290, 0, 123456])
    expect(['', 'abc', '-2', '3,999'].map(parsePriceInput)).toEqual([null, null, null, null])
  })

  it('centavos voltam para o campo como "3,00"', () => {
    expect([300, 1290, 0, 123456].map(formatPriceInput)).toEqual(['3,00', '12,90', '0,00', '1234,56'])
  })

  it('sabores separados por vírgula, sem espaços sobrando nem repetidos', () => {
    expect(parseFlavors(' Chocolate, Morango ,, Maracujá, morango ')).toEqual(['Chocolate', 'Morango', 'Maracujá'])
    expect(parseFlavors('  ')).toEqual([])
  })

  it('foto: no máximo 800 px no lado maior, sem ampliar', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 600, height: 800 })
    expect(fitWithin(500, 300)).toEqual({ width: 500, height: 300 })
  })

  it('id de item novo: "novo-" + nome simplificado + sufixo', () => {
    expect(newId('Picolé trufado!', () => 'ab12')).toBe('novo-picole-trufado-ab12')
  })
})
