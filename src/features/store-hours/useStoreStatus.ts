import { useSyncExternalStore } from 'react'
import { getStoreSettings, subscribeCatalog } from '../catalog/catalogStore.ts'
import { type EffectiveStatus, effectiveStatus } from './hours.ts'
import { serverNow, sinceLastSync, syncServerClock } from './serverClock.ts'

/** Revisão do estado: no máximo a cada minuto, e na hora exata de abrir ou fechar. */
const MAX_WAIT_MS = 60_000
/** Volta a perguntar a hora ao servidor quando a aba reaparece depois disso. */
const RESYNC_AFTER_MS = 15 * 60_000

/** Estado da loja agora: o horário e o interruptor do vendedor (configurações da loja). */
export function storeStatusNow(): EffectiveStatus {
  return effectiveStatus(serverNow(), getStoreSettings())
}

let current: EffectiveStatus = storeStatusNow()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
let stopCatalog: (() => void) | undefined

function refresh() {
  const next = storeStatusNow()
  const changed =
    next.open !== current.open || next.detail !== current.detail || next.manual !== current.manual || next.reopenText !== current.reopenText
  current = changed ? next : { ...current, changesAt: next.changesAt }
  if (changed) for (const listener of listeners) listener()
  schedule()
}

function schedule() {
  clearTimeout(timer)
  if (listeners.size === 0) return
  const wait = Math.min(MAX_WAIT_MS, Math.max(1000, current.changesAt - serverNow() + 250))
  timer = setTimeout(refresh, wait)
}

function onVisible() {
  if (document.visibilityState !== 'visible') return
  if (sinceLastSync() > RESYNC_AFTER_MS) void syncServerClock().then(refresh)
  else refresh()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', onVisible)
    // O vendedor mudou o horário, o prazo ou o interruptor: o selo acompanha na hora.
    stopCatalog = subscribeCatalog(refresh)
    void syncServerClock().then(refresh)
    refresh()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      stopCatalog?.()
      stopCatalog = undefined
    }
  }
}

const getSnapshot = () => current

/** Estado atual da loja (aberta ou fechada, pelo horário ou pelo interruptor), sempre atualizado. */
export function useStoreStatus(): EffectiveStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
