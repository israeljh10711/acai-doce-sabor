import { type RefObject, useEffect, useRef } from 'react'
import { Logo } from '../../components/brand/Logo.tsx'
import { Close } from '../../components/ui/icons.tsx'
import { storeInfo } from '../../services/storeInfo.ts'
import type { NavEntry } from './catalogNav.ts'
import { CategoryList, OffersShortcut } from './CatalogSidebar.tsx'

type MobileCategoryDrawerProps = {
  open: boolean
  onClose: () => void
  entries: readonly NavEntry[]
  current: string | null
  /** Seção escolhida: chamada depois que o menu fecha. */
  onGo: (anchor: string) => void
  /** O botão "Categorias": recebe o foco de volta quando o menu fecha sem escolha. */
  opener: RefObject<HTMLElement | null>
}

/**
 * Menu das categorias no celular e no tablet (pedido de 2026-11-16): desliza pela esquerda, sobre
 * um fundo escuro. Tem a logo, o X, o atalho de ofertas e as 9 seções com ícones e contagens.
 * É um <dialog> nativo: prende o foco, fecha no Esc, no X ou num toque fora. Escolher uma seção
 * fecha o menu e leva até ela; fechar sem escolher devolve o foco ao botão "Categorias".
 */
export function MobileCategoryDrawer({ open, onClose, entries, current, onGo, opener }: MobileCategoryDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const chosen = useRef<string | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    else if (!open && element.open) element.close()
  }, [open])

  const choose = (anchor: string) => {
    chosen.current = anchor
    dialog.current?.close()
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="menu-categorias-titulo"
      onClose={() => {
        const anchor = chosen.current
        chosen.current = null
        onClose()
        if (anchor) onGo(anchor)
        else opener.current?.focus()
      }}
      // Toque no fundo escuro (fora do painel) fecha.
      onClick={(event) => event.target === dialog.current && dialog.current.close()}
      className="fixed inset-y-0 right-auto left-0 m-0 h-dvh max-h-dvh w-80 max-w-[85vw] -translate-x-full overflow-y-auto overscroll-contain bg-white p-0 shadow-2xl transition-[translate,overlay,display] transition-discrete duration-300 ease-out backdrop:bg-black/50 backdrop:backdrop-blur-xs open:translate-x-0 motion-reduce:transition-none starting:open:-translate-x-full"
    >
      <div className="flex min-h-full flex-col px-4 pt-4 pb-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo version="badge" sizes="44px" className="size-11 shrink-0" decorative />
            <div className="min-w-0">
              <p id="menu-categorias-titulo" className="font-display text-lg leading-tight font-black tracking-tight text-acai-800 uppercase">
                Categorias
              </p>
              <p className="truncate text-xs text-ink-soft" translate="no">
                {storeInfo.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar categorias"
            onClick={() => dialog.current?.close()}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-acai-800 ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <Close className="size-5" />
          </button>
        </div>
        <OffersShortcut onGo={choose} />
        <nav aria-label="Categorias do cardápio" className="mt-4">
          <CategoryList entries={entries} current={current} onGo={choose} />
        </nav>
      </div>
    </dialog>
  )
}
