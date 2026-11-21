import { describe, expect, it } from 'vitest'
import { ADDED_ITEMS_MELODY, type AudioContextLike, NEW_ORDER_MELODY, SOUND_KEY, createSoundAlert } from './orderAlert.ts'

/** Web Audio de mentira: começa como o navegador decidir ("suspended" sem toque) e conta as notas. */
function fakeAudio(initial: 'running' | 'suspended', allowResume = true) {
  const audio = { notes: 0, created: 0, state: initial, played: [] as { wave: string; frequency: number }[] }
  const createContext = (): AudioContextLike => {
    audio.created++
    const listeners: (() => void)[] = []
    return {
      get state() {
        return audio.state
      },
      currentTime: 0,
      destination: {},
      resume: async () => {
        if (allowResume) audio.state = 'running'
        for (const listener of listeners) listener()
      },
      createOscillator: () => {
        const oscillator = {
          type: '',
          frequency: { value: 0 },
          connect: (node: unknown) => node,
          start: () => {
            audio.notes++
            audio.played.push({ wave: oscillator.type, frequency: oscillator.frequency.value })
          },
          stop: () => undefined,
        }
        return oscillator
      },
      createGain: () => ({ gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: (node: unknown) => node }),
      addEventListener: (_type, listener) => void listeners.push(listener),
    }
  }
  return { audio, createContext }
}

const memory = () => {
  const map = new Map<string, string>()
  return { map, storage: { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) } }
}

describe('aviso sonoro de pedido novo (painel ao vivo, 2026-11-20)', () => {
  it('antes de um toque: não diz "ativo", não cria o áudio e não toca (restrição do navegador)', () => {
    const { audio, createContext } = fakeAudio('suspended')
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    expect([alert.state(), alert.play(), audio.created, audio.notes]).toEqual(['blocked', false, 0, 0])
  })

  it('depois do toque: o navegador libera, fica "ativo" e o bipe toca (duas notas)', async () => {
    const { audio, createContext } = fakeAudio('suspended')
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    let notified = 0
    alert.subscribe(() => notified++)
    alert.unlock()
    await Promise.resolve()
    expect([alert.state(), alert.play(), audio.notes, notified > 0]).toEqual(['on', true, 2, true])
  })

  it('navegador que não libera mesmo com o toque: continua "bloqueado", sem tocar', async () => {
    const { audio, createContext } = fakeAudio('suspended', false)
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    alert.unlock()
    await Promise.resolve()
    expect([alert.state(), alert.play(), audio.notes]).toEqual(['blocked', false, 0])
  })

  it('silenciado: não toca e fica guardado no aparelho; ligar de novo libera na hora', async () => {
    const { audio, createContext } = fakeAudio('running')
    const { map, storage } = memory()
    const alert = createSoundAlert({ createContext, storage })
    alert.unlock()
    alert.setOn(false)
    expect([alert.state(), alert.play(), audio.notes, map.get(SOUND_KEY)]).toEqual(['off', false, 0, '0'])
    expect(createSoundAlert({ createContext, storage }).state()).toBe('off')
    alert.setOn(true)
    expect([alert.state(), alert.play(), audio.notes, map.get(SOUND_KEY)]).toEqual(['on', true, 2, '1'])
  })

  it('sem Web Audio no navegador: nunca toca, sem erro', () => {
    const alert = createSoundAlert({ createContext: () => null, storage: null })
    alert.unlock()
    expect([alert.state(), alert.play(), alert.playAdded()]).toEqual(['blocked', false, false])
  })

  it('navegador sem Web Audio (2026-11-21): estado "sem suporte", diferente de bloqueado; silenciado continua "silenciado"', () => {
    const alert = createSoundAlert({ createContext: () => null, storage: memory().storage, isSupported: () => false })
    alert.unlock()
    expect([alert.state(), alert.play()]).toEqual(['unsupported', false])
    alert.setOn(false)
    expect(alert.state()).toBe('off')
  })

  it('bloqueado x silenciado (2026-11-21): o aviso de bloqueio só vale com o som ligado', async () => {
    const { createContext } = fakeAudio('suspended')
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    expect(alert.state()).toBe('blocked')
    alert.setOn(false)
    expect(alert.state()).toBe('off')
    alert.setOn(true)
    await Promise.resolve()
    expect(alert.state()).toBe('on')
  })
})

describe('aviso sonoro de itens acrescentados (2026-11-20)', () => {
  it('"ding-dong" ascendente: duas notas, a segunda mais aguda, com timbre de sino (triangular)', async () => {
    const { audio, createContext } = fakeAudio('suspended')
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    alert.unlock()
    await Promise.resolve()
    expect(alert.playAdded()).toBe(true)
    expect(audio.played).toEqual(ADDED_ITEMS_MELODY.notes.map(({ frequency }) => ({ wave: 'triangle', frequency })))
    expect(audio.played[1].frequency).toBeGreaterThan(audio.played[0].frequency)
  })

  it('diferente do bipe de pedido novo: outras notas, outro timbre, mais grave e mais longo', async () => {
    const { audio, createContext } = fakeAudio('running')
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    alert.unlock()
    alert.play()
    const newOrder = audio.played.splice(0)
    alert.playAdded()
    const added = audio.played
    expect(newOrder).toEqual([
      { wave: 'sine', frequency: 880 },
      { wave: 'sine', frequency: 1175 },
    ])
    expect(added.some((note) => newOrder.some((other) => other.frequency === note.frequency))).toBe(false)
    expect(Math.max(...added.map((note) => note.frequency))).toBeLessThan(Math.min(...newOrder.map((note) => note.frequency)))
    const length = (melody: typeof NEW_ORDER_MELODY) => Math.max(...melody.notes.map((note) => note.at + note.length))
    expect(length(ADDED_ITEMS_MELODY)).toBeGreaterThan(length(NEW_ORDER_MELODY))
  })

  it('mesmo liga/desliga do pedido novo: silenciado, nenhum dos dois toca; antes do toque na página, também não', async () => {
    const blocked = fakeAudio('suspended')
    const before = createSoundAlert({ createContext: blocked.createContext, storage: memory().storage })
    expect([before.playAdded(), blocked.audio.notes]).toEqual([false, 0])

    const { audio, createContext } = fakeAudio('running')
    const alert = createSoundAlert({ createContext, storage: memory().storage })
    alert.unlock()
    alert.setOn(false)
    expect([alert.play(), alert.playAdded(), audio.notes]).toEqual([false, false, 0])
    alert.setOn(true)
    expect([alert.playAdded(), audio.notes]).toEqual([true, 2])
  })
})
