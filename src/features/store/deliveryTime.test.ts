import { describe, expect, it } from 'vitest'
import { DELIVERY_TIMES } from './storeSettings.ts'
import { deliveryWindow } from './deliveryTime.ts'

describe('o "Tempo" de entrega da loja em minutos (2026-11-21)', () => {
  it('as opções do botão "Tempo"', () => {
    expect(DELIVERY_TIMES.map(deliveryWindow)).toEqual([
      { min: 20, max: 35 },
      { min: 30, max: 45 },
      { min: 45, max: 60 },
      { min: 60, max: 80 },
    ])
  })

  it('o que o vendedor costuma digitar', () => {
    expect(deliveryWindow('50 min')).toEqual({ min: 50, max: 50 })
    expect(deliveryWindow('30 a 40 minutos')).toEqual({ min: 30, max: 40 })
    expect(deliveryWindow('30-45')).toEqual({ min: 30, max: 45 })
    expect(deliveryWindow('1 hora')).toEqual({ min: 60, max: 60 })
    expect(deliveryWindow('1 a 2 horas')).toEqual({ min: 60, max: 120 })
    expect(deliveryWindow('1h30')).toEqual({ min: 90, max: 90 })
    expect(deliveryWindow(' 1 h 15 min ')).toEqual({ min: 75, max: 75 })
  })

  it('o que não dá para ler com segurança: nada (nunca um número inventado)', () => {
    for (const text of ['', 'rápido', 'depende do bairro', '45–30 min', '0 min', '15 horas', '30 min a 1 hora']) {
      expect([text, deliveryWindow(text)]).toEqual([text, null])
    }
  })
})
