import { createContext, useContext } from 'react'
import type { AnyChange, ChangeKind } from '../../services/sellerCatalogStore.ts'

/** O que o vendedor pode editar: um item das seções, um dos 4 produtos ou um complemento. */
export type EditTarget =
  /** `copyOf`: "Duplicar" (pedido de 2026-11-17), cadastro novo preenchido com esse item. */
  | { kind: 'item'; id: string | null; drawer?: string; copyOf?: string }
  | { kind: 'product'; id: string }
  | { kind: 'topping'; id: string | null; group?: string }
  /** Nome (e subtítulo) de uma seção, ou o título do grupo "Monte do seu jeito" (`monte`). */
  | { kind: 'section'; id: string }

export type SellerMode = {
  /** Onde as mudanças ficam: no Supabase (para todos) ou só neste aparelho. */
  backendKind: 'local' | 'supabase'
  /** Modo vendedor ligado (senha certa nesta sessão). */
  active: boolean
  openAuth(): void
  signIn(password: string): Promise<boolean>
  signOut(): Promise<void>
  changePassword(next: string): Promise<boolean>
  save(kind: ChangeKind, id: string, change: AnyChange | null): Promise<void>
  uploadPhoto(blob: Blob): Promise<string>
  exportBackup(): Promise<string>
  importBackup(json: string): Promise<void>
  /** Abre o formulário de editar ou de adicionar (`id: null`). */
  edit(target: EditTarget): void
}

export const SellerModeContext = createContext<SellerMode | null>(null)

/** O modo vendedor (o `SellerModeProvider` fica no `AppLayout`). */
export function useSellerMode(): SellerMode {
  const mode = useContext(SellerModeContext)
  if (!mode) throw new Error('useSellerMode fora do SellerModeProvider')
  return mode
}
