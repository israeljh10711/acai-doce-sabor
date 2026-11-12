import { useEffect, useRef } from 'react'
import type { Product } from '../catalog/menu.ts'
import { ILLUSTRATIVE_NOTICE } from '../catalog/notices.ts'
import type { Selection } from '../catalog/selection.ts'
import { ProductPreview } from './ProductPreview.tsx'
import { usePreview3D } from './usePreview3D.ts'

type Viewer3DDialogProps = {
  product: Product
  selection: Selection
  title: string
  open: boolean
  onClose: () => void
}

/**
 * Visualização 3D ampliada, para girar com o dedo no celular.
 * Usa o <dialog> nativo: prende o foco, fecha com Esc e deixa o resto da página inativo.
 */
export function Viewer3DDialog({ product, selection, title, open, onClose }: Viewer3DDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const preview = usePreview3D()
  const headingId = `${product.slug}-3d-titulo`

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
    if (!open) return
    // a página de trás não rola enquanto a visualização está aberta
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-cream-50 p-0 text-plum-950 backdrop:bg-plum-950/60"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-4 py-2">
            <h2 id={headingId} className="font-display text-xl font-semibold text-plum-900">
              {product.name} em 3D
            </h2>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-plum-700/35 px-4 text-sm font-semibold text-plum-900 hover:border-plum-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600"
            >
              <span aria-hidden="true">✕</span> Fechar
            </button>
          </div>

          <ProductPreview
            slug={product.slug}
            sizeId={selection.sizeId}
            flavorId={selection.flavorId}
            toppings={selection.toppings}
            title={title}
            mode={preview.mode}
            onReady={preview.onReady}
            onError={preview.onError}
            interactive
            className="min-h-0 flex-1"
          />

          <div className="border-t border-cream-200 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-plum-900">
              {preview.mode === 'unavailable'
                ? 'A visualização 3D não está disponível neste aparelho. Mostramos a prévia ilustrada.'
                : 'Arraste para girar.'}
            </p>
            <p className="mt-1 text-xs text-plum-950/75">{ILLUSTRATIVE_NOTICE}</p>
          </div>
        </div>
      )}
    </dialog>
  )
}
