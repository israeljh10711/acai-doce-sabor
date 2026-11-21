import { describe, expect, it } from 'vitest'
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from '../store/storeSettings.ts'
import { effectiveStatus, hoursText, overrideFor, scheduleText, storeStatusAt } from './hours.ts'

/** Instante a partir da hora de Brasília (UTC-3, sem horário de verão desde 2019). */
const brt = (date: string, time: string) => Date.parse(`${date}T${time}-03:00`)
const day = (open: boolean, ...periods: [number, number][]) => ({ open, periods: periods.map(([opensAt, closesAt]) => ({ opensAt, closesAt })) })

describe('horário por dia da semana (cardápio dinâmico, 2026-11-21)', () => {
  // 2026-11-21 é sábado; 2026-11-22, domingo; 2026-11-23, segunda.
  const week = [
    day(false), // domingo fechado
    day(true, [13 * 60, 21 * 60]),
    day(true, [13 * 60, 21 * 60]),
    day(true, [13 * 60, 21 * 60]),
    day(true, [13 * 60, 21 * 60]),
    day(true, [13 * 60, 21 * 60]),
    day(true, [11 * 60, 14 * 60], [18 * 60, 23 * 60]), // sábado: almoço e noite
  ]
  const settings: StoreSettings = { ...DEFAULT_STORE_SETTINGS, week }

  it('abre e fecha nos períodos do dia', () => {
    expect(storeStatusAt(brt('2026-11-21', '12:00:00'), settings.hours, week).open).toBe(true)
    const between = storeStatusAt(brt('2026-11-21', '15:00:00'), settings.hours, week)
    expect(between).toMatchObject({ open: false, detail: 'Abrimos hoje às 18h' })
    expect(between.changesAt).toBe(brt('2026-11-21', '18:00:00'))
    expect(storeStatusAt(brt('2026-11-21', '22:30:00'), settings.hours, week).open).toBe(true)
  })

  it('pula o dia fechado: depois de sábado à noite, abre segunda', () => {
    const status = storeStatusAt(brt('2026-11-21', '23:30:00'), settings.hours, week)
    expect(status).toMatchObject({ open: false, detail: 'Abrimos segunda-feira às 13h' })
    expect(status.changesAt).toBe(brt('2026-11-23', '13:00:00'))
    expect(effectiveStatus(brt('2026-11-22', '15:00:00'), settings)).toMatchObject({ open: false, reopenText: 'amanhã a partir das 13h' })
  })

  it('sem nenhum dia aberto, fica fechada', () => {
    const closed = Array.from({ length: 7 }, () => day(false))
    expect(storeStatusAt(brt('2026-11-21', '15:00:00'), settings.hours, closed)).toMatchObject({ open: false, detail: 'Sem horário de abertura' })
  })

  it('sem horário por dia, nada muda (13h às 21h todos os dias)', () => {
    expect(storeStatusAt(brt('2026-11-22', '15:00:00'), DEFAULT_STORE_SETTINGS.hours, null).open).toBe(true)
  })

  it('"Fechar agora" vale até a próxima abertura depois de hoje', () => {
    expect(overrideFor('close', brt('2026-11-21', '12:00:00'), settings.hours, week)).toEqual({ state: 'closed', until: brt('2026-11-23', '13:00:00') })
  })

  it('"Abrir agora" fora do período vale até o fim do próximo período do dia', () => {
    expect(overrideFor('open', brt('2026-11-21', '15:00:00'), settings.hours, week)).toEqual({ state: 'open', until: brt('2026-11-21', '23:00:00') })
    expect(overrideFor('open', brt('2026-11-21', '12:00:00'), settings.hours, week)).toBeNull()
  })
})

describe('horário em texto', () => {
  it('junta os dias iguais, segunda primeiro', () => {
    const week = [day(false), ...Array.from({ length: 5 }, () => day(true, [13 * 60, 21 * 60])), day(true, [14 * 60, 24 * 60])]
    expect(scheduleText({ hours: DEFAULT_STORE_SETTINGS.hours, week })).toBe('Seg a Sex: 13h às 21h · Sáb: 14h às 0h · Dom: fechado')
    expect(scheduleText({ hours: DEFAULT_STORE_SETTINGS.hours, week: null })).toBe(hoursText(DEFAULT_STORE_SETTINGS.hours))
    expect(scheduleText({ hours: DEFAULT_STORE_SETTINGS.hours, week: Array.from({ length: 7 }, () => day(true, [13 * 60, 21 * 60])) })).toBe('Todos os dias, das 13h às 21h')
  })
})
