import { ProductIllustration } from '../catalog/illustration/ProductIllustration.tsx'
import type { Product } from '../catalog/menu.ts'
import { ILLUSTRATIVE_NOTICE } from '../catalog/notices.ts'
import { formatBRL } from '../../utils/money.ts'
import { AnimatedValue } from './AnimatedValue.tsx'
import { previewTitle } from './messages.ts'
import type { ConfiguratorApi } from './useConfigurator.ts'

/**
 * Prévia do pedido: a ilustração, o tamanho, os grátis usados e o total.
 * No celular fica fixa no topo, compacta; no computador acompanha a rolagem.
 */
export function PreviewPanel({ product, cfg }: { product: Product; cfg: ConfiguratorApi }) {
  const flavor = product.flavors.find((candidate) => candidate.id === cfg.selection.flavorId)
  const hasFreeLimit = product.groups.includes('dry')
  const caption = cfg.size
    ? [cfg.size.name, flavor?.name].filter(Boolean).join(' · ')
    : 'Escolha o tamanho para começar'

  return (
    <section
      aria-label="Prévia do pedido"
      className="rounded-2xl border border-cream-200 bg-cream-100 p-3 lg:p-6"
    >
      <div className="flex items-center gap-3 lg:flex-col lg:items-stretch lg:gap-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-white/60 min-[360px]:size-28 sm:size-32 lg:mx-auto lg:aspect-square lg:size-auto lg:w-full lg:max-w-sm">
          <ProductIllustration
            slug={product.slug}
            sizeId={cfg.selection.sizeId}
            flavorId={cfg.selection.flavorId}
            toppings={cfg.selection.toppings}
            title={previewTitle(product, cfg.selection)}
            className="size-full"
          />
        </div>

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
          {/* Em telas muito estreitas o link sai, para a prévia fixa ocupar menos espaço;
              o resumo continua logo abaixo, na rolagem. */}
          <a
            href="#resumo"
            className="hidden min-h-11 items-center text-sm font-semibold text-berry-700 underline underline-offset-4 hover:text-berry-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600 min-[360px]:inline-flex lg:hidden"
          >
            Ver resumo
          </a>
        </div>
      </div>

      <p className="mt-2 text-xs leading-snug text-plum-950/75 lg:mt-4 lg:text-center lg:text-sm">
        {ILLUSTRATIVE_NOTICE}
      </p>
    </section>
  )
}
