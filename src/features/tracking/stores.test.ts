import { describe, expect, it } from 'vitest'
import { ADD_MODE_KEY, ADD_MODE_MAX_MS, createAddMode } from './addMode.ts'
import { ATTEMPTS_KEY, createAttempts, newAttemptId } from './attempts.ts'
import { createTrackedOrders } from './trackedOrders.ts'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('tentativas de finalizar e de acrescentar (2026-11-20)', () => {
  it('o mesmo conteúdo reaproveita o id (o "Tentar de novo"); conteúdo novo, id novo', () => {
    let n = 0
    const attempts = createAttempts(memoryStorage(), () => `id-sorteado-${++n}-0000000000`)
    const first = attempts.idFor('pedido', 'carrinho-A')
    expect(attempts.idFor('pedido', 'carrinho-A')).toBe(first)
    const second = attempts.idFor('pedido', 'carrinho-B')
    expect(second).not.toBe(first)
    // Cada escopo tem a sua (o pedido e o acréscimo de um pedido não se misturam).
    expect(attempts.idFor('acrescimo:x', 'carrinho-B')).not.toBe(second)
  })

  it('depois de confirmado, o mesmo carrinho de novo é outra tentativa (outro pedido)', () => {
    let n = 0
    const attempts = createAttempts(memoryStorage(), () => `id-sorteado-${++n}-0000000000`)
    const first = attempts.idFor('pedido', 'carrinho-A')
    attempts.done('pedido')
    expect(attempts.idFor('pedido', 'carrinho-A')).not.toBe(first)
  })

  it('sobrevive a recarregar a página (guardado na aba) e funciona sem armazenamento', () => {
    const storage = memoryStorage()
    const first = createAttempts(storage, () => 'aaaaaaaaaaaaaaaaaaaa').idFor('pedido', 'k')
    expect(createAttempts(storage, () => 'bbbbbbbbbbbbbbbbbbbb').idFor('pedido', 'k')).toBe(first)
    expect(storage.data.has(ATTEMPTS_KEY)).toBe(true)
    const offline = createAttempts(null, () => 'cccccccccccccccccccc')
    expect(offline.idFor('pedido', 'k')).toBe(offline.idFor('pedido', 'k'))
  })

  it('o id sempre passa na regra do servidor (16 a 64 letras, números e hífen)', () => {
    for (const random of ['f47ac10b-58cc-4372-a567-0e02b2c3d479', 'curto', 'com espaço e ç!', 'x'.repeat(90)]) {
      expect(newAttemptId(() => random)).toMatch(/^[A-Za-z0-9-]{16,64}$/)
    }
  })
})

describe('modo de adição (2026-11-20)', () => {
  it('liga com o pedido, desliga, e avisa quem está olhando', () => {
    const now = 1_000
    const storage = memoryStorage()
    const mode = createAddMode(storage, () => now)
    let calls = 0
    mode.subscribe(() => calls++)
    expect(mode.get()).toBeNull()
    mode.start({ id: 'uuid-1', code: 'ADS-0001' })
    expect(mode.get()).toEqual({ orderId: 'uuid-1', code: 'ADS-0001', startedAt: 1_000 })
    // A mesma referência enquanto nada muda (a tela compara por ela).
    expect(mode.get()).toBe(mode.get())
    expect(JSON.parse(storage.data.get(ADD_MODE_KEY) ?? '{}')).not.toHaveProperty('token')
    mode.stop()
    expect([mode.get(), calls]).toEqual([null, 2])
  })

  it('esquecido ligado por mais de 3 horas: desliga sozinho', () => {
    let now = 0
    const mode = createAddMode(memoryStorage(), () => now)
    mode.start({ id: 'uuid-1', code: 'ADS-0001' })
    now = ADD_MODE_MAX_MS + 1
    mode.changed()
    expect(mode.get()).toBeNull()
  })

  it('valor estragado no armazenamento: desligado', () => {
    const storage = memoryStorage()
    storage.setItem(ADD_MODE_KEY, '{quebrado')
    expect(createAddMode(storage, () => 0).get()).toBeNull()
  })
})

describe('pedidos deste aparelho sem armazenamento (2026-11-20)', () => {
  it('a lista fica na memória e é a mesma referência enquanto nada muda', () => {
    const tracked = createTrackedOrders(null, () => Date.parse('2026-11-20T19:00:00.000Z'))
    tracked.upsert({ id: 'a', code: 'ADS-0001', createdAt: '2026-11-20T18:00:00.000Z', status: 'novo', fulfillment: 'local', demo: false, tracked: true })
    expect(tracked.list()).toBe(tracked.list())
    expect(tracked.list().map((order) => order.code)).toEqual(['ADS-0001'])
  })
})
