/**
 * O painel ao vivo no site (2026-11-20): uma loja de pedidos só, com a fonte certa para o modo
 * em uso (Supabase + Realtime, ou a demonstração local), e os ganchos que a faixa do vendedor e
 * a página "Pedidos" usam. Enquanto o vendedor estiver logado, a faixa mantém a escuta ligada em
 * qualquer página (o contador e o som); ao sair do Modo Vendedor, ela para.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { getSupabaseRest, supabaseConfig } from '../seller/sellerBackend.ts'
import { serverNow } from '../store-hours/serverClock.ts'
import { browserDemoDeps, createLocalOrdersSource } from './localOrdersSource.ts'
import { type SoundState, soundAlert } from './orderAlert.ts'
import { type OrdersLive, type OrdersSnapshot, createOrdersLive } from './ordersLive.ts'
import { connectRealtime } from './realtimeConnect.ts'
import { createSupabaseOrdersSource } from './supabaseOrdersSource.ts'

let instance: OrdersLive | null = null

/**
 * A loja de pedidos do site. Com o Supabase configurado, sempre o Supabase (uma falha aparece
 * como erro, nunca vira o modo local); sem ele, a demonstração local.
 */
export function getOrdersLive(): OrdersLive {
  if (instance) return instance
  const rest = getSupabaseRest()
  const config = supabaseConfig()
  const source =
    rest && config
      ? createSupabaseOrdersSource({ rest, url: config.url, key: config.key, now: serverNow, connect: connectRealtime })
      : createLocalOrdersSource(browserDemoDeps())
  instance = createOrdersLive({ source, alert: soundAlert, visible: () => document.visibilityState === 'visible', now: serverNow })
  return instance
}

export function useOrders(): OrdersSnapshot {
  const live = getOrdersLive()
  return useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot)
}

/**
 * Mantém a escuta ligada enquanto o componente estiver na tela (a faixa do vendedor; a página
 * também, para funcionar antes de a faixa carregar). Ao voltar para a aba, confere de novo; o
 * primeiro toque na página libera o som.
 */
export function useOrdersConnection(): void {
  useEffect(() => {
    const live = getOrdersLive()
    live.start()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void live.refresh()
    }
    const unlock = () => soundAlert.unlock()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      live.stop()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
}

export function useSoundState(): SoundState {
  return useSyncExternalStore(soundAlert.subscribe, soundAlert.state, soundAlert.state)
}
