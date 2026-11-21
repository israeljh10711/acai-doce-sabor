import { describe, expect, it } from 'vitest'
import { type WakeLockLike, type WakeLockSentinelLike, createScreenWakeLock } from './wakeLock.ts'

/** Wake Lock de mentira: conta os pedidos, deixa recusar e simula o navegador soltando ao esconder a aba. */
function fakeWakeLock({ reject = false } = {}) {
  const state = { requests: 0, releases: 0, sentinels: [] as (WakeLockSentinelLike & { browserRelease(): void })[] }
  const api: WakeLockLike = {
    request: async () => {
      state.requests++
      if (reject) throw new DOMException('Sem permissão', 'NotAllowedError')
      const listeners: (() => void)[] = []
      const sentinel = {
        released: false,
        release: async () => {
          if (sentinel.released) return
          sentinel.released = true
          state.releases++
          listeners.forEach((listener) => listener())
        },
        addEventListener: (_type: 'release', listener: () => void) => void listeners.push(listener),
        browserRelease() {
          sentinel.released = true
          listeners.forEach((listener) => listener())
        },
      }
      state.sentinels.push(sentinel)
      return sentinel
    },
  }
  return { api, state }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('tela acesa no painel de pedidos (2026-11-21)', () => {
  it('com suporte: pede uma vez ao abrir e solta ao sair do painel', async () => {
    const { api, state } = fakeWakeLock()
    const lock = createScreenWakeLock({ api, visible: () => true })
    await lock.start()
    expect([state.requests, lock.isHeld()]).toEqual([1, true])
    lock.stop()
    await settle()
    expect([state.releases, lock.isHeld()]).toEqual([1, false])
  })

  it('nunca dois pedidos ao mesmo tempo, nem um segundo enquanto o primeiro vale', async () => {
    const { api, state } = fakeWakeLock()
    const lock = createScreenWakeLock({ api, visible: () => true })
    await Promise.all([lock.start(), lock.onVisibilityChange(), lock.onVisibilityChange()])
    await lock.onVisibilityChange()
    expect(state.requests).toBe(1)
  })

  it('aba escondida: o navegador solta; ao voltar a ficar visível, pede de novo', async () => {
    const { api, state } = fakeWakeLock()
    let visible = true
    const lock = createScreenWakeLock({ api, visible: () => visible })
    await lock.start()
    visible = false
    state.sentinels[0].browserRelease()
    await lock.onVisibilityChange()
    expect([lock.isHeld(), state.requests]).toEqual([false, 1])
    visible = true
    await lock.onVisibilityChange()
    expect([lock.isHeld(), state.requests]).toEqual([true, 2])
  })

  it('aba escondida ao abrir: não pede até ficar visível', async () => {
    const { api, state } = fakeWakeLock()
    let visible = false
    const lock = createScreenWakeLock({ api, visible: () => visible })
    await lock.start()
    expect(state.requests).toBe(0)
    visible = true
    await lock.onVisibilityChange()
    expect(state.requests).toBe(1)
  })

  it('navegador sem a API, ou pedido recusado: segue sem erro', async () => {
    const without = createScreenWakeLock({ api: null, visible: () => true })
    await expect(without.start()).resolves.toBeUndefined()
    without.stop()
    const { api, state } = fakeWakeLock({ reject: true })
    const refused = createScreenWakeLock({ api, visible: () => true })
    await expect(refused.start()).resolves.toBeUndefined()
    expect([state.requests, refused.isHeld()]).toEqual([1, false])
  })

  it('saiu do painel enquanto o navegador respondia: solta na hora e não volta a pedir', async () => {
    const { api, state } = fakeWakeLock()
    const lock = createScreenWakeLock({ api, visible: () => true })
    const pending = lock.start()
    lock.stop()
    await pending
    await settle()
    await lock.onVisibilityChange()
    expect([state.requests, state.releases, lock.isHeld()]).toEqual([1, 1, false])
  })
})
