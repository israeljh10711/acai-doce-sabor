/**
 * O acompanhamento no site (pedido 100% no site, 2026-11-20): as peças únicas por aba e os
 * ganchos das telas.
 * - Com o Supabase configurado: a sessão anônima do cliente, a função `pedido` e o Realtime de
 *   `order_events` filtrado pela sessão (o RLS só entrega os eventos do dono).
 * - Sem ele: o modo de demonstração (os pedidos deste navegador, avisos pelo BroadcastChannel).
 *
 * A biblioteca do Realtime só é baixada quando o cliente tem pedido para acompanhar.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { type CustomerSession, createCustomerSession } from '../../services/customerSession.ts'
import { DEMO_CHANNEL, DEMO_KEY, browserDemoDeps } from '../orders/localOrdersSource.ts'
import { realtimeEndpoint } from '../orders/supabaseOrdersSource.ts'
import { supabaseConfig } from '../seller/sellerBackend.ts'
import { ADD_MODE_KEY, type AddMode, type AddModeStore, createAddMode } from './addMode.ts'
import { type Attempts, createAttempts } from './attempts.ts'
import { type CustomerListen, type CustomerLive, type CustomerLiveSnapshot, createCustomerLive } from './customerLive.ts'
import { TRACKED_KEY, type TrackedOrder, type TrackedStore, createTrackedOrders } from './trackedOrders.ts'
import { type TrackingApi, createDemoTracking, createSupabaseTracking } from './trackingApi.ts'

const browserStorage = (kind: 'localStorage' | 'sessionStorage'): Storage | null => {
  try {
    return globalThis[kind] ?? null
  } catch {
    return null
  }
}

const randomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

let session: CustomerSession | null | undefined
let tracked: TrackedStore | null = null
let addMode: AddModeStore | null = null
let attempts: Attempts | null = null
let api: TrackingApi | null = null
let live: CustomerLive | null = null
let storageWatched = false

/** As outras abas mudaram a lista de pedidos ou o modo de adição: avisa as telas desta. */
function watchStorage() {
  if (storageWatched || typeof window === 'undefined') return
  storageWatched = true
  window.addEventListener('storage', (event) => {
    if (event.key === TRACKED_KEY || event.key === null) tracked?.changed()
    if (event.key === ADD_MODE_KEY || event.key === null) addMode?.changed()
  })
}

/** A sessão anônima do cliente (só com o Supabase configurado). */
export function getCustomerSession(): CustomerSession | null {
  if (session !== undefined) return session
  const config = supabaseConfig()
  session = config ? createCustomerSession({ url: config.url, key: config.key, fetch: (input, init) => fetch(input, init), now: () => Date.now(), store: browserStorage('localStorage') }) : null
  return session
}

export function getTrackedOrders(): TrackedStore {
  watchStorage()
  tracked ??= createTrackedOrders(browserStorage('localStorage'), () => Date.now())
  return tracked
}

export function getAddMode(): AddModeStore {
  watchStorage()
  addMode ??= createAddMode(browserStorage('localStorage'), () => Date.now())
  return addMode
}

export function getAttempts(): Attempts {
  attempts ??= createAttempts(browserStorage('sessionStorage'), randomId)
  return attempts
}

export function getTrackingApi(): TrackingApi {
  if (api) return api
  const config = supabaseConfig()
  const customer = getCustomerSession()
  api = config && customer ? createSupabaseTracking({ url: config.url, key: config.key, session: customer }) : createDemoTracking(browserDemoDeps())
  return api
}

const liveState = (status: string) => (status === 'SUBSCRIBED' ? 'live' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' ? 'offline' : 'connecting')

/** A escuta do Supabase: eventos de `order_events` da sessão deste aparelho. */
function supabaseListen(config: { url: string; key: string }, customer: CustomerSession): CustomerListen {
  return (onChange, onState) => {
    const userId = customer.userId()
    // Sem sessão ainda (nenhum pedido acompanhado): fica na consulta de tempos em tempos.
    if (!userId) {
      onState('offline')
      return () => undefined
    }
    let stopped = false
    let connection: { stop(): void } | null = null
    onState('connecting')
    import('../orders/realtimeConnect.ts')
      .then(({ connectRealtime }) => {
        if (stopped) return
        connection = connectRealtime({
          endpoint: realtimeEndpoint(config.url),
          apikey: config.key,
          accessToken: () => customer.token({ create: false }),
          table: 'order_events',
          filter: `customer_user_id=eq.${userId}`,
          channel: 'acompanhamento-cliente',
          onChange: (_type, record) => {
            const orderId = typeof record === 'object' && record !== null && 'order_id' in record ? (record as { order_id: unknown }).order_id : null
            onChange(typeof orderId === 'string' ? orderId : null)
          },
          onStatus: (status) => onState(liveState(status)),
        })
      })
      .catch(() => onState('offline'))
    return () => {
      stopped = true
      connection?.stop()
    }
  }
}

/** A escuta da demonstração: o painel desta máquina avisa pelo BroadcastChannel e pelo `storage`. */
const demoListen: CustomerListen = (onChange, onState) => {
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(DEMO_CHANNEL)
  const onMessage = (event: MessageEvent) => {
    const id = typeof event.data === 'object' && event.data !== null && typeof event.data.id === 'string' ? event.data.id : null
    onChange(id)
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEMO_KEY || event.key === null) onChange(null)
  }
  channel?.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)
  onState('live')
  return () => {
    channel?.close()
    window.removeEventListener('storage', onStorage)
  }
}

export function getCustomerLive(): CustomerLive {
  if (live) return live
  const config = supabaseConfig()
  const customer = getCustomerSession()
  live = createCustomerLive({
    api: getTrackingApi(),
    tracked: getTrackedOrders(),
    listen: config && customer ? supabaseListen(config, customer) : demoListen,
    timers: {
      setInterval: (callback, ms) => window.setInterval(callback, ms),
      clearInterval: (id) => window.clearInterval(id),
      setTimeout: (callback, ms) => window.setTimeout(callback, ms),
      clearTimeout: (id) => window.clearTimeout(id),
    },
    visible: () => document.visibilityState === 'visible',
  })
  return live
}

/** Os pedidos guardados neste aparelho (mais novos primeiro). */
export function useTrackedOrders(): readonly TrackedOrder[] {
  const store = getTrackedOrders()
  return useSyncExternalStore(store.subscribe, store.list, store.list)
}

export function useAddMode(): AddMode | null {
  const store = getAddMode()
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

export function useCustomerLive(): CustomerLiveSnapshot {
  const store = getCustomerLive()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/**
 * Mantém a escuta ligada enquanto o componente estiver na tela (`enabled`), e confere de novo ao
 * voltar para a aba. Com `orderId`, aquele pedido é conferido mesmo encerrado.
 */
export function useCustomerConnection(enabled: boolean, orderId?: string | null): void {
  useEffect(() => {
    if (!enabled) return
    const store = getCustomerLive()
    const unwatch = orderId ? store.watch(orderId) : null
    store.start()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void store.refreshAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      store.stop()
      unwatch?.()
    }
  }, [enabled, orderId])
}
