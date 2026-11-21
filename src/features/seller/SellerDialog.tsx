import { type ReactNode, useEffect, useRef } from 'react'
import { Close } from '../../components/ui/icons.tsx'

/**
 * Janela das telas do vendedor: <dialog> nativo (prende o foco e fecha no Esc), com título, X e
 * rolagem própria. No celular ocupa quase a tela toda.
 */
export function SellerDialog({
  title,
  titleId,
  description,
  onClose,
  children,
  wide = false,
  extraWide = false,
}: {
  title: string
  titleId: string
  description?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  /** O editor de produto do painel (2026-11-21): até 48rem. */
  extraWide?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    opener.current = document.activeElement
    if (!element.open) element.showModal()
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus()
    }
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      className={`m-auto max-h-[94dvh] overflow-hidden rounded-3xl bg-white p-0 shadow-lift backdrop:bg-acai-950/70 ${extraWide ? 'w-[min(96vw,48rem)]' : wide ? 'w-[min(94vw,34rem)]' : 'w-[min(94vw,26rem)]'}`}
    >
      <div className="flex max-h-[94dvh] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-5 pb-4">
          <div>
            <h2 id={titleId} className="font-display text-xl font-black tracking-tight text-acai-800">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => dialog.current?.close()}
            className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-acai-800 ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <Close className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </dialog>
  )
}
