import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import type { ComponentPropsWithoutRef } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronDown, Plus } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { drawerEmblem } from './emblems.ts'
import { type Drawer, type DrawerId, type ExtraItem, choiceGroupsOf, hasPricedChoices } from './extras.ts'
import { ExtraVisual, ItemEmblem } from './ItemVisual.tsx'

type Level = 2 | 3 | 4 | 5

/** Título no nível certo da página (o cardápio fica em h2 no Cardápio e em h3 no início). */
function Heading({ level, ...props }: { level: Level } & ComponentPropsWithoutRef<'h2'>) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5'
  return <Tag {...props} />
}

const next = (level: Level) => Math.min(level + 1, 5) as Level

export type DrawerView = {
  drawer: Drawer
  /** Itens a mostrar: todos, ou só os encontrados pela busca. */
  items: readonly ExtraItem[]
  open: boolean
  /**
   * Abre sem animar (atalho): a altura certa já existe quando a página rola até a gaveta, e a
   * rolagem para no lugar certo mesmo perto do fim da página.
   */
  instant: boolean
}

type MoreOptionsProps = {
  /** Nível do título "Mais opções do cardápio". As gavetas e os itens vêm logo abaixo. */
  level: 2 | 3
  /** A vitrine dos produtos principais está acima (na busca, ela pode sumir). */
  afterShowcase: boolean
  views: readonly DrawerView[]
  searching: boolean
  onToggle: (id: DrawerId) => void
  /** Item escolhido (sem personalizador): abre o sabor ou a confirmação. */
  onChoose: (item: ExtraItem, opener: HTMLElement) => void
}

/**
 * "Mais opções do cardápio" (pedido de 2026-11-15): 5 gavetas retráteis com combos, potes
 * família, picolés, bebidas e doces. A primeira começa aberta. Na busca, só aparecem as gavetas
 * com resultado, abertas e com a contagem.
 */
export function MoreOptions({ level, afterShowcase, views, searching, onToggle, onChoose }: MoreOptionsProps) {
  return (
    <section aria-labelledby="mais-opcoes-titulo" className={afterShowcase ? 'mt-12 sm:mt-16' : ''}>
      <div className="mb-5 sm:mb-6">
        <Heading
          level={level}
          id="mais-opcoes-titulo"
          className="font-display text-3xl font-black tracking-tight text-acai-800 uppercase sm:text-4xl"
        >
          Mais opções do cardápio
        </Heading>
        <p className="mt-1 text-ink-soft">Combos, potes família, picolés, sorvetes, bebidas e doces.</p>
      </div>
      <div className="flex flex-col gap-3 sm:gap-4">
        {views.map((view) => (
          <DrawerPanel
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

function countText(view: DrawerView, searching: boolean): string {
  const total = view.items.length
  if (searching) return total === 1 ? '1 encontrado' : `${total} encontrados`
  return total === 1 ? '1 item' : `${total} itens`
}

function DrawerPanel({
  view,
  level,
  searching,
  onToggle,
  onChoose,
}: {
  view: DrawerView
  level: Level
  searching: boolean
  onToggle: () => void
  onChoose: MoreOptionsProps['onChoose']
}) {
  const { drawer, items, open } = view
  const reduceMotion = useReducedMotion()
  const buttonId = `${drawer.id}-gaveta`
  const panelId = `${drawer.id}-itens`

  return (
    // A gaveta não é um marco da página: a região é o painel aberto, nomeado pelo botão.
    <div id={drawer.id} data-drawer={drawer.id} className="scroll-mt-20">
      <Heading level={level}>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl bg-white px-3 py-2.5 text-left shadow-card ring-1 ring-line transition hover:ring-acai-600/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 sm:gap-4 sm:px-4"
        >
          <ItemEmblem emblem={drawerEmblem(drawer)} size="sm" />
          <span className="min-w-0 flex-1 font-display text-lg leading-tight font-black tracking-tight text-acai-800 sm:text-xl">
            {drawer.title}
          </span>
          <span className="nums shrink-0 rounded-full bg-acai-100 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-acai-800">
            {countText(view, searching)}
          </span>
          <m.span
            aria-hidden="true"
            initial={false}
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-acai-50 text-acai-800"
          >
            <ChevronDown className="size-5" />
          </m.span>
        </button>
      </Heading>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="itens"
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={view.instant ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="-mx-2 overflow-hidden px-2"
          >
            <ul className="grid grid-cols-1 gap-4 pt-4 pb-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <ExtraItemCard item={item} level={next(level)} onChoose={onChoose} />
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const actionClass =
  'btn-gold inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-sm font-extrabold whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/** Cartão de um item: foto, nome, descrição, preço e o botão certo para o tipo. */
function ExtraItemCard({ item, level, onChoose }: { item: ExtraItem; level: Level; onChoose: MoreOptionsProps['onChoose'] }) {
  const nameId = `${item.id}-nome`
  const groups = choiceGroupsOf(item)

  return (
    <article
      aria-labelledby={nameId}
      data-item={item.id}
      className="flex h-full gap-3.5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line sm:gap-4"
    >
      <ExtraVisual item={item} zoom />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Heading level={level} id={nameId} className="font-display text-base leading-snug font-black text-acai-800">
            {item.name}
          </Heading>
          {item.badge && (
            <span className="shrink-0 rounded-full bg-gold-400 px-2 py-0.5 text-[0.7rem] font-extrabold tracking-wide text-acai-950 uppercase">
              {item.badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-snug text-ink-soft">{item.description}</p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
          <p className="nums flex flex-wrap items-baseline gap-x-2 leading-tight">
            {item.originalPriceCents !== undefined && (
              <>
                <span className="sr-only">De </span>
                <s className="text-sm text-ink-soft">{formatBRL(item.originalPriceCents)}</s>
                <span className="sr-only"> por </span>
              </>
            )}
            {hasPricedChoices(item) && <span className="text-sm font-semibold text-ink-soft">a partir de</span>}
            <strong className="text-lg font-extrabold whitespace-nowrap text-acai-800">{formatBRL(item.priceCents)}</strong>
          </p>

          {item.action.type === 'customizer' ? (
            <Link to={paths.configurator(item.action.product)} className={actionClass}>
              {item.action.label}
              <span className="sr-only">: {item.name}</span>
              <ArrowRight className="size-4" />
            </Link>
          ) : (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => onChoose(item, event.currentTarget)}
              className={actionClass}
            >
              {groups.length === 0 ? (
                <>
                  <Plus className="size-4" />
                  Adicionar
                </>
              ) : groups.length > 1 ? (
                'Escolher sabores'
              ) : groups[0].prices ? (
                'Escolher tamanho'
              ) : (
                'Escolher sabor'
              )}
              <span className="sr-only">: {item.name}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
