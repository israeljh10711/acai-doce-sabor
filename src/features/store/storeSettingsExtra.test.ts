import { describe, expect, it } from 'vitest'
import { DEFAULT_STORE_SETTINGS, activeZones, enabledPayments, parseStoreSettings, pixKeyProblem } from './storeSettings.ts'

describe('identidade, Pix, pagamento, bairros e horário por dia (cardápio dinâmico, 2026-11-21)', () => {
  it('lê a identidade campo a campo', () => {
    const settings = parseStoreSettings({ identity: { name: 'Açaí da Praça', slogan: 'O melhor da cidade', instagram: '@acaidapraca', phone: '83 3333-4444' } })
    expect(settings.identity).toMatchObject({ name: 'Açaí da Praça', slogan: 'O melhor da cidade', instagram: 'acaidapraca', phone: '(83) 3333-4444' })
    expect(settings.identity.subtitle).toBe(DEFAULT_STORE_SETTINGS.identity.subtitle)
    expect(parseStoreSettings({ identity: { instagram: 'com espaço' } }).identity.instagram).toBe(DEFAULT_STORE_SETTINGS.identity.instagram)
  })

  it('confere a chave Pix pelo tipo', () => {
    expect(pixKeyProblem('cpf', '123.456.789-09')).toBeNull()
    expect(pixKeyProblem('cpf', '123')).toMatch(/11 números/)
    expect(pixKeyProblem('cnpj', '12.345.678/0001-90')).toBeNull()
    expect(pixKeyProblem('email', 'loja@exemplo.com')).toBeNull()
    expect(pixKeyProblem('email', 'sem-arroba')).not.toBeNull()
    expect(pixKeyProblem('telefone', '(83) 99699-9980')).toBeNull()
    expect(pixKeyProblem('aleatoria', '123e4567-e89b-12d3-a456-426614174000')).toBeNull()
    expect(pixKeyProblem('aleatoria', 'qualquer')).not.toBeNull()
    // Chave inválida com o Pix ligado: fica a do padrão.
    expect(parseStoreSettings({ pix: { enabled: true, type: 'cpf', key: '1', holder: 'X' } }).pix).toEqual(DEFAULT_STORE_SETTINGS.pix)
    expect(parseStoreSettings({ pix: { enabled: false, type: 'cpf', key: '', holder: '' } }).pix.enabled).toBe(false)
  })

  it('formas de pagamento: pelo menos uma ligada; o Pix sai sem a chave ligada', () => {
    expect(parseStoreSettings({ payments: { pix: false, dinheiro: false, cartao: false } }).payments).toEqual(DEFAULT_STORE_SETTINGS.payments)
    expect(enabledPayments(parseStoreSettings({ payments: { pix: true, dinheiro: false, cartao: true } }))).toEqual(['pix', 'cartao'])
    expect(enabledPayments(parseStoreSettings({ pix: { enabled: false, type: 'cpf', key: '', holder: '' } }))).toEqual(['dinheiro', 'cartao'])
  })

  it('bairro desligado sai da lista do cliente, sem perder a taxa', () => {
    const settings = parseStoreSettings({
      delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }, { id: 'alto', name: 'Alto', feeCents: 500, active: false }] },
    })
    expect(settings.delivery.zones[1]).toEqual({ id: 'alto', name: 'Alto', feeCents: 500, active: false })
    expect(activeZones(settings).map((zone) => zone.id)).toEqual(['centro'])
  })

  it('horário por dia: 7 dias, períodos em ordem e sem se sobrepor', () => {
    const day = { open: true, periods: [{ opensAt: 11 * 60, closesAt: 14 * 60 }, { opensAt: 18 * 60, closesAt: 23 * 60 }] }
    const week = Array.from({ length: 7 }, () => day)
    expect(parseStoreSettings({ week }).week).toEqual(week)
    expect(parseStoreSettings({ week: week.slice(0, 6) }).week).toBeNull()
    const overlap = { open: true, periods: [{ opensAt: 11 * 60, closesAt: 15 * 60 }, { opensAt: 14 * 60, closesAt: 23 * 60 }] }
    expect(parseStoreSettings({ week: Array.from({ length: 7 }, () => overlap) }).week).toBeNull()
    expect(parseStoreSettings({ week: Array.from({ length: 7 }, () => ({ open: true, periods: [] })) }).week).toBeNull()
  })
})
