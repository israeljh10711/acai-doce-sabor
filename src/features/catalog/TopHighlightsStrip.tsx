import type { ComponentPropsWithoutRef } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Flame } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { isProductAvailable } from './availability.ts'
import type { Category } from './categories.ts'
import type { ExtraItem } from './extras.ts'
import { type ChooseItem, ItemActionButton, ItemPrice } from './ItemActions.tsx'
import { SellerDuplicateButton, SellerEditButton, SellerStockToggle } from '../seller/SellerAccess.tsx'
import { SoldOut } from './CatalogSections.tsx'
import { ExtraVisual } from './ItemVisual.tsx'
import { ProductPhoto } from './ProductPhoto.tsx'
import { startingPriceCents } from './showcase.ts'

function Heading({ level, ...props }: { level: 2 | 3 | 4 } & ComponentPropsWithoutRef<'h2'>) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4'
  return <Tag {...props} />
}

/**
 * Faixa "Mais pedidos & ofertas do dia" (pedido de 2026-11-16), logo abaixo da busca: os 5
 * carros-chefes com foto (que amplia), nome, preço e "Pedir", que abre o mesmo caminho do item
 * na seção (personalizador, escolha de sabor ou confirmação). Na busca, só os encontrados; sem
 * nenhum, a faixa some.
 */
export function TopHighlightsStrip({
  products,
  items,
  level,
  onChoose,
}: {
  /** Os carros-chefes (Açaí Oca, Tradicional, Batido e Milk-shake), na frente. */
  products: readonly Category[]
  items: readonly ExtraItem[]
  level: 2 | 3
  onChoose: ChooseItem
}) {
  if (products.length === 0 && items.length === 0) return null
  return (
    <section aria-labelledby="destaques-titulo" data-highlights="">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-4">
        <Heading
          level={level}
          id="destaques-titulo"
          className="flex items-center gap-2 font-display text-xl leading-tight font-black tracking-tight text-acai-800 uppercase sm:text-2xl"
        >
          <Flame className="size-6 text-acai-600" />
          Mais pedidos & ofertas do dia
        </Heading>
        <span className="rounded-full bg-orchid-400 px-2.5 py-1 text-[0.7rem] font-extrabold tracking-wide whitespace-nowrap text-acai-950 uppercase">
          Pronto para pedir
        </span>
      </div>
      {products.length > 0 && (
        <ul data-highlights-main="" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {products.map((category) => (
            <li key={category.slug}>
              <FlagshipCard category={category} level={(level + 1) as 3 | 4} />
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 ${products.length > 0 ? 'mt-3' : ''}`}>
          {items.map((item) => (
            <li key={item.id}>
              <HighlightCard item={item} level={(level + 1) as 3 | 4} onChoose={onChoose} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Carro-chefe na faixa (pedido de 2026-11-23): foto quadrada, nome, preço inicial e "Personalizar",
 * que abre o personalizador do produto. A edição e o "Esgotado" do vendedor ficam no cartão do
 * produto, mais abaixo: aqui só leva ao pedido. Marcador próprio (`data-highlight-main`): o
 * `data-highlight` continua sendo só dos itens.
 */
function FlagshipCard({ category, level }: { category: Category; level: 3 | 4 }) {
  const nameId = `${category.slug}-destaque-nome`
  const available = isProductAvailable(category.slug)
  return (
    <article
      aria-labelledby={nameId}
      data-highlight-main={category.slug}
      className="flex h-full flex-col rounded-2xl bg-white p-2.5 shadow-card ring-1 ring-line"
    >
      <div className="relative overflow-hidden rounded-xl">
        <ProductPhoto slug={category.slug} sizes="(min-width: 40rem) 22vw, 46vw" className="w-full" />
        <SoldOut available={available} />
      </div>
      <Heading level={level} id={nameId} className="mt-2.5 font-display text-base leading-snug font-extrabold text-acai-800 sm:text-lg">
        {category.name}
      </Heading>
      <p className="nums text-sm text-ink-soft">
        a partir de <strong className="font-extrabold text-acai-800">{formatBRL(startingPriceCents(category.slug))}</strong>
      </p>
      {available ? (
        <Link
          to={paths.configurator(category.slug)}
          className="btn-primary mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-4 text-sm font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
        >
          Personalizar
          <ArrowRight className="size-4" />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-3 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-full bg-line px-4 text-sm font-bold text-ink-soft"
        >
          Indisponível no momento
          <span className="sr-only">: {category.name}</span>
        </button>
      )}
    </article>
  )
}

function HighlightCard({ item, level, onChoose }: { item: ExtraItem; level: 3 | 4; onChoose: ChooseItem }) {
  const nameId = `${item.id}-destaque-nome`
  return (
    <article
      aria-labelledby={nameId}
      data-highlight={item.id}
      data-product-id={item.id}
      className="flex h-full flex-col rounded-2xl bg-white p-2.5 shadow-card ring-1 ring-line"
    >
      <div className="relative">
        <ExtraVisual item={item} size="fill" zoom sizes="(min-width: 80rem) 170px, (min-width: 40rem) 30vw, 46vw" />
        <SoldOut available={item.available !== false} />
        <SellerEditButton target={{ kind: 'item', id: item.id }} label={item.name} className="absolute top-1.5 left-1.5 z-20" />
        <SellerStockToggle kind="items" id={item.id} available={item.available !== false} label={item.name} className="absolute right-1.5 bottom-1.5 z-20" />
      </div>
      <Heading level={level} id={nameId} className="mt-2.5 font-display text-sm leading-snug font-black text-acai-800 sm:text-base">
        {item.name}
      </Heading>
      <div className="mt-auto pt-2">
        <ItemPrice item={item} size="base" />
      </div>
      <ItemActionButton item={item} onChoose={onChoose} label="Pedir" className="mt-2.5 w-full" />
      <SellerDuplicateButton item={item} className="mt-2 self-end" />
    </article>
  )
}
