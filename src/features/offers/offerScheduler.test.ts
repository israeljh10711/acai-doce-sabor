import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_MEMORY,
  MAX_DISMISSALS,
  OFFER_STORAGE_KEY,
  OFFER_TIMING,
  OfferScheduler,
  type StorageLike,
  nextOffer,
  randomGap,
  readMemory,
  shuffle,
} from './offerScheduler.ts'

const IDS = Array.from({ length: 12 }, (_, index) => `oferta-${index + 1}`)

/** Sorteio previsível (mulberry32) para os testes. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) }
}

describe('sorteio em saco', () => {
  it('embaralhar não perde nem repete itens', () => {
    expect(shuffle(IDS, seeded(1)).sort()).toEqual([...IDS].sort())
  })

  it('passa pelas 12 antes de repetir e nunca mostra a mesma duas vezes seguidas', () => {
    for (const seed of [1, 2, 3, 42, 2026]) {
      const random = seeded(seed)
      let memory = { bag: [] as string[], last: null as string | null }
      const shown: string[] = []
      for (let i = 0; i < 12 * 50; i++) {
        const { id, bag } = nextOffer(IDS, memory, random)
        shown.push(id)
        memory = { bag, last: id }
      }
      for (let i = 1; i < shown.length; i++) expect(shown[i], `semente ${seed}, posição ${i}`).not.toBe(shown[i - 1])
      for (let cycle = 0; cycle < 50; cycle++) {
        expect(new Set(shown.slice(cycle * 12, cycle * 12 + 12)).size, `semente ${seed}, ciclo ${cycle}`).toBe(12)
      }
    }
  })

  it('na virada do saco não repete a última, mesmo se o sorteio a puser primeiro', () => {
    const first = () => 0.999999 // Fisher–Yates com 0.99… deixa a lista na mesma ordem
    expect(shuffle(IDS, first)).toEqual(IDS)
    expect(nextOffer(IDS, { bag: [], last: IDS[0] }, first).id).toBe(IDS[1])
  })

  it('saco guardado com item que saiu do cardápio, repetido ou igual à última: corrigido', () => {
    expect(nextOffer(IDS, { bag: ['sumiu', 'oferta-3', 'oferta-3', 'oferta-4'], last: null }, seeded(1))).toEqual({
      id: 'oferta-3',
      bag: ['oferta-4'],
    })
    expect(nextOffer(IDS, { bag: ['oferta-5'], last: 'oferta-5' }, seeded(1)).id).not.toBe('oferta-5')
  })

  it('o intervalo fica entre 12 e 18 segundos', () => {
    expect(randomGap(() => 0)).toBe(12000)
    expect(randomGap(() => 0.999999)).toBe(18000)
    const random = seeded(7)
    for (let i = 0; i < 200; i++) {
      const gap = randomGap(random)
      expect(gap).toBeGreaterThanOrEqual(12000)
      expect(gap).toBeLessThanOrEqual(18000)
    }
  })
})

describe('relógio das notificações', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const create = (storage: StorageLike | null = memoryStorage(), random = () => 0) => {
    const scheduler = new OfferScheduler(IDS, { storage, random })
    scheduler.start()
    return scheduler
  }
  const showing = (scheduler: OfferScheduler) => scheduler.getSnapshot().offerId

  it('primeira oferta 4 s depois de começar; fica 8 s; a próxima vem 12 a 18 s depois', () => {
    const scheduler = create()
    vi.advanceTimersByTime(OFFER_TIMING.initialDelayMs - 1)
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(1)
    const first = showing(scheduler)
    expect(first).not.toBeNull()
    vi.advanceTimersByTime(OFFER_TIMING.visibleMs - 1)
    expect(showing(scheduler)).toBe(first)
    vi.advanceTimersByTime(1)
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(12000 - 1) // sorteio fixo em 0: intervalo de 12 s
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(1)
    expect(showing(scheduler)).not.toBeNull()
    expect(showing(scheduler)).not.toBe(first)
  })

  it('avisa quem acompanha a cada mudança', () => {
    const scheduler = create()
    const listener = vi.fn()
    const unsubscribe = scheduler.subscribe(listener)
    vi.advanceTimersByTime(4000)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('o X fecha na hora; a próxima vem depois do intervalo', () => {
    const scheduler = create()
    vi.advanceTimersByTime(4000)
    scheduler.dismiss()
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(12000)
    expect(showing(scheduler)).not.toBeNull()
  })

  it('3 fechamentos encerram as aparições; "Ver ofertas" mostra uma na hora e recomeça', () => {
    const storage = memoryStorage()
    const scheduler = create(storage)
    vi.advanceTimersByTime(4000)
    for (let i = 0; i < MAX_DISMISSALS; i++) {
      expect(showing(scheduler), `fechamento ${i + 1}`).not.toBeNull()
      scheduler.dismiss()
      vi.advanceTimersByTime(18000)
    }
    expect(scheduler.getSnapshot()).toMatchObject({ offerId: null, stopped: true })
    vi.advanceTimersByTime(10 * 60_000)
    expect(showing(scheduler)).toBeNull()
    expect(readMemory(storage)).toMatchObject({ dismissed: 3, stopped: true })

    scheduler.reactivate()
    expect(scheduler.getSnapshot()).toMatchObject({ stopped: false })
    expect(showing(scheduler)).not.toBeNull()
    expect(readMemory(storage)).toMatchObject({ dismissed: 0, stopped: false })
  })

  it('a visita encerrada continua encerrada em outra página (sessionStorage)', () => {
    const storage = memoryStorage()
    storage.setItem(OFFER_STORAGE_KEY, JSON.stringify({ ...EMPTY_MEMORY, dismissed: 3, stopped: true }))
    const scheduler = create(storage)
    expect(scheduler.getSnapshot().stopped).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(showing(scheduler)).toBeNull()
  })

  it('ponteiro, dedo ou foco no cartão param a contagem; ao soltar, ela continua de onde parou', () => {
    const scheduler = create()
    vi.advanceTimersByTime(4000)
    const offer = showing(scheduler)
    vi.advanceTimersByTime(3000)
    scheduler.setHeld(true)
    expect(scheduler.getSnapshot().held).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(showing(scheduler)).toBe(offer)
    scheduler.setHeld(false)
    vi.advanceTimersByTime(4999)
    expect(showing(scheduler)).toBe(offer)
    vi.advanceTimersByTime(1)
    expect(showing(scheduler)).toBeNull()
  })

  it('janela, busca ou aviso: some com a oferta na hora e para o relógio', () => {
    const scheduler = create()
    vi.advanceTimersByTime(4000)
    expect(showing(scheduler)).not.toBeNull()
    scheduler.setBlocked(true)
    expect(scheduler.getSnapshot()).toMatchObject({ offerId: null, blocked: true })
    vi.advanceTimersByTime(10 * 60_000)
    expect(showing(scheduler)).toBeNull()
    scheduler.setBlocked(false)
    vi.advanceTimersByTime(11999)
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(1)
    expect(showing(scheduler)).not.toBeNull()
  })

  it('bloqueio durante a espera: a contagem para e continua de onde parou', () => {
    const scheduler = create()
    vi.advanceTimersByTime(3000)
    scheduler.setBlocked(true)
    vi.advanceTimersByTime(60_000)
    expect(showing(scheduler)).toBeNull()
    scheduler.setBlocked(false)
    vi.advanceTimersByTime(999)
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(1)
    expect(showing(scheduler)).not.toBeNull()
  })

  it('bloqueado desde o começo: nada aparece até liberar', () => {
    const scheduler = new OfferScheduler(IDS, { storage: memoryStorage(), random: () => 0 })
    scheduler.setBlocked(true)
    scheduler.start()
    vi.advanceTimersByTime(60_000)
    expect(showing(scheduler)).toBeNull()
    scheduler.setBlocked(false)
    vi.advanceTimersByTime(4000)
    expect(showing(scheduler)).not.toBeNull()
  })

  it('tocar na oferta tira ela da tela; a próxima vem depois do intervalo', () => {
    const scheduler = create()
    vi.advanceTimersByTime(4000)
    scheduler.accept()
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(12000)
    expect(showing(scheduler)).not.toBeNull()
  })

  it('outra página continua o mesmo saco, sem repetir a última', () => {
    const storage = memoryStorage()
    const first = create(storage, seeded(5))
    vi.advanceTimersByTime(4000)
    const last = showing(first)
    first.dispose()
    expect(showing(first)).toBeNull()
    const second = create(storage, seeded(5))
    vi.advanceTimersByTime(4000)
    expect(showing(second)).not.toBe(last)
    expect(readMemory(storage).bag).toHaveLength(10)
  })

  it('parar e começar de novo (troca de página) refaz a espera inicial', () => {
    const scheduler = create()
    vi.advanceTimersByTime(2000)
    scheduler.dispose()
    scheduler.start()
    vi.advanceTimersByTime(3999)
    expect(showing(scheduler)).toBeNull()
    vi.advanceTimersByTime(1)
    expect(showing(scheduler)).not.toBeNull()
  })

  it('estado guardado estragado é ignorado', () => {
    const storage = memoryStorage()
    storage.setItem(OFFER_STORAGE_KEY, '{quebrado')
    expect(readMemory(storage)).toEqual(EMPTY_MEMORY)
    storage.setItem(OFFER_STORAGE_KEY, JSON.stringify({ bag: [1, 'oferta-2'], last: 7, dismissed: -1, stopped: 'sim' }))
    expect(readMemory(storage)).toEqual({ bag: ['oferta-2'], last: null, dismissed: 0, stopped: false })
  })
})
