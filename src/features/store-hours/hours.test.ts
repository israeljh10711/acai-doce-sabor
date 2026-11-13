import { describe, expect, it } from 'vitest'
import { HOURS_TEXT, brasiliaTime, storeStatusAt } from './hours.ts'
import { clockOffset, serverTimeFromHeaders } from './serverClock.ts'

/** Instante a partir da hora de Brasília (UTC-3, sem horário de verão desde 2019). */
const brt = (date: string, time: string) => Date.parse(`${date}T${time}-03:00`)

describe('hora de Brasília', () => {
  it('não depende do fuso do aparelho: lê o fuso America/Sao_Paulo', () => {
    // 16:00 em UTC são 13:00 em Brasília.
    expect(brasiliaTime(Date.parse('2026-11-12T16:00:00Z'))).toEqual({ minutes: 13 * 60, seconds: 0 })
    expect(brasiliaTime(Date.parse('2026-11-13T02:30:15Z'))).toEqual({ minutes: 23 * 60 + 30, seconds: 15 })
  })
})

describe('selo de funcionamento (13h às 21h, todos os dias)', () => {
  it('fechado antes das 13h, avisando que abre hoje', () => {
    const status = storeStatusAt(brt('2026-11-12', '12:59:30'))
    expect(status).toMatchObject({ open: false, title: 'FECHADO AGORA', detail: 'Abrimos hoje às 13h' })
    expect(status.changesAt).toBe(brt('2026-11-12', '13:00:00'))
  })

  it('aberto às 13h em ponto', () => {
    const status = storeStatusAt(brt('2026-11-12', '13:00:00'))
    expect(status).toMatchObject({ open: true, title: 'ABERTO AGORA', detail: 'Entrega rápida em Teixeira' })
    expect(status.changesAt).toBe(brt('2026-11-12', '21:00:00'))
  })

  it('aberto às 20h59', () => {
    expect(storeStatusAt(brt('2026-11-12', '20:59:59')).open).toBe(true)
  })

  it('fechado às 21h em ponto, avisando que abre amanhã', () => {
    const status = storeStatusAt(brt('2026-11-12', '21:00:00'))
    expect(status).toMatchObject({ open: false, detail: 'Abrimos amanhã às 13h' })
    expect(status.changesAt).toBe(brt('2026-11-13', '13:00:00'))
  })

  it('de madrugada abre "hoje", às 13h', () => {
    const status = storeStatusAt(brt('2026-11-13', '00:30:00'))
    expect(status).toMatchObject({ open: false, detail: 'Abrimos hoje às 13h' })
    expect(status.changesAt).toBe(brt('2026-11-13', '13:00:00'))
  })

  it('abre todos os dias da semana, inclusive sábado e domingo', () => {
    // 2026-11-14 é sábado e 2026-11-15 é domingo.
    for (const day of ['2026-11-09', '2026-11-11', '2026-11-14', '2026-11-15']) {
      expect(storeStatusAt(brt(day, '15:00:00')).open).toBe(true)
      expect(storeStatusAt(brt(day, '22:00:00')).open).toBe(false)
    }
  })

  it('muda de estado ao passar das 21h', () => {
    const before = storeStatusAt(brt('2026-11-12', '20:59:00'))
    const after = storeStatusAt(before.changesAt)
    expect([before.open, after.open]).toEqual([true, false])
  })

  it('descreve o horário para o rodapé', () => {
    expect(HOURS_TEXT).toBe('Todos os dias, das 13h às 21h')
  })
})

describe('relógio do servidor', () => {
  it('lê a hora do cabeçalho Date e soma o tempo em cache (Age)', () => {
    const date = 'Thu, 12 Nov 2026 19:00:00 GMT'
    expect(serverTimeFromHeaders(date, null)).toBe(Date.parse(date))
    expect(serverTimeFromHeaders(date, '30')).toBe(Date.parse(date) + 30_000)
    expect(serverTimeFromHeaders(null, null)).toBeNull()
    expect(serverTimeFromHeaders('não é data', null)).toBeNull()
  })

  it('corrige um aparelho com o relógio 5 horas atrasado', () => {
    const server = Date.parse('2026-11-12T19:00:00Z')
    const local = server - 5 * 3600_000
    const offset = clockOffset(server, local - 100, local + 100)
    // Diferença de 5 horas, com erro menor que um segundo (o cabeçalho só tem segundos).
    expect(Math.abs(offset - 5 * 3600_000)).toBeLessThan(1000)
    // Com a correção, o selo usa a hora certa: 16:00 em Brasília, aberto. Sem ela, 11:00, fechado.
    expect(storeStatusAt(local + offset).open).toBe(true)
    expect(storeStatusAt(local).open).toBe(false)
  })
})
