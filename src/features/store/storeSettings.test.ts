import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STORE_SETTINGS,
  DELIVERY_TIMES,
  parseStoreSettings,
  parseStoreSettingsChange,
  storeAddressText,
} from './storeSettings.ts'

describe('configurações da loja (pedido de 2026-11-17)', () => {
  it('sem nada guardado, vale o padrão: 13h às 21h, 30–45 min, entrega a combinar e o contato da loja', () => {
    expect(parseStoreSettings(undefined)).toEqual({
      hours: { opensAt: 13 * 60, closesAt: 21 * 60 },
      override: null,
      deliveryTime: '30–45 min',
      closedOrders: 'antecipado',
      delivery: { mode: 'combinar', zones: [] },
      contact: { whatsapp: '(83) 99699-9980', street: 'Rua Francisco Tota, 12', city: 'Teixeira', uf: 'PB' },
    })
    expect(parseStoreSettings(undefined)).toEqual(DEFAULT_STORE_SETTINGS)
    expect(DELIVERY_TIMES).toEqual(['20–35 min', '30–45 min', '45–60 min', '60–80 min'])
  })

  it('campo inválido volta ao padrão sem derrubar os outros', () => {
    const settings = parseStoreSettings({
      deliveryTime: '   ',
      closedOrders: 'talvez',
      delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] },
    })
    expect(settings.deliveryTime).toBe('30–45 min')
    expect(settings.closedOrders).toBe('antecipado')
    expect(settings.delivery).toEqual({ mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] })
    expect(parseStoreSettings({ closedOrders: 'bloquear', deliveryTime: ' 1 hora ' })).toMatchObject({ closedOrders: 'bloquear', deliveryTime: '1 hora' })
  })

  it('bairro sem nome, com valor inválido ou com id repetido sai da lista; modo desconhecido volta a "a combinar"', () => {
    const { delivery } = parseStoreSettings({
      delivery: {
        mode: 'taxas',
        zones: [
          { id: 'centro', name: 'Centro', feeCents: 300 },
          { id: 'sem-nome', name: '  ', feeCents: 300 },
          { id: 'negativo', name: 'Alto', feeCents: -100 },
          { id: 'quebrado', name: 'Baixo', feeCents: 2.5 },
          { id: 'centro', name: 'Centro de novo', feeCents: 500 },
          { id: 'longe', name: 'Bairros afastados', feeCents: 500 },
        ],
      },
    })
    expect(delivery.zones).toEqual([
      { id: 'centro', name: 'Centro', feeCents: 300 },
      { id: 'longe', name: 'Bairros afastados', feeCents: 500 },
    ])
    expect(parseStoreSettings({ delivery: { mode: 'frete', zones: [] } }).delivery).toEqual({ mode: 'combinar', zones: [] })
    expect(parseStoreSettings({ delivery: { mode: 'gratis' } }).delivery).toEqual({ mode: 'gratis', zones: [] })
  })

  it('horário: abertura a partir das 5h e fechamento depois dela, até a meia-noite', () => {
    expect(parseStoreSettings({ hours: { opensAt: 14 * 60, closesAt: 24 * 60 } }).hours).toEqual({ opensAt: 840, closesAt: 1440 })
    expect(parseStoreSettings({ hours: { opensAt: 4 * 60, closesAt: 21 * 60 } }).hours).toEqual(DEFAULT_STORE_SETTINGS.hours)
    expect(parseStoreSettings({ hours: { opensAt: 900, closesAt: 900 } }).hours).toEqual(DEFAULT_STORE_SETTINGS.hours)
    expect(parseStoreSettings({ hours: { opensAt: 900, closesAt: 1500 } }).hours).toEqual(DEFAULT_STORE_SETTINGS.hours)
    expect(parseStoreSettings({ hours: { opensAt: 780.5, closesAt: 1260 } }).hours).toEqual(DEFAULT_STORE_SETTINGS.hours)
  })

  it('interruptor: precisa de estado e prazo válidos; null é "sem interruptor"', () => {
    const until = Date.UTC(2026, 10, 18, 16)
    expect(parseStoreSettings({ override: { state: 'closed', until } }).override).toEqual({ state: 'closed', until })
    expect(parseStoreSettings({ override: { state: 'open', until } }).override).toEqual({ state: 'open', until })
    expect(parseStoreSettings({ override: { state: 'closed' } }).override).toBeNull()
    expect(parseStoreSettings({ override: { state: 'aberta', until } }).override).toBeNull()
    expect(parseStoreSettings({ override: null }).override).toBeNull()
  })

  it('contato: o WhatsApp precisa ser um telefone com DDD e fica no formato (83) 99699-9980; UF com 2 letras', () => {
    expect(parseStoreSettings({ contact: { whatsapp: '123', street: 'Rua Nova, 5', city: '', uf: 'pb' } }).contact).toEqual({
      whatsapp: '(83) 99699-9980',
      street: 'Rua Nova, 5',
      city: 'Teixeira',
      uf: 'PB',
    })
    expect(parseStoreSettings({ contact: { whatsapp: '+55 83 98888-7777' } }).contact.whatsapp).toBe('(83) 98888-7777')
    expect(parseStoreSettings({ contact: { uf: 'Paraíba' } }).contact.uf).toBe('PB')
  })

  it('a mudança guardada leva só os campos válidos (null no interruptor vale)', () => {
    expect(parseStoreSettingsChange({ deliveryTime: '45–60 min', nada: 1, override: null, closedOrders: 'x' })).toEqual({
      deliveryTime: '45–60 min',
      override: null,
    })
    expect(parseStoreSettingsChange('qualquer coisa')).toEqual({})
  })

  it('endereço da loja numa linha', () => {
    expect(storeAddressText(DEFAULT_STORE_SETTINGS.contact)).toBe('Rua Francisco Tota, 12, Teixeira, PB')
  })
})
