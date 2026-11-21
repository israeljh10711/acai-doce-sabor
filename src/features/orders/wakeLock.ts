/**
 * Tela acesa no painel de pedidos (2026-11-21), pela Screen Wake Lock API: enquanto o painel está
 * aberto e visível, o aparelho do balcão não apaga a tela. O navegador solta o bloqueio sozinho
 * quando a aba some; ao voltar, o painel pede de novo. Sem suporte, ou com o pedido recusado
 * (economia de bateria, permissão), nada acontece e nenhum erro aparece.
 */
import { useEffect } from 'react'

/** O pedaço da API que o painel usa (o do navegador, ou um de mentira nos testes). */
export type WakeLockSentinelLike = {
  readonly released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}
export type WakeLockLike = { request(type: 'screen'): Promise<WakeLockSentinelLike> }

export function createScreenWakeLock({ api, visible }: { api: WakeLockLike | null; visible: () => boolean }) {
  let active = false
  let sentinel: WakeLockSentinelLike | null = null
  let pending: Promise<void> | null = null

  /** Pede o bloqueio (um pedido por vez; nunca dois ao mesmo tempo). */
  const acquire = (): Promise<void> => {
    if (!api || !active || !visible() || (sentinel && !sentinel.released) || pending) return pending ?? Promise.resolve()
    pending = api
      .request('screen')
      .then((lock) => {
        if (!active) {
          // O painel fechou enquanto o navegador respondia: solta na hora.
          void lock.release().catch(() => undefined)
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      })
      .catch(() => {
        // Sem permissão, bateria fraca ou aba escondida: segue sem a tela acesa.
      })
      .finally(() => {
        pending = null
      })
    return pending
  }

  return {
    /** O painel abriu. */
    start: () => {
      active = true
      return acquire()
    },
    /** O painel fechou: solta o bloqueio. */
    stop() {
      active = false
      const lock = sentinel
      sentinel = null
      if (lock && !lock.released) void lock.release().catch(() => undefined)
    },
    /** A aba voltou a ficar visível: pede de novo (o navegador soltou ao esconder). */
    onVisibilityChange: () => acquire(),
    /** Se a tela está presa acesa agora. */
    isHeld: () => sentinel !== null && !sentinel.released,
  }
}

/** Mantém a tela acesa enquanto o componente (o painel) estiver na tela. */
export function useScreenWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const api = typeof navigator !== 'undefined' && 'wakeLock' in navigator ? (navigator.wakeLock as unknown as WakeLockLike) : null
    if (!api) return
    const lock = createScreenWakeLock({ api, visible: () => document.visibilityState === 'visible' })
    void lock.start()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void lock.onVisibilityChange()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock.stop()
    }
  }, [enabled])
}
