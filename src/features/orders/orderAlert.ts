/**
 * Aviso sonoro de pedido novo (painel ao vivo, 2026-11-20): um bipe duplo curto e agradável,
 * feito pela Web Audio do navegador, sem arquivo de áudio.
 *
 * O navegador só libera o som depois de um toque na página. O áudio é criado nesse toque
 * (`unlock`), e o painel só diz "Som Ativo" quando o navegador já liberou (`state() === 'on'`).
 * Silenciado (`off`), nada toca. A escolha fica guardada no aparelho.
 *
 * Dois sons (2026-11-20), com o mesmo liga/desliga e a mesma liberação:
 * - pedido novo (`play`): bipe duplo curto e agudo (lá e ré, onda senoidal, 0,2 s cada);
 * - itens acrescentados pelo cliente (`playAdded`): "ding-dong" ascendente, mais grave, mais longo e
 *   com timbre de sino (dó e sol, onda triangular, 0,5 s cada), para não ser confundido com pedido novo.
 */

/** O pedaço da Web Audio que o aviso usa (o do navegador, ou um de mentira nos testes). */
export type AudioContextLike = {
  readonly state: string
  readonly currentTime: number
  readonly destination: unknown
  resume(): Promise<void>
  createOscillator(): {
    type: string
    frequency: { value: number }
    connect(node: unknown): unknown
    start(when: number): void
    stop(when: number): void
  }
  createGain(): {
    gain: { setValueAtTime(value: number, when: number): void; exponentialRampToValueAtTime(value: number, when: number): void }
    connect(node: unknown): unknown
  }
  addEventListener?(type: 'statechange', listener: () => void): void
}

/** `on`: toca; `blocked`: ligado, mas o navegador ainda não liberou; `off`: silenciado. */
export type SoundState = 'on' | 'blocked' | 'off'

export type SoundAlert = {
  state(): SoundState
  /** "🔔 Som Ativo" / "🔕 Silenciar" (num toque: também libera o som). */
  setOn(on: boolean): void
  /** Qualquer toque na página: libera o som se estiver ligado. */
  unlock(): void
  /** Toca o bipe de pedido novo se estiver ligado e liberado. Devolve se tocou. */
  play(): boolean
  /** Toca o "ding-dong" de itens acrescentados (mesmas regras do bipe). Devolve se tocou. */
  playAdded(): boolean
  subscribe(listener: () => void): () => void
}

export const SOUND_KEY = 'acai_doce_sabor_pedidos_som_v1'

type Note = { at: number; frequency: number; length: number }
type Melody = { wave: string; peak: number; notes: readonly Note[] }

/** Pedido novo: duas notas curtas e agudas (lá e ré). */
export const NEW_ORDER_MELODY: Melody = {
  wave: 'sine',
  peak: 0.25,
  notes: [
    { at: 0, frequency: 880, length: 0.2 },
    { at: 0.2, frequency: 1175, length: 0.2 },
  ],
}

/** Itens acrescentados: "ding-dong" ascendente, mais grave e mais longo (dó e sol, timbre de sino). */
export const ADDED_ITEMS_MELODY: Melody = {
  wave: 'triangle',
  peak: 0.22,
  notes: [
    { at: 0, frequency: 523.25, length: 0.5 },
    { at: 0.32, frequency: 783.99, length: 0.6 },
  ],
}

export function createSoundAlert({
  createContext,
  storage,
}: {
  createContext: () => AudioContextLike | null
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
}): SoundAlert {
  let context: AudioContextLike | null = null
  let on = true
  try {
    on = storage?.getItem(SOUND_KEY) !== '0'
  } catch {
    // Sem armazenamento: ligado.
  }
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }

  const ensureContext = () => {
    if (context) return context
    try {
      context = createContext()
    } catch {
      context = null
    }
    context?.addEventListener?.('statechange', notify)
    return context
  }

  /** Toca as notas se o som estiver ligado e o navegador já tiver liberado. */
  const sing = (melody: Melody): boolean => {
    if (!on || !context || context.state !== 'running') return false
    const ctx = context
    const start = ctx.currentTime + 0.01
    for (const { at, frequency, length } of melody.notes) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = melody.wave
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + at)
      gain.gain.exponentialRampToValueAtTime(melody.peak, start + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length - 0.02)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(start + at)
      oscillator.stop(start + at + length)
    }
    return true
  }

  const alert: SoundAlert = {
    state() {
      if (!on) return 'off'
      return context?.state === 'running' ? 'on' : 'blocked'
    },
    setOn(next) {
      on = next
      try {
        storage?.setItem(SOUND_KEY, next ? '1' : '0')
      } catch {
        // Vale só nesta tela.
      }
      if (next) alert.unlock()
      notify()
    },
    unlock() {
      if (!on) return
      const ctx = ensureContext()
      if (ctx && ctx.state !== 'running') void ctx.resume().then(notify, notify)
      else notify()
    },
    play: () => sing(NEW_ORDER_MELODY),
    playAdded: () => sing(ADDED_ITEMS_MELODY),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return alert
}

/** O aviso do navegador (um só para o site). */
export const soundAlert: SoundAlert = createSoundAlert({
  createContext: () => {
    const scope = globalThis as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike }
    const Ctor = scope.AudioContext ?? scope.webkitAudioContext
    return Ctor ? new Ctor() : null
  },
  storage: typeof localStorage === 'undefined' ? null : localStorage,
})
