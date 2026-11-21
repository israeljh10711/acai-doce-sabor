import { type ReactNode, Suspense, lazy, useMemo, useState } from 'react'
import { setCatalogChanges, setPhotoUrls } from '../catalog/catalogStore.ts'
import { addPhotoUrl, catalogForBackup, cleanupPhotos, getSellerBackend, restoreCatalogFromBackup } from './sellerBackend.ts'
import { type EditTarget, type SellerMode, SellerModeContext } from './sellerModeContext.ts'

// As telas do vendedor só carregam quando alguém abre (o cliente não baixa nada disso).
const SellerAuthModal = lazy(() => import('./SellerAuthModal.tsx').then((module) => ({ default: module.SellerAuthModal })))
// Cardápio dinâmico (2026-11-21): os editores do painel, que gravam no banco.
const StorefrontEditor = lazy(() => import('../admin/StorefrontEditor.tsx').then((module) => ({ default: module.StorefrontEditor })))

/**
 * Modo vendedor / dono (pedido de 2026-11-16): sessão, gravação das mudanças e as janelas de
 * senha e de edição. As mudanças gravadas valem na hora em todo o site (`catalogStore.ts`).
 */
export function SellerModeProvider({ children }: { children: ReactNode }) {
  const backend = getSellerBackend()
  const [active, setActive] = useState(() => {
    try {
      return backend.isSignedIn()
    } catch {
      return false
    }
  })
  const [authOpen, setAuthOpen] = useState(false)
  const [target, setTarget] = useState<EditTarget | null>(null)

  const value = useMemo<SellerMode>(
    () => ({
      backendKind: backend.kind,
      active,
      openAuth: () => setAuthOpen(true),
      async signIn(password) {
        const ok = await backend.signIn(password)
        if (ok) setActive(true)
        return ok
      },
      async signOut() {
        await backend.signOut()
        setActive(false)
        setTarget(null)
      },
      changePassword: (next) => backend.changePassword(next),
      async save(kind, id, change) {
        setCatalogChanges(await backend.save(kind, id, change))
        void cleanupPhotos()
      },
      async uploadPhoto(blob) {
        const ref = await backend.uploadPhoto(blob)
        addPhotoUrl(ref, blob)
        return ref
      },
      // Backup v2 (2026-11-21): com o cardápio.
      exportBackup: () => backend.exportBackup(catalogForBackup()),
      async importBackup(json) {
        setCatalogChanges(await backend.importBackup(json))
        restoreCatalogFromBackup(json)
        setPhotoUrls(await backend.loadPhotoUrls())
        void cleanupPhotos()
      },
      edit: (next) => setTarget(next),
    }),
    [backend, active],
  )

  return (
    <SellerModeContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {authOpen && <SellerAuthModal onClose={() => setAuthOpen(false)} />}
        {active && target && <StorefrontEditor target={target} onClose={() => setTarget(null)} />}
      </Suspense>
    </SellerModeContext.Provider>
  )
}
