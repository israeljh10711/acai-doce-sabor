import { useCallback, useEffect, useRef, useState } from 'react'

/** Linha de leitura: a seção que começou acima dela é a seção à vista. */
const READING_LINE = 0.35

/**
 * Chama `callback` uma vez, quando a página para de rolar (nenhuma rolagem por `quietMs`).
 * Se a página nem começar a rolar (já estava no lugar), chama depois de `startMs`.
 * Devolve a função que cancela.
 */
export function whenScrollSettles(callback: () => void, { startMs = 400, quietMs = 150 } = {}): () => void {
  let timer = window.setTimeout(done, startMs)
  function done() {
    window.removeEventListener('scroll', onScroll)
    callback()
  }
  function onScroll() {
    window.clearTimeout(timer)
    timer = window.setTimeout(done, quietMs)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    window.clearTimeout(timer)
    window.removeEventListener('scroll', onScroll)
  }
}

/**
 * A seção à vista no cardápio (pedido de 2026-11-16), para a barra lateral, o menu e os botões da
 * barra fixa marcarem onde o cliente está: a última que começou acima da linha de leitura (35% da
 * altura da tela), medida a cada quadro de rolagem. Seções lado a lado (os 3 produtos numa linha):
 * a primeira. Antes da primeira seção, nenhuma.
 *
 * `pin` marca a seção escolhida na navegação enquanto a página rola até ela; ela continua marcada
 * até o cliente rolar para outra (assim "Milk-shake" fica marcado, mesmo na linha do Tradicional).
 */
export function useScrollSpy(anchors: readonly string[], observeKey: string) {
  const [current, setCurrent] = useState<string | null>(null)
  // Seção escolhida e a medida da página parada logo depois (undefined: ainda rolando até ela).
  const pinned = useRef<{ baseline: string | null | undefined; cancel: () => void } | null>(null)

  const measure = useCallback((): string | null => {
    const line = window.innerHeight * READING_LINE
    let best: { anchor: string; top: number } | null = null
    for (const anchor of anchors) {
      const top = document.getElementById(anchor)?.getBoundingClientRect().top
      if (top === undefined || top > line) continue
      if (!best || top > best.top + 1) best = { anchor, top }
    }
    return best?.anchor ?? null
  }, [anchors])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const pin = pinned.current
      if (pin) {
        if (pin.baseline === undefined) return
        const measured = measure()
        if (measured === pin.baseline) return
        pinned.current = null
      }
      setCurrent(measure())
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    // A busca ou uma seção recolhida mudam o que está na página: mede de novo.
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [measure, observeKey])

  useEffect(() => () => pinned.current?.cancel(), [])

  const pin = useCallback(
    (anchor: string) => {
      pinned.current?.cancel()
      const entry: { baseline: string | null | undefined; cancel: () => void } = { baseline: undefined, cancel: () => {} }
      entry.cancel = whenScrollSettles(() => {
        entry.baseline = measure()
      })
      pinned.current = entry
      setCurrent(anchor)
    },
    [measure],
  )

  return { current, pin }
}
