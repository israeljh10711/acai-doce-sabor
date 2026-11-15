/**
 * Relógio das notificações de ofertas (pedido de 2026-11-15), sem React, para ser testado com
 * tempo simulado:
 *
 * - primeira oferta 4 s depois de começar; cada uma fica 8 s; entre uma e outra, 12 a 18 s
 *   sorteados;
 * - sorteio em "saco": passa por todas em ordem aleatória antes de repetir, e nunca mostra a
 *   mesma duas vezes seguidas (nem na virada do saco);
 * - `setHeld`: ponteiro, dedo ou foco no cartão param a contagem dele;
 * - `setBlocked`: janela aberta, busca, aviso do carrinho ou aba escondida. Some com a oferta
 *   na tela e para o relógio; ao liberar, a contagem continua;
 * - 3 fechamentos no X na mesma visita encerram as aparições; `reactivate` ("Ver ofertas")
 *   mostra uma na hora e recomeça o ciclo.
 *
 * O saco, a última oferta e os fechamentos ficam no `sessionStorage`: valem para a visita
 * inteira, mesmo trocando de página.
 */

export type OfferTiming = {
  initialDelayMs: number
  visibleMs: number
  gapMinMs: number
  gapMaxMs: number
}

export const OFFER_TIMING: OfferTiming = { initialDelayMs: 4000, visibleMs: 8000, gapMinMs: 12000, gapMaxMs: 18000 }

/** Fechamentos no X que encerram as aparições automáticas na visita. */
export const MAX_DISMISSALS = 3

export const OFFER_STORAGE_KEY = 'acai-doce-sabor:ofertas'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Estado guardado na visita. */
export type OfferMemory = { bag: string[]; last: string | null; dismissed: number; stopped: boolean }

export const EMPTY_MEMORY: OfferMemory = { bag: [], last: null, dismissed: 0, stopped: false }

/** Embaralha (Fisher–Yates) sem alterar a lista recebida. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Próxima oferta do saco. Saco vazio: um novo, embaralhado. Nunca devolve a mesma da última vez
 * quando há mais de uma oferta. Itens que não existem mais saem do saco.
 */
export function nextOffer(
  ids: readonly string[],
  memory: Pick<OfferMemory, 'bag' | 'last'>,
  random: () => number,
): { id: string; bag: string[] } {
  let pool = memory.bag.filter((id, index, bag) => ids.includes(id) && bag.indexOf(id) === index)
  if (pool.length === 0 || (pool.length === 1 && pool[0] === memory.last && ids.length > 1)) pool = shuffle(ids, random)
  if (pool.length > 1 && pool[0] === memory.last) [pool[0], pool[1]] = [pool[1], pool[0]]
  const [id, ...bag] = pool
  return { id, bag }
}

/** Intervalo sorteado entre uma oferta e a próxima. */
export function randomGap(random: () => number, timing: OfferTiming = OFFER_TIMING): number {
  return timing.gapMinMs + Math.round(random() * (timing.gapMaxMs - timing.gapMinMs))
}

/** Lê o estado guardado, conferindo cada campo. */
export function readMemory(storage: StorageLike | null): OfferMemory {
  try {
    const data: unknown = JSON.parse(storage?.getItem(OFFER_STORAGE_KEY) ?? 'null')
    if (typeof data !== 'object' || data === null) return EMPTY_MEMORY
    const { bag, last, dismissed, stopped } = data as Partial<Record<keyof OfferMemory, unknown>>
    return {
      bag: Array.isArray(bag) ? bag.filter((id): id is string => typeof id === 'string') : [],
      last: typeof last === 'string' ? last : null,
      dismissed: Number.isInteger(dismissed) && (dismissed as number) > 0 ? (dismissed as number) : 0,
      stopped: stopped === true,
    }
  } catch {
    return EMPTY_MEMORY
  }
}

/** Contagem que pode parar e continuar de onde parou. */
class Countdown {
  private timer: ReturnType<typeof setTimeout> | null = null
  private deadline = 0
  private remaining = 0
  private done: (() => void) | null = null

  set(ms: number, done: () => void, running: boolean) {
    this.clear()
    this.remaining = ms
    this.done = done
    if (running) this.run()
  }

  run() {
    if (this.timer || !this.done) return
    this.deadline = Date.now() + this.remaining
    this.timer = setTimeout(() => {
      this.timer = null
      const done = this.done
      this.done = null
      done?.()
    }, this.remaining)
  }

  hold() {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
    this.remaining = Math.max(0, this.deadline - Date.now())
  }

  clear() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.done = null
  }
}

export type OfferSnapshot = {
  /** Oferta na tela, ou `null`. */
  offerId: string | null
  /** Muda a cada aparição (reinicia a barra de tempo). */
  showKey: number
  /** A contagem da oferta na tela está parada (ponteiro, dedo ou foco nela). */
  held: boolean
  /** Janela, busca, aviso ou aba escondida: nada aparece. */
  blocked: boolean
  /** Encerrado pelos fechamentos: só o botão "Ver ofertas". */
  stopped: boolean
}

type Phase = 'idle' | 'waiting' | 'showing' | 'stopped'

type SchedulerOptions = {
  random?: () => number
  storage?: StorageLike | null
  timing?: OfferTiming
}

export class OfferScheduler {
  private phase: Phase = 'idle'
  private current: string | null = null
  private blocked = false
  private held = false
  private showKey = 0
  private readonly countdown = new Countdown()
  private readonly listeners = new Set<() => void>()
  private readonly ids: readonly string[]
  private readonly random: () => number
  private readonly storage: StorageLike | null
  private readonly timing: OfferTiming
  private memory: OfferMemory
  private snapshot: OfferSnapshot

  constructor(ids: readonly string[], { random = Math.random, storage = null, timing = OFFER_TIMING }: SchedulerOptions = {}) {
    this.ids = ids
    this.random = random
    this.storage = storage
    this.timing = timing
    this.memory = readMemory(storage)
    this.snapshot = this.makeSnapshot()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  /** Começa o ciclo: a primeira oferta vem depois da espera inicial. */
  start() {
    if (this.phase !== 'idle' || this.ids.length === 0) return
    if (this.memory.stopped) {
      this.phase = 'stopped'
      this.emit()
      return
    }
    this.wait(this.timing.initialDelayMs)
  }

  /** Para tudo (a página saiu). Pode começar de novo com `start`. */
  dispose() {
    this.countdown.clear()
    this.phase = 'idle'
    this.current = null
    this.held = false
    this.emit()
  }

  setBlocked(blocked: boolean) {
    if (blocked === this.blocked) return
    this.blocked = blocked
    if (blocked) {
      // A oferta na tela some; a próxima vem depois de um intervalo novo, contado só ao liberar.
      if (this.phase === 'showing') this.wait(randomGap(this.random, this.timing))
      else this.countdown.hold()
    } else if (this.phase === 'waiting' || this.phase === 'showing') {
      if (!(this.phase === 'showing' && this.held)) this.countdown.run()
    }
    this.emit()
  }

  setHeld(held: boolean) {
    if (held === this.held) return
    this.held = held
    if (this.phase === 'showing') {
      if (held) this.countdown.hold()
      else if (!this.blocked) this.countdown.run()
    }
    this.emit()
  }

  /** Fechou no X. */
  dismiss() {
    if (this.phase !== 'showing') return
    this.remember({ dismissed: this.memory.dismissed + 1 })
    if (this.memory.dismissed >= MAX_DISMISSALS) {
      this.remember({ stopped: true })
      this.countdown.clear()
      this.phase = 'stopped'
      this.current = null
      this.held = false
      this.emit()
      return
    }
    this.wait(randomGap(this.random, this.timing))
  }

  /** Tocou na oferta: ela sai e a próxima vem depois de um intervalo. */
  accept() {
    if (this.phase !== 'showing') return
    this.wait(randomGap(this.random, this.timing))
  }

  /** "Ver ofertas": recomeça a contagem de fechamentos e mostra uma oferta na hora. */
  reactivate() {
    this.remember({ dismissed: 0, stopped: false })
    if (this.blocked) this.wait(0)
    else this.show()
  }

  private running() {
    return !this.blocked && !(this.phase === 'showing' && this.held)
  }

  private wait(ms: number) {
    this.phase = 'waiting'
    this.current = null
    this.held = false
    this.countdown.set(ms, () => this.show(), this.running())
    this.emit()
  }

  private show() {
    const { id, bag } = nextOffer(this.ids, this.memory, this.random)
    this.remember({ bag, last: id })
    this.phase = 'showing'
    this.current = id
    this.held = false
    this.showKey += 1
    this.countdown.set(this.timing.visibleMs, () => this.wait(randomGap(this.random, this.timing)), this.running())
    this.emit()
  }

  private remember(patch: Partial<OfferMemory>) {
    this.memory = { ...this.memory, ...patch }
    try {
      this.storage?.setItem(OFFER_STORAGE_KEY, JSON.stringify(this.memory))
    } catch {
      // Sem armazenamento: o estado vale até a página fechar.
    }
  }

  private makeSnapshot(): OfferSnapshot {
    return {
      offerId: this.phase === 'showing' ? this.current : null,
      showKey: this.showKey,
      held: this.held,
      blocked: this.blocked,
      stopped: this.phase === 'stopped',
    }
  }

  private emit() {
    const next = this.makeSnapshot()
    const same = (Object.keys(next) as (keyof OfferSnapshot)[]).every((key) => next[key] === this.snapshot[key])
    if (same) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
}
