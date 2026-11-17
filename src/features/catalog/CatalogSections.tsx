import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import type { ComponentPropsWithoutRef } from 'react'
import { ChevronDown } from '../../components/ui/icons.tsx'
import { type Drawer, type DrawerId, type ExtraItem, flavorCount } from './extras.ts'
import { type ChooseItem, ItemActionButton, ItemPrice } from './ItemActions.tsx'
import { ExtraVisual } from './ItemVisual.tsx'
import { SellerAddButton, SellerEditButton, SellerRenameButton } from '../seller/SellerAccess.tsx'
import { SectionIcon } from './SectionIcon.tsx'

type Level = 2 | 3 | 4 | 5

/** Título no nível certo da página (o cardápio fica em h2 no Cardápio e em h3 no início). */
function Heading({ level, ...props }: { level: Level } & ComponentPropsWithoutRef<'h2'>) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5'
  return <Tag {...props} />
}

const next = (level: Level) => Math.min(level + 1, 5) as Level

export type SectionView = {
  drawer: Drawer
  /** Itens a mostrar: todos, ou só os encontrados pela busca. */
  items: readonly ExtraItem[]
  open: boolean
  /**
   * Abre sem animar (pela navegação): a altura certa já existe quando a página rola até a seção,
   * e a rolagem para no lugar certo.
   */
  instant: boolean
}

type CatalogSectionsProps = {
  /** Nível do título "Catálogo completo". As seções e os itens vêm logo abaixo. */
  level: 2 | 3
  views: readonly SectionView[]
  searching: boolean
  onToggle: (id: DrawerId) => void
  onChoose: ChooseItem
}

/**
 * "Catálogo completo" (pedido de 2026-11-16, no lugar das gavetas de 2026-11-15): as 5 seções
 * abertas, com foto, preço e botão de compra de cada item à vista. Cada seção pode ser recolhida.
 * Na busca, só aparecem as seções com resultado, com a contagem do resultado.
 */
export function CatalogSections({ level, views, searching, onToggle, onChoose }: CatalogSectionsProps) {
  return (
    <section aria-labelledby="catalogo-completo-titulo">
      <div className="mb-5 sm:mb-6">
        <Heading
          level={level}
          id="catalogo-completo-titulo"
          className="font-display text-3xl font-black tracking-tight text-acai-800 uppercase sm:text-4xl"
        >
          Catálogo completo
        </Heading>
        <p className="mt-1 text-ink-soft">Combos, potes família, picolés, sorvetes, bebidas e doces.</p>
      </div>
      <div className="flex flex-col gap-8 sm:gap-10">
        {views.map((view) => (
          <CatalogSection
            key={view.drawer.id}
            view={view}
            level={next(level)}
            searching={searching}
            onToggle={() => onToggle(view.drawer.id)}
            onChoose={onChoose}
          />
        ))}
      </div>
    </section>
  )
}

function countText(total: number, searching: boolean): string {
  if (searching) return total === 1 ? '1 encontrado' : `${total} encontrados`
  return total === 1 ? '1 item' : `${total} itens`
}

function CatalogSection({
  view,
  level,
  searching,
  onToggle,
  onChoose,
}: {
  view: SectionView
  level: Level
  searching: boolean
  onToggle: () => void
  onChoose: ChooseItem
}) {
  const { drawer, items, open } = view
  const reduceMotion = useReducedMotion()
  const titleId = `${drawer.id}-titulo`
  const panelId = `${drawer.id}-itens`

  return (
    // A navegação leva o foco para a seção (tabIndex -1), sem contorno: o destaque dourado
    // do cabeçalho mostra onde ela começa.
    <section
      id={drawer.anchor}
      data-section={drawer.id}
      aria-labelledby={titleId}
      tabIndex={-1}
      className="scroll-mt-34 focus:outline-none lg:scroll-mt-6"
    >
      <div
        data-flash-target=""
        className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card ring-1 ring-line sm:gap-4 sm:p-4"
      >
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center self-start rounded-full bg-acai-800 text-gold-400 sm:size-14 sm:self-center">
          <SectionIcon icon={drawer.icon} className="size-6 sm:size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Heading level={level} id={titleId} className="font-display text-xl leading-tight font-black tracking-tight text-acai-800 sm:text-2xl">
              {drawer.title}
            </Heading>
            <SellerRenameButton id={drawer.id} label={drawer.title} />
            <span className="nums rounded-full bg-acai-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-acai-800">
              {countText(items.length, searching)}
            </span>
          </div>
          <p className="mt-1 text-sm leading-snug text-ink-soft">{drawer.subtitle}</p>
          <SellerAddButton target={{ kind: 'item', id: null, drawer: drawer.id }} text="+ Adicionar produto" className="mt-2" />
        </div>
        <button
          type="button"
          data-toggle={drawer.id}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 self-start rounded-full px-3 text-sm font-bold text-acai-800 ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 sm:self-center"
        >
          {open ? 'Recolher' : 'Expandir'}
          <span className="sr-only">: {drawer.navLabel}</span>
          <m.span
            aria-hidden="true"
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
            className="grid place-items-center"
          >
            <ChevronDown className="size-4" />
          </m.span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="itens"
            id={panelId}
            initial={view.instant ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="-mx-2 overflow-hidden px-2"
          >
            <ul className="grid grid-cols-1 gap-4 pt-4 pb-1 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <SectionItemCard item={item} level={next(level)} onChoose={onChoose} />
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/**
 * Cartão de um item: foto quadrada com a lupa (no celular, ao lado do texto; a partir de 640 px,
 * em cima), selos, nome, descrição, preço e o botão certo para o tipo. O canto de cima da foto
 * fica livre para o "Editar" e o "Esgotado" do modo administrador (decisão D-053).
 */
function SectionItemCard({ item, level, onChoose }: { item: ExtraItem; level: Level; onChoose: ChooseItem }) {
  const nameId = `${item.id}-nome`
  const flavors = flavorCount(item)

  return (
    <article
      aria-labelledby={nameId}
      data-item={item.id}
      data-product-id={item.id}
      className="flex h-full gap-3.5 rounded-2xl bg-white p-3 shadow-card ring-1 ring-line sm:flex-col sm:gap-3"
    >
      <div className="relative w-28 shrink-0 self-start sm:w-full">
        <ExtraVisual item={item} size="fill" zoom sizes="(min-width: 80rem) 300px, (min-width: 40rem) 45vw, 112px" />
        <SoldOut available={item.available !== false} />
        <SellerEditButton target={{ kind: 'item', id: item.id }} label={item.name} className="absolute top-1.5 left-1.5 z-20" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {(item.badge || flavors > 0) && (
          <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label="Selos">
            {item.badge && (
              <li className="rounded-full bg-gold-400 px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wide text-acai-950 uppercase">
                {item.badge}
              </li>
            )}
            {flavors > 0 && (
              <li className="nums rounded-full bg-acai-100 px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wide text-acai-800 uppercase">
                {flavors} sabores
              </li>
            )}
          </ul>
        )}
        <Heading level={level} id={nameId} className="font-display text-base leading-snug font-black text-acai-800">
          {item.name}
        </Heading>
        <p className="mt-1 text-sm leading-snug text-ink-soft">{item.description}</p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
          <ItemPrice item={item} />
          <ItemActionButton item={item} onChoose={onChoose} />
        </div>
      </div>
    </article>
  )
}

/**
 * Tarja "ESGOTADO" atravessando a foto esmaecida (pedido de 2026-11-17), nos itens, nos 4
 * produtos, no personalizador e no carrinho. A foto continua ampliando (a tarja não pega o toque).
 */
export function SoldOut({ available }: { available: boolean }) {
  if (available) return null
  return (
    <span data-sold-out="" className="pointer-events-none absolute inset-0 z-[15] grid place-items-center overflow-hidden rounded-[inherit] bg-white/60">
      <span className="w-full bg-red-600 py-1 text-center text-xs font-black tracking-[0.2em] text-white uppercase shadow-sm sm:text-sm">
        Esgotado
      </span>
    </span>
  )
}
