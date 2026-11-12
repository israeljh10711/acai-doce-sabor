import { useRef, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery.ts'
import { formatBRL } from '../../utils/money.ts'
import type { Product } from '../catalog/menu.ts'
import { ILLUSTRATIVE_NOTICE } from '../catalog/notices.ts'
import { ProductPreview } from '../configurator-3d/ProductPreview.tsx'
import { usePreview3D } from '../configurator-3d/usePreview3D.ts'
import { Viewer3DDialog } from '../configurator-3d/Viewer3DDialog.tsx'
import { AnimatedValue } from './AnimatedValue.tsx'
import { previewTitle } from './messages.ts'
import type { ConfiguratorApi } from './useConfigurator.ts'

const UNAVAILABLE_TEXT =
  'A visualização 3D não está disponível neste aparelho. Mostramos a prévia ilustrada.'

const linkClass =
  'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-berry-700 underline underline-offset-4 hover:text-berry-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600'

/**
 * Prévia do pedido: a imagem 3D (ou a ilustração, enquanto o 3D carrega), o tamanho,
 * os grátis usados e o total.
 * - Celular: fica fixa no topo, compacta e sem girar (não rouba a rolagem); "Ver em 3D"
 *   abre a visualização ampliada, que gira com o dedo.
 * - Computador: acompanha a rolagem e gira arrastando.
 */
export function PreviewPanel({ product, cfg }: { product: Product; cfg: ConfiguratorApi }) {
  const isDesktop = useMediaQuery('(min-width: 64rem)')
  const preview = usePreview3D()
  const [viewerOpen, setViewerOpen] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)

  const flavor = product.flavors.find((candidate) => candidate.id === cfg.selection.flavorId)
  const hasFreeLimit = product.groups.includes('dry')
  const caption = cfg.size
    ? [cfg.size.name, flavor?.name].filter(Boolean).join(' · ')
    : 'Escolha o tamanho para começar'
  const title = previewTitle(product, cfg.selection)
  const unavailable = preview.mode === 'unavailable'

  const closeViewer = () => {
    setViewerOpen(false)
    opener.current?.focus()
  }

  return (
    <section
      aria-label="Prévia do pedido"
      className="rounded-2xl border border-cream-200 bg-cream-100 p-3 lg:p-6"
    >
      <div className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-4">
        <ProductPreview
          slug={product.slug}
          sizeId={cfg.selection.sizeId}
          flavorId={cfg.selection.flavorId}
          toppings={cfg.selection.toppings}
          title={title}
          mode={preview.mode}
          onReady={preview.onReady}
          onError={preview.onError}
          interactive={isDesktop}
          paused={viewerOpen}
          className="size-24 shrink-0 overflow-hidden rounded-xl bg-white/60 min-[360px]:size-28 sm:size-32 lg:mx-auto lg:aspect-square lg:size-auto lg:w-full lg:max-w-sm"
        />

        <div className="min-w-0 flex-1 lg:text-center">
          <p className="truncate text-sm font-medium text-plum-950/75">{caption}</p>
          <p className="font-display text-3xl font-semibold tracking-tight text-plum-900 sm:text-4xl">
            <span className="sr-only">Total: </span>
            <AnimatedValue value={cfg.price ? formatBRL(cfg.price.totalCents) : '—'} />
          </p>
          {hasFreeLimit && cfg.size && (
            <p className="text-sm text-plum-950/75">
              {cfg.freeUsed} de {cfg.freeLimit} grátis
            </p>
          )}

          <div className="flex flex-wrap gap-x-4 lg:hidden">
            {!unavailable && (
              <button ref={opener} type="button" onClick={() => setViewerOpen(true)} className={linkClass}>
                Ver em 3D <span aria-hidden="true">⤢</span>
              </button>
            )}
            {/* Em telas muito estreitas o link sai, para a prévia fixa ocupar menos espaço;
                o resumo continua logo abaixo, na rolagem. */}
            <a href="#resumo" className={`${linkClass} hidden min-[360px]:inline-flex`}>
              Ver resumo
            </a>
          </div>

          {isDesktop && preview.mode === '3d' && (
            <p className="text-sm font-semibold text-plum-900">Arraste a imagem para girar.</p>
          )}
        </div>
      </div>

      {unavailable && (
        <p className="mt-2 text-xs font-semibold text-plum-900 lg:mt-3 lg:text-center lg:text-sm">
          {UNAVAILABLE_TEXT}
        </p>
      )}
      <p className="mt-2 text-xs leading-snug text-plum-950/75 lg:mt-4 lg:text-center lg:text-sm">
        {ILLUSTRATIVE_NOTICE}
      </p>

      {!isDesktop && (
        <Viewer3DDialog
          product={product}
          selection={cfg.selection}
          title={title}
          open={viewerOpen}
          onClose={closeViewer}
        />
      )}
    </section>
  )
}
