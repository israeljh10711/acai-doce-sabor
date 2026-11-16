import { describe, expect, it } from 'vitest'
import { productInfo } from './productInfo.ts'

describe('volta do personalizador para o cardápio', () => {
  it('os produtos das seções voltam para a seção deles (âncoras de 2026-11-16)', () => {
    expect(productInfo('barca-de-acai').menuPath).toBe('/monte-seu-pedido#secao-barcas-potes')
    expect(productInfo('pote-de-acai-1-litro').continuePath).toBe('/monte-seu-pedido#secao-combos')
  })

  it('os 4 produtos principais voltam para o cardápio, sem âncora', () => {
    expect(productInfo('acai-oca').menuPath).toBe('/monte-seu-pedido')
    expect(productInfo('milk-shake').continuePath).toBe('/monte-seu-pedido')
  })
})
