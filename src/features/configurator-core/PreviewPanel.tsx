import { useRef, useState } from 'react'
import { Expand, Rotate } from '../../components/ui/icons.tsx'
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

const pill =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

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
      className="rounded-3xl bg-white p-2.5 ring-1 ring-line lg:p-5 lg:shadow-card"
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
          className="size-24 shrink-0 overflow-hidden rounded-2xl bg-acai-50 min-[360px]:size-28 sm:size-32 lg:mx-auto lg:aspect-square lg:size-auto lg:w-full lg:max-w-sm"
        />

        <div className="min-w-0 flex-1 lg:text-center">
          <p className="truncate text-sm font-semibold text-ink-soft">{caption}</p>
          <p className="nums text-3xl font-extrabold tracking-tight whitespace-nowrap text-acai-800 sm:text-4xl">
            <span className="sr-only">Total: </span>
            <AnimatedValue value={cfg.price ? formatBRL(cfg.price.totalCents) : '—'} />
          </p>
          {hasFreeLimit && cfg.size && (
            <p className="mt-1 inline-block rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-acai-950 ring-1 ring-gold-400">
              {cfg.freeUsed} de {cfg.freeLimit} grátis
            </p>
          )}

          {isDesktop && preview.mode === '3d' && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-acai-700">
              <Rotate className="size-4" />
              Arraste a imagem para girar.
            </p>
          )}
        </div>
      </div>

      {/* Celular: os dois botões numa linha só, na largura toda, para a prévia fixa ficar baixa. */}
      <div className="mt-2 flex gap-2 lg:hidden">
        {!unavailable && (
          <button
            ref={opener}
            type="button"
            onClick={() => setViewerOpen(true)}
            className={`${pill} flex-1 justify-center bg-acai-800 text-white hover:bg-acai-700 active:scale-[0.97]`}
          >
            Ver em 3D
            <Expand className="size-4" />
          </button>
        )}
        {/* Em telas muito estreitas o link sai, para a prévia fixa ocupar menos espaço;
            o resumo continua logo abaixo, na rolagem. */}
        <a href="#resumo" className={`${pill} btn-gold hidden flex-1 justify-center min-[360px]:inline-flex`}>
          Ver resumo
        </a>
      </div>

      {unavailable && (
        <p className="mt-2 text-xs font-semibold text-acai-800 lg:mt-3 lg:text-center lg:text-sm">
          {UNAVAILABLE_TEXT}
        </p>
      )}
      <p className="mt-2 text-xs leading-snug text-ink-soft lg:mt-4 lg:text-center lg:text-sm">
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
