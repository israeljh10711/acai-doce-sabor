import type { ComponentPropsWithoutRef } from 'react'
import { Flame } from '../../components/ui/icons.tsx'
import type { ExtraItem } from './extras.ts'
import { type ChooseItem, ItemActionButton, ItemPrice } from './ItemActions.tsx'
import { SellerDuplicateButton, SellerEditButton, SellerStockToggle } from '../seller/SellerAccess.tsx'
import { SoldOut } from './CatalogSections.tsx'
import { ExtraVisual } from './ItemVisual.tsx'

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
export function TopHighlightsStrip({ items, level, onChoose }: { items: readonly ExtraItem[]; level: 2 | 3; onChoose: ChooseItem }) {
  if (items.length === 0) return null
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
        <span className="rounded-full bg-gold-400 px-2.5 py-1 text-[0.7rem] font-extrabold tracking-wide whitespace-nowrap text-acai-950 uppercase">
          Pronto para pedir
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <li key={item.id}>
            <HighlightCard item={item} level={(level + 1) as 3 | 4} onChoose={onChoose} />
          </li>
        ))}
      </ul>
    </section>
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
