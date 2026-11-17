import { Expand } from '../../components/ui/icons.tsx'
import { formatBRL } from '../../utils/money.ts'
import type { Product } from '../catalog/menu.ts'
import { ILLUSTRATIVE_NOTICE } from '../catalog/notices.ts'
import { ProductVisual } from '../catalog/ItemVisual.tsx'
import { isProductAvailable } from '../catalog/availability.ts'
import { SoldOut } from '../catalog/CatalogSections.tsx'
import { useLightbox } from '../lightbox/lightboxContext.ts'
import { productLightbox } from '../lightbox/lightboxImages.ts'
import { AnimatedValue } from './AnimatedValue.tsx'
import type { ConfiguratorApi } from './useConfigurator.ts'

const pill =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Prévia do pedido: a foto fixa do produto (a enviada pela loja; no Pote 1 L Montado e na Barca, a
 * foto da gaveta), o tamanho, os grátis e o total. A foto não muda com os ingredientes nem com o
 * recipiente escolhidos.
 * - Celular: fica fixa no topo, compacta; "Ver foto" (ou um toque na foto) abre a foto ampliada.
 * - Computador: acompanha a rolagem; um clique na foto abre a foto ampliada.
 */
export function PreviewPanel({ product, cfg }: { product: Product; cfg: ConfiguratorApi }) {
  const lightbox = useLightbox()

  const flavor = product.flavors.find((candidate) => candidate.id === cfg.selection.flavorId)
  const hasFreeLimit = product.groups.includes('dry')
  const caption = cfg.size
    ? [cfg.size.name, flavor?.name].filter(Boolean).join(' · ')
    : 'Monte na ordem que quiser'

  return (
    <section
      aria-label="Prévia do pedido"
      className="rounded-3xl bg-white p-2.5 ring-1 ring-line lg:p-5 lg:shadow-card"
    >
      <div className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-line min-[360px]:size-28 sm:size-32 lg:mx-auto lg:size-auto lg:w-full lg:max-w-sm">
          <ProductVisual slug={product.slug} sizes="(min-width: 64rem) 384px, 128px" className="size-full" priority zoom />
          <SoldOut available={isProductAvailable(product.slug)} />
        </div>

        <div className="min-w-0 flex-1 lg:text-center">
          <p className="truncate text-sm font-semibold text-ink-soft">{caption}</p>
          <p className="nums text-3xl font-extrabold tracking-tight whitespace-nowrap text-acai-800 sm:text-4xl">
            <span className="sr-only">Total: </span>
            <AnimatedValue value={cfg.price ? formatBRL(cfg.price.totalCents) : '—'} />
          </p>
          {cfg.selection.complete ? (
            <p className="mt-1 inline-block rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-acai-950 ring-1 ring-gold-400">
              Completo · {cfg.selectedCount} {cfg.selectedCount === 1 ? 'item' : 'itens'}
            </p>
          ) : (
            hasFreeLimit &&
            cfg.size && (
              <p className="mt-1 inline-block rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-bold text-acai-950 ring-1 ring-gold-400">
                {cfg.freeUsed} de {cfg.freeLimit} adicionais grátis
              </p>
            )
          )}
        </div>
      </div>

      {/* Celular: os dois botões numa linha só, para a prévia fixa ficar baixa. */}
      <div className="mt-2 flex gap-2 lg:hidden">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => lightbox.show(productLightbox(product.slug), event.currentTarget)}
          className={`${pill} flex-1 justify-center bg-acai-800 text-white hover:bg-acai-700 active:scale-[0.97]`}
        >
          Ver foto
          <Expand className="size-4" />
        </button>
        <a href="#resumo" className={`${pill} btn-gold hidden flex-1 justify-center min-[360px]:inline-flex`}>
          Ver resumo
        </a>
      </div>

      <p className="mt-2 text-xs leading-snug text-ink-soft lg:mt-4 lg:text-center lg:text-sm">{ILLUSTRATIVE_NOTICE}</p>

    </section>
  )
}
