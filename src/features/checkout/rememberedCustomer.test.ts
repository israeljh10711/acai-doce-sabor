import { describe, expect, it } from 'vitest'
import { type CustomerDraft, EMPTY_CUSTOMER } from './delivery.ts'
import { REMEMBERED_KEY, forgetRemembered, initialCustomer, loadRemembered, saveRemembered } from './rememberedCustomer.ts'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const MARIA: CustomerDraft = {
  ...EMPTY_CUSTOMER,
  name: 'Maria',
  phone: '(83) 99999-0000',
  kind: 'entrega',
  street: 'Rua das Flores',
  number: '12A',
  district: '',
  zoneId: 'centro',
  reference: 'portão azul',
  gps: { lat: -7.22, lng: -37.25 },
}

describe('lembrar meus dados neste dispositivo (2026-11-21)', () => {
  it('guarda só nome, telefone e endereço: sem modalidade, sem GPS, sem nada além disso', () => {
    const storage = memoryStorage()
    saveRemembered(storage, MARIA)
    const stored = JSON.parse(storage.data.get(REMEMBERED_KEY) ?? '{}')
    expect(Object.keys(stored).sort()).toEqual(['district', 'name', 'number', 'phone', 'reference', 'street', 'zoneId'])
    expect(loadRemembered(storage)).toEqual({ name: 'Maria', phone: '(83) 99999-0000', street: 'Rua das Flores', number: '12A', district: '', zoneId: 'centro', reference: 'portão azul' })
  })

  it('atualiza quando o cliente muda os dados; desmarcar apaga', () => {
    const storage = memoryStorage()
    saveRemembered(storage, MARIA)
    saveRemembered(storage, { ...MARIA, phone: '(83) 98888-1111' })
    expect(loadRemembered(storage)?.phone).toBe('(83) 98888-1111')
    forgetRemembered(storage)
    expect([storage.data.has(REMEMBERED_KEY), loadRemembered(storage)]).toEqual([false, null])
  })

  it('nada guardado, valor estragado, campos de tipo errado, ou tudo vazio: nada para preencher', () => {
    const storage = memoryStorage()
    expect(loadRemembered(storage)).toBeNull()
    storage.setItem(REMEMBERED_KEY, '{quebrado')
    expect(loadRemembered(storage)).toBeNull()
    storage.setItem(REMEMBERED_KEY, JSON.stringify({ name: 42, token: 'x' }))
    expect(loadRemembered(storage)).toBeNull()
    saveRemembered(storage, EMPTY_CUSTOMER)
    expect(storage.data.has(REMEMBERED_KEY)).toBe(false)
  })

  it('armazenamento bloqueado ou cheio: não guarda e não quebra', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('cheio')
      },
      removeItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(() => saveRemembered(broken, MARIA)).not.toThrow()
    expect(() => forgetRemembered(broken)).not.toThrow()
    expect(loadRemembered(broken)).toBeNull()
    expect(loadRemembered(null)).toBeNull()
  })

  it('ao abrir: o que já foi digitado nesta aba vale mais que os dados lembrados', () => {
    const remembered = { name: 'Maria', phone: '(83) 99999-0000', street: 'Rua das Flores', number: '12A', district: '', zoneId: 'centro', reference: '' }
    const typed = { ...EMPTY_CUSTOMER, name: 'Maria Souza', kind: 'retirada' as const }
    expect(initialCustomer(typed, remembered)).toEqual(typed)
    // Aba nova (nada digitado): preenche, mas a modalidade fica para o cliente escolher.
    expect(initialCustomer(EMPTY_CUSTOMER, remembered)).toEqual({ ...EMPTY_CUSTOMER, ...remembered })
    expect(initialCustomer(EMPTY_CUSTOMER, null)).toEqual(EMPTY_CUSTOMER)
  })
})
