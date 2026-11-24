import { describe, expect, it, vi } from 'vitest'
import { HOURS_TEXT, atText, brasiliaTime, effectiveStatus, hoursText, overrideFor, storeStatusAt } from './hours.ts'
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from '../store/storeSettings.ts'
import { clockOffset, serverNow, serverTimeFromDateHeader, syncServerClock } from './serverClock.ts'
import { elapsedText } from '../orders/ordersPanel.ts'

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
  it('lê a data da resposta e rejeita uma data ausente ou inválida', () => {
    const date = 'Thu, 12 Nov 2026 19:00:00 GMT'
    expect(serverTimeFromDateHeader(date)).toBe(Date.parse(date))
    expect(serverTimeFromDateHeader(null)).toBeNull()
    expect(serverTimeFromDateHeader('não é data')).toBeNull()
  })

  it('um pedido das 13h30 mostra 3 min às 13h33 de Brasília, mesmo com HTML em cache na Vercel', async () => {
    const now = Date.parse('2026-11-24T16:33:43Z')
    const device = vi.spyOn(Date, 'now').mockReturnValue(now + 5 * 3_600_000)
    try {
      const headers = { Date: new Date(now).toUTCString(), Age: '7390' }
      expect(await syncServerClock(async () => new Response(null, { headers }))).toBe(true)
      expect(brasiliaTime(serverNow()).minutes).toBe(13 * 60 + 33)
      expect(elapsedText(Date.parse('2026-11-24T16:30:43Z'), serverNow())).toBe('Há 3 min')
    } finally {
      device.mockRestore()
      await syncServerClock(async () => new Response(null, { headers: { Date: new Date().toUTCString() } }))
    }
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

const HOURS = DEFAULT_STORE_SETTINGS.hours
const settings = (patch: Partial<StoreSettings> = {}): StoreSettings => ({ ...DEFAULT_STORE_SETTINGS, ...patch })

describe('interruptor do vendedor (1A, pedido de 2026-11-17): exceção ao horário', () => {
  it('"Fechar" vale até a abertura do dia seguinte, de manhã, à tarde ou depois da meia-noite', () => {
    expect(overrideFor('close', brt('2026-11-17', '15:00:00'), HOURS)).toEqual({ state: 'closed', until: brt('2026-11-18', '13:00:00') })
    expect(overrideFor('close', brt('2026-11-17', '10:00:00'), HOURS)).toEqual({ state: 'closed', until: brt('2026-11-18', '13:00:00') })
    // 01:00 do dia 18 ainda é a noite do dia 17: abre às 13h do dia 18.
    expect(overrideFor('close', brt('2026-11-18', '01:00:00'), HOURS)).toEqual({ state: 'closed', until: brt('2026-11-18', '13:00:00') })
  })

  it('"Abrir" antes do horário vale até o fechamento; depois do fechamento, até as 5h; dentro do horário, volta ao horário', () => {
    expect(overrideFor('open', brt('2026-11-17', '11:00:00'), HOURS)).toEqual({ state: 'open', until: brt('2026-11-17', '21:00:00') })
    expect(overrideFor('open', brt('2026-11-17', '22:00:00'), HOURS)).toEqual({ state: 'open', until: brt('2026-11-18', '05:00:00') })
    expect(overrideFor('open', brt('2026-11-18', '01:00:00'), HOURS)).toEqual({ state: 'open', until: brt('2026-11-18', '05:00:00') })
    expect(overrideFor('open', brt('2026-11-17', '15:00:00'), HOURS)).toBeNull()
  })

  it('sem interruptor vale o horário, com o prazo de entrega no selo', () => {
    expect(effectiveStatus(brt('2026-11-17', '15:00:00'), settings())).toMatchObject({
      open: true,
      title: 'ABERTO AGORA',
      detail: 'Entrega: 30–45 min',
      manual: false,
      reopenText: null,
    })
    expect(effectiveStatus(brt('2026-11-17', '22:00:00'), settings({ deliveryTime: '45–60 min' }))).toMatchObject({
      open: false,
      title: 'FECHADO AGORA',
      detail: 'Abrimos amanhã às 13h',
      manual: false,
      reopenText: 'amanhã a partir das 13h',
      reopensAt: brt('2026-11-18', '13:00:00'),
    })
  })

  it('fechada pelo vendedor às 15h: fechada até amanhã às 13h; depois disso, o horário volta a valer', () => {
    const now = brt('2026-11-17', '15:00:00')
    const closed = settings({ override: overrideFor('close', now, HOURS) })
    expect(effectiveStatus(now, closed)).toMatchObject({
      open: false,
      manual: true,
      detail: 'Abrimos amanhã às 13h',
      reopenText: 'amanhã a partir das 13h',
      changesAt: brt('2026-11-18', '13:00:00'),
    })
    expect(effectiveStatus(brt('2026-11-17', '20:00:00'), closed).open).toBe(false)
    expect(effectiveStatus(brt('2026-11-18', '13:00:00'), closed)).toMatchObject({ open: true, manual: false })
  })

  it('fechada depois da meia-noite: reabre "hoje" às 13h', () => {
    const now = brt('2026-11-18', '01:00:00')
    expect(effectiveStatus(now, settings({ override: overrideFor('close', now, HOURS) }))).toMatchObject({
      open: false,
      reopenText: 'hoje a partir das 13h',
    })
  })

  it('aberta pelo vendedor às 22h: aberta com o prazo do vendedor até as 5h', () => {
    const now = brt('2026-11-17', '22:00:00')
    const opened = settings({ deliveryTime: '45–60 min', override: overrideFor('open', now, HOURS) })
    expect(effectiveStatus(now, opened)).toMatchObject({ open: true, manual: true, detail: 'Entrega: 45–60 min', changesAt: brt('2026-11-18', '05:00:00') })
    expect(effectiveStatus(brt('2026-11-18', '05:00:00'), opened)).toMatchObject({ open: false, manual: false })
  })

  it('horário editado pelo vendedor (14h à meia-noite)', () => {
    const late = settings({ hours: { opensAt: 14 * 60, closesAt: 24 * 60 } })
    expect(effectiveStatus(brt('2026-11-17', '23:30:00'), late).open).toBe(true)
    expect(effectiveStatus(brt('2026-11-18', '00:10:00'), late)).toMatchObject({ open: false, detail: 'Abrimos hoje às 14h' })
    expect(effectiveStatus(brt('2026-11-17', '13:59:00'), late).open).toBe(false)
  })

  it('quando o interruptor acaba, em texto: "hoje às 21h", "amanhã às 13h"', () => {
    expect(atText(brt('2026-11-17', '11:00:00'), brt('2026-11-17', '21:00:00'))).toBe('hoje às 21h')
    expect(atText(brt('2026-11-17', '15:00:00'), brt('2026-11-18', '13:00:00'))).toBe('amanhã às 13h')
    expect(atText(brt('2026-11-17', '22:00:00'), brt('2026-11-18', '05:00:00'))).toBe('amanhã às 5h')
  })

  it('texto do horário com minutos e meia-noite', () => {
    expect(hoursText({ opensAt: 13 * 60 + 30, closesAt: 21 * 60 })).toBe('Todos os dias, das 13h30 às 21h')
    expect(hoursText({ opensAt: 14 * 60, closesAt: 24 * 60 })).toBe('Todos os dias, das 14h à meia-noite')
    expect(hoursText(HOURS)).toBe(HOURS_TEXT)
  })
})
