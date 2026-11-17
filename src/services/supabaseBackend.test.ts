import { describe, expect, it } from 'vitest'
import { changesFromRows } from './supabaseBackend.ts'

describe('linhas do Supabase → mudanças', () => {
  it('lê as configurações da loja (tipo "settings", id "loja")', () => {
    const changes = changesFromRows([
      { kind: 'settings', id: 'loja', data: { deliveryTime: '20–35 min', closedOrders: 'bloquear' } },
      { kind: 'items', id: 'jujuba', data: { available: false } },
    ])
    expect(changes.settings).toEqual({ loja: { deliveryTime: '20–35 min', closedOrders: 'bloquear' } })
    expect(changes.items).toEqual({ jujuba: { available: false } })
  })
})
