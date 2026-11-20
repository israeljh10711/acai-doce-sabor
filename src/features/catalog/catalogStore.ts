/**
 * O cardápio que o site mostra agora: o do código com as mudanças do vendedor por cima
 * (modo vendedor, pedido de 2026-11-16). O estado fica em `catalogState.ts` (sem React, usado
 * também pela função do pedido no servidor); aqui ficam os ganchos que redesenham a tela.
 */
import { useSyncExternalStore } from 'react'
import { type StoreSettings } from '../store/storeSettings.ts'
import { catalogVersion, getStoreSettings, subscribeCatalog } from './catalogState.ts'

export { catalogVersion, getCatalogChanges, getStoreSettings, setCatalogChanges, setPhotoUrls, subscribeCatalog } from './catalogState.ts'

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
