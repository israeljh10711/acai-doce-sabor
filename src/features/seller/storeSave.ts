import { STORE_SETTINGS_ID } from '../catalog/catalogChanges.ts'
import { getCatalogChanges } from '../catalog/catalogStore.ts'
import type { StoreSettingsChange } from '../store/storeSettings.ts'
import type { SellerMode } from './sellerModeContext.ts'

/**
 * Grava uma parte das configurações da loja (pedido de 2026-11-17), mantendo o resto do que o
 * vendedor já tinha mudado. Vale na hora no site (aparelho ou Supabase).
 */
export function saveStore(seller: SellerMode, patch: StoreSettingsChange): Promise<void> {
  const current = getCatalogChanges().settings[STORE_SETTINGS_ID] ?? {}
  return seller.save('settings', STORE_SETTINGS_ID, { ...current, ...patch })
}
