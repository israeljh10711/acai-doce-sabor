/**
 * Cardápio ao vivo (cardápio dinâmico, 2026-11-21): um aviso do Realtime (a revisão em
 * `catalog_meta` subiu) ou a volta para a aba pede uma nova leitura. Vários avisos seguidos viram
 * uma leitura só (espera curta), e nunca há duas leituras ao mesmo tempo: a que chega durante uma
 * leitura marca outra para logo depois.
 */
export type CatalogLiveDeps = {
  /** Lê o cardápio de novo. */
  reload(): Promise<void>
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  /** Espera depois do último aviso. */
  debounceMs?: number
}

export function createCatalogLive(deps: CatalogLiveDeps) {
  const wait = deps.debounceMs ?? 400
  let timer: unknown = null
  let running = false
  let again = false

  const run = async () => {
    timer = null
    if (running) {
      again = true
      return
    }
    running = true
    try {
      await deps.reload()
    } catch {
      // A leitura cuida do próprio erro; o próximo aviso tenta de novo.
    } finally {
      running = false
      if (again) {
        again = false
        poke()
      }
    }
  }

  function poke() {
    if (timer !== null) deps.clearTimeout(timer)
    timer = deps.setTimeout(() => void run(), wait)
  }

  return {
    /** Algo mudou: lê de novo depois da espera. */
    poke,
    stop() {
      if (timer !== null) deps.clearTimeout(timer)
      timer = null
    },
  }
}
