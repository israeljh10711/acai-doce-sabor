/**
 * O cardápio que o site mostra agora (do banco desde 2026-11-21; ver `catalogState.ts`, que não
 * usa React e serve também à função do pedido). Aqui ficam os ganchos que redesenham a tela.
 */
import { useSyncExternalStore } from 'react'
import { type StoreSettings } from '../store/storeSettings.ts'
import { type CatalogStatus, catalogVersion, getCatalogStatus, getStoreSettings, subscribeCatalog } from './catalogState.ts'

export {
  catalogVersion,
  getCatalogChanges,
  getCatalogRecords,
  getCatalogStatus,
  getLiveOffers,
  getStoreSettings,
  refreshCatalogClock,
  setCatalogChanges,
  setCatalogRecords,
  setCatalogStatus,
  setPhotoUrls,
  subscribeCatalog,
} from './catalogState.ts'

/** Configurações da loja, redesenhando quando o vendedor muda alguma. */
export function useStoreSettings(): StoreSettings {
  return useSyncExternalStore(subscribeCatalog, getStoreSettings, getStoreSettings)
}

/**
 * Redesenha o componente quando o cardápio muda. Fica nas páginas (cardápio, personalizador,
 * carrinho): os componentes de dentro leem os dados atuais ao redesenhar.
 */
export function useCatalogVersion(): number {
  return useSyncExternalStore(subscribeCatalog, catalogVersion, catalogVersion)
}

/** Situação da leitura do cardápio (carregando, pronto ou erro). */
export function useCatalogStatus(): CatalogStatus {
  return useSyncExternalStore(subscribeCatalog, getCatalogStatus, getCatalogStatus)
}
