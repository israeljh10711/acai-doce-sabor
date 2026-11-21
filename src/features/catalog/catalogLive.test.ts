import { describe, expect, it } from 'vitest'
import { createCatalogLive } from './catalogLive.ts'

function fakeClock() {
  let now = 0
  let next = 1
  const timers = new Map<number, { at: number; callback: () => void }>()
  return {
    setTimeout: (callback: () => void, ms: number) => {
      const id = next++
      timers.set(id, { at: now + ms, callback })
      return id
    },
    clearTimeout: (id: unknown) => void timers.delete(id as number),
    async elapse(ms: number) {
      now += ms
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id)
          timer.callback()
        }
      }
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

describe('cardápio ao vivo', () => {
  it('vários avisos seguidos viram uma leitura só', async () => {
    const clock = fakeClock()
    let reads = 0
    const live = createCatalogLive({ ...clock, reload: async () => void reads++ })
    live.poke()
    await clock.elapse(100)
    live.poke()
    await clock.elapse(100)
    live.poke()
    await clock.elapse(399)
    expect(reads).toBe(0)
    await clock.elapse(1)
    expect(reads).toBe(1)
  })
  it('aviso durante uma leitura marca outra para depois (nunca duas ao mesmo tempo)', async () => {
    const clock = fakeClock()
    let reads = 0
    let release: () => void = () => {}
    const live = createCatalogLive({
      ...clock,
      reload: () =>
        new Promise<void>((resolve) => {
          reads++
          release = resolve
        }),
    })
    live.poke()
    await clock.elapse(400)
    expect(reads).toBe(1)
    live.poke()
    await clock.elapse(400)
    expect(reads).toBe(1)
    release()
    await clock.elapse(0)
    await clock.elapse(400)
    expect(reads).toBe(2)
  })
  it('erro na leitura não para os próximos avisos', async () => {
    const clock = fakeClock()
    let reads = 0
    const live = createCatalogLive({
      ...clock,
      reload: async () => {
        reads++
        throw new Error('fora do ar')
      },
    })
    live.poke()
    await clock.elapse(400)
    live.poke()
    await clock.elapse(400)
    expect(reads).toBe(2)
  })
  it('parar cancela a leitura marcada', async () => {
    const clock = fakeClock()
    let reads = 0
    const live = createCatalogLive({ ...clock, reload: async () => void reads++ })
    live.poke()
    live.stop()
    await clock.elapse(1000)
    expect(reads).toBe(0)
  })
})
