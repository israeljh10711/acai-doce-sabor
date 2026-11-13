import { useSyncExternalStore } from 'react'
import { type StoreStatus, storeStatusAt } from './hours.ts'
import { serverNow, sinceLastSync, syncServerClock } from './serverClock.ts'

/** Revisão do estado: no máximo a cada minuto, e na hora exata de abrir ou fechar. */
const MAX_WAIT_MS = 60_000
/** Volta a perguntar a hora ao servidor quando a aba reaparece depois disso. */
const RESYNC_AFTER_MS = 15 * 60_000

let current: StoreStatus = storeStatusAt(serverNow())
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

function refresh() {
  const next = storeStatusAt(serverNow())
  const changed = next.open !== current.open || next.detail !== current.detail
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
    void syncServerClock().then(refresh)
    schedule()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

const getSnapshot = () => current

/** Estado atual da loja (aberta ou fechada), sempre atualizado. */
export function useStoreStatus(): StoreStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
