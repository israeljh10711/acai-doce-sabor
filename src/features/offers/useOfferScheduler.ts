import { useEffect, useState, useSyncExternalStore } from 'react'
import { useCatalogVersion } from '../catalog/catalogStore.ts'
import { featuredOffers, getOffer } from './offerNotifications.ts'
import { OfferScheduler, type StorageLike } from './offerScheduler.ts'

function sessionStore(): StorageLike | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Relógio das notificações de ofertas enquanto o cardápio está na tela. `blocked` (janela
 * aberta, busca, aviso do carrinho) some com a oferta e para a contagem; a aba escondida
 * também conta como bloqueio.
 */
export function useOfferScheduler(blocked: boolean) {
  const [scheduler] = useState(
    () => new OfferScheduler(featuredOffers().map((offer) => offer.id), { storage: sessionStore() }),
  )
  const snapshot = useSyncExternalStore(scheduler.subscribe, scheduler.getSnapshot, scheduler.getSnapshot)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)

  useEffect(() => {
    const update = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  // O vendedor mudou as ofertas: o sorteio passa a usar as de agora.
  const version = useCatalogVersion()
  useEffect(() => {
    scheduler.setIds(featuredOffers().map((offer) => offer.id))
  }, [scheduler, version])

  useEffect(() => {
    scheduler.start()
    return () => scheduler.dispose()
  }, [scheduler])

  useEffect(() => {
    scheduler.setBlocked(blocked || hidden)
  }, [scheduler, blocked, hidden])

  return { scheduler, snapshot, offer: getOffer(snapshot.offerId) }
}
