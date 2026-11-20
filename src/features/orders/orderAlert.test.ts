import { describe, expect, it } from 'vitest'
import { type AudioContextLike, SOUND_KEY, createSoundAlert } from './orderAlert.ts'

/** Web Audio de mentira: começa como o navegador decidir ("suspended" sem toque) e conta as notas. */
function fakeAudio(initial: 'running' | 'suspended', allowResume = true) {
  const audio = { notes: 0, created: 0, state: initial }
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
      createOscillator: () => ({ type: '', frequency: { value: 0 }, connect: (node: unknown) => node, start: () => void audio.notes++, stop: () => undefined }),
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
    expect([alert.state(), alert.play()]).toEqual(['blocked', false])
  })
})
