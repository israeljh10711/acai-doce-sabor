import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Menu } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { cartActions } from '../cart/cartStore.ts'
import { ConfirmItemDialog } from '../configurator-core/ConfirmItemDialog.tsx'
import { extraSummary } from '../configurator-core/confirmSummary.ts'
import type { AddedItemState } from '../configurator-core/OrderSummary.tsx'
import { useLightbox } from '../lightbox/lightboxContext.ts'
import { FloatingOfferToast } from '../offers/FloatingOfferToast.tsx'
import type { OfferNotification } from '../offers/offerNotifications.ts'
import { useOfferScheduler } from '../offers/useOfferScheduler.ts'
import { type AddedNotice, AddedToast } from './AddedToast.tsx'
import { CatalogSections, type SectionView } from './CatalogSections.tsx'
import { CatalogSidebar } from './CatalogSidebar.tsx'
import { MAIN_ANCHORS, NAV_ANCHORS, navEntries } from './catalogNav.ts'
import { CategoryNav } from './CategoryNav.tsx'
import type { CategorySlug } from './categories.ts'
import { type ChoiceDraft, EMPTY_DRAFT, draftChoices } from './choiceDraft.ts'
import { ExtraOptionsDialog } from './ExtraOptionsDialog.tsx'
import { DRAWERS, type DrawerId, EXTRA_ITEMS, type ExtraItem, choiceGroupsOf, normalizeChoices } from './extras.ts'
import { highlightItems } from './highlights.ts'
import { ExtraVisual } from './ItemVisual.tsx'
import { MenuShowcase } from './MenuShowcase.tsx'
import { MobileCategoryDrawer } from './MobileCategoryDrawer.tsx'
import { ILLUSTRATIVE_NOTICE } from './notices.ts'
import { SearchBar, SearchSummary } from './SearchBar.tsx'
import { searchMenu } from './search.ts'
import { TopHighlightsStrip } from './TopHighlightsStrip.tsx'
import { useScrollSpy, whenScrollSettles } from './useScrollSpy.ts'

const drawerOfAnchor = (anchor: string): DrawerId | null => DRAWERS.find((drawer) => drawer.anchor === anchor)?.id ?? null
const mainOfAnchor = (anchor: string): CategorySlug | null =>
  (Object.keys(MAIN_ANCHORS) as CategorySlug[]).find((slug) => MAIN_ANCHORS[slug] === anchor) ?? null

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Tempo do contorno dourado na seção escolhida (pedido de 2026-11-16). */
const FLASH_MS = 1200

/** Item do catálogo em andamento: escolhendo o sabor ou confirmando. */
type Flow = { item: ExtraItem; step: 'options' | 'confirm'; draft: ChoiceDraft }

type MenuBrowserProps = {
  /** Nível dos títulos: 2 na página Cardápio, 3 no início (abaixo do título "Cardápio"). */
  headingLevel: 2 | 3
  /** Bloco antes do cardápio (o título do cardápio no início). */
  intro?: ReactNode
  /** Âncora da área do cardápio (#cardapio no início). */
  sectionId?: string
  labelledBy?: string
  className?: string
}

/**
 * O cardápio inteiro, igual no início e na página Cardápio (pedido de 2026-11-16):
 * - no computador, a barra lateral fixa com as 9 seções e, ao lado, a busca, a faixa de
 *   destaques, os 4 produtos e as 5 seções do catálogo abertas;
 * - no celular e no tablet, uma barra fixa com o botão "Categorias" (menu deslizante), a busca e
 *   os botões das 9 seções.
 *
 * A seção à vista fica marcada na navegação. Os itens do catálogo passam pela escolha de sabor
 * (quando têm) e pela mesma confirmação do personalizador antes de entrar no carrinho. De tempos
 * em tempos, uma notificação flutuante mostra uma das 12 ofertas (`features/offers`); ela some
 * enquanto há janela ou menu aberto, texto na busca ou o aviso de item adicionado.
 */
export function MenuBrowser({ headingLevel, intro, sectionId, labelledBy, className = 'pb-14 lg:pt-10' }: MenuBrowserProps) {
  const location = useLocation()
  const navigate = useNavigate()

  /* Busca */
  const [query, setQuery] = useState('')
  const result = useMemo(() => searchMenu(query), [query])
  const searching = result.query !== ''
  const entries = useMemo(() => navEntries(result), [result])

  /* Seções: todas começam abertas; aqui ficam as que o cliente recolheu. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<DrawerId>>(new Set())
  // Na busca, as seções com resultado abrem sozinhas; estas o cliente recolheu nesta busca.
  const [closedInSearch, setClosedInSearch] = useState<{ query: string; ids: ReadonlySet<DrawerId> }>({
    query: '',
    ids: new Set(),
  })
  const closedNow = closedInSearch.query === result.query ? closedInSearch.ids : new Set<DrawerId>()

  const isOpen = (id: DrawerId) => (searching ? result.drawers.has(id) && !closedNow.has(id) : !collapsed.has(id))

  // Seções abertas pela navegação: aparecem já abertas, sem animar a altura (ver `SectionView`).
  const [instantIds, setInstantIds] = useState<ReadonlySet<DrawerId>>(new Set())

  const toggle = (id: DrawerId) => {
    if (instantIds.has(id)) {
      const next = new Set(instantIds)
      next.delete(id)
      setInstantIds(next)
    }
    if (searching) {
      const ids = new Set(closedNow)
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      setClosedInSearch({ query: result.query, ids })
      return
    }
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* Seção à vista, marcada na barra lateral, no menu e nos botões da barra fixa. */
  const observeKey = `${result.query}|${[...collapsed].join(',')}|${[...closedNow].join(',')}`
  const spy = useScrollSpy(NAV_ANCHORS, observeKey)

  /*
   * Navegação: limpa a busca que esconde o destino, abre a seção recolhida, rola até ela e,
   * parada a página, leva o foco para a seção e acende o contorno dourado por 1,2 s.
   */
  const [scrollTarget, setScrollTarget] = useState<{ anchor: string; count: number } | null>(null)
  const scrollCount = useRef(0)

  const goTo = (anchor: string) => {
    const drawer = drawerOfAnchor(anchor)
    const main = mainOfAnchor(anchor)
    const hidden = searching && (drawer ? !result.drawers.has(drawer) : main ? !result.main.includes(main) : false)
    if (hidden) setQuery('')
    if (drawer) {
      if (!isOpen(drawer)) setInstantIds((current) => new Set(current).add(drawer))
      setCollapsed((current) => {
        if (!current.has(drawer)) return current
        const next = new Set(current)
        next.delete(drawer)
        return next
      })
      if (searching && closedNow.has(drawer)) {
        const ids = new Set(closedNow)
        ids.delete(drawer)
        setClosedInSearch({ query: result.query, ids })
      }
    }
    spy.pin(anchor)
    scrollCount.current += 1
    setScrollTarget({ anchor, count: scrollCount.current })
  }

  const flashed = useRef<{ element: Element; timer: number } | null>(null)
  useEffect(() => {
    if (!scrollTarget) return
    const section = document.getElementById(scrollTarget.anchor)
    if (!section) return
    section.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    return whenScrollSettles(() => {
      section.focus({ preventScroll: true })
      const target = section.matches('[data-flash-target]') ? section : section.querySelector('[data-flash-target]')
      if (!target) return
      if (flashed.current) {
        window.clearTimeout(flashed.current.timer)
        flashed.current.element.removeAttribute('data-flash')
      }
      target.setAttribute('data-flash', '')
      const timer = window.setTimeout(() => {
        target.removeAttribute('data-flash')
        flashed.current = null
      }, FLASH_MS)
      flashed.current = { element: target, timer }
    })
  }, [scrollTarget])
  useEffect(() => () => window.clearTimeout(flashed.current?.timer), [])

  /* Menu das categorias no celular */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const categoriesButton = useRef<HTMLButtonElement>(null)

  /* Aviso de item adicionado: ao continuar comprando aqui, ou ao voltar do personalizador. */
  const [notice, setNotice] = useState<AddedNotice | null>(null)
  const noticeCount = useRef(0)
  const notify = useCallback((name: string) => {
    noticeCount.current += 1
    setNotice({ name, key: noticeCount.current })
  }, [])
  const dismiss = useCallback(() => setNotice(null), [])

  const [arrived] = useState(() => (location.state as AddedItemState | null)?.added ?? null)
  useEffect(() => {
    if (!arrived) return
    // O aviso sai do histórico: recarregar a página não o repete.
    navigate(location.pathname + location.hash, { replace: true, state: null })
    const timer = window.setTimeout(() => notify(arrived), 120)
    return () => window.clearTimeout(timer)
  }, [arrived, navigate, location.pathname, location.hash, notify])

  /* Itens do catálogo: sabor (quando tem), confirmação e carrinho. */
  const [flow, setFlow] = useState<Flow | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const choose = (item: ExtraItem, button: HTMLElement) => {
    opener.current = button
    setFlow({ item, step: choiceGroupsOf(item).length > 0 ? 'options' : 'confirm', draft: EMPTY_DRAFT })
  }

  const flowChoices = flow ? (normalizeChoices(flow.item, draftChoices(flow.item, flow.draft)) ?? {}) : {}
  const hasChoices = flow ? choiceGroupsOf(flow.item).length > 0 : false

  const add = (goToCart: boolean) => {
    if (!flow) return
    const { item } = flow
    setFlow(null)
    if (!cartActions.addExtra(item.id, flowChoices)) return
    if (goToCart) navigate(paths.cart)
    else notify(item.name)
  }

  /* Notificações de ofertas: param com janela ou menu aberto, busca digitada ou aviso do carrinho. */
  // A foto ampliada aberta pela própria oferta só segura a oferta; as outras escondem, como janela.
  const lightbox = useLightbox()
  const zoomOpen = lightbox.current !== null && lightbox.current.origin !== 'offer'
  const offers = useOfferScheduler(flow !== null || query.trim().length > 0 || notice !== null || zoomOpen || drawerOpen)

  const takeOffer = (offer: OfferNotification) => {
    offers.scheduler.accept()
    const { item, slug } = offer
    if (slug) {
      navigate(paths.configurator(slug))
      return
    }
    if (!item) return
    if (item.action.type === 'customizer') {
      navigate(paths.configurator(item.action.product))
      return
    }
    // A janela devolve o foco ao botão do item na seção, quando ele está na tela, ou ao conteúdo.
    const button =
      document.querySelector<HTMLElement>(`[data-item="${item.id}"] button:not([data-zoom])`) ?? document.getElementById('conteudo')
    if (button) choose(item, button)
  }

  /* O que aparece */
  const views: SectionView[] = DRAWERS.flatMap((drawer) => {
    const items = searching ? result.drawers.get(drawer.id) : EXTRA_ITEMS.filter((item) => item.drawer === drawer.id)
    return items ? [{ drawer, items, open: isOpen(drawer.id), instant: instantIds.has(drawer.id) }] : []
  })
  const highlights = highlightItems(result)
  const nothingFound = searching && result.total === 0
  const Wrapper = labelledBy ? 'section' : 'div'

  return (
    <>
      <Wrapper id={sectionId} aria-labelledby={labelledBy} className={`bg-acai-50 ${className}`}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          {intro}

          <div className="lg:flex lg:gap-8">
            {/* Barra lateral fixa (computador). A coluna estica até o fim do cardápio, para a barra
                ficar presa ao topo durante toda a rolagem. */}
            <div className="hidden w-72 shrink-0 lg:block">
              <CatalogSidebar entries={entries} current={spy.current} onGo={goTo} />
            </div>

            <div className="min-w-0 flex-1">
              {/* Barra fixa do celular e do tablet: "Categorias", a busca e os botões das seções. No
                  computador, só a busca, sem ficar presa. */}
              <div
                data-menu-bar=""
                className="sticky top-0 z-30 -mx-4 border-b border-acai-800/10 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
              >
                <div className="flex items-center gap-2">
                  <button
                    ref={categoriesButton}
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={drawerOpen}
                    onClick={() => setDrawerOpen(true)}
                    className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-acai-800 px-3.5 font-bold text-white transition hover:bg-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 lg:hidden"
                  >
                    <Menu className="size-5" />
                    Categorias
                  </button>
                  <SearchBar value={query} onChange={setQuery} searching={searching} total={result.total} className="min-w-0 flex-1" />
                </div>
                <div className="lg:hidden">
                  <CategoryNav entries={entries} current={spy.current} onGo={goTo} />
                </div>
              </div>

              <div className="flex flex-col gap-12 pt-6 sm:gap-16 lg:pt-8">
                {searching && !nothingFound && <SearchSummary query={query} total={result.total} onClear={() => setQuery('')} />}

                {nothingFound ? (
                  <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-white px-6 py-10 text-center ring-1 ring-line">
                    <p className="text-lg font-semibold text-acai-950">Nenhum produto encontrado para “{query.trim()}”</p>
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="btn-gold inline-flex min-h-12 cursor-pointer items-center rounded-full px-6 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
                    >
                      Limpar busca
                    </button>
                  </div>
                ) : (
                  <>
                    <TopHighlightsStrip items={highlights} level={headingLevel} onChoose={choose} />
                    {result.main.length > 0 && (
                      <MenuShowcase headingLevel={`h${headingLevel}`} visible={searching ? result.main : undefined} />
                    )}
                    {views.length > 0 && (
                      <CatalogSections level={headingLevel} views={views} searching={searching} onToggle={toggle} onChoose={choose} />
                    )}
                  </>
                )}

                <p className="text-center text-sm text-ink-soft">{ILLUSTRATIVE_NOTICE}</p>
              </div>
            </div>
          </div>
        </div>
      </Wrapper>

      <MobileCategoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        entries={entries}
        current={spy.current}
        onGo={goTo}
        opener={categoriesButton}
      />
      {flow && flow.item.action.type === 'flavor_modal' && (
        <ExtraOptionsDialog
          key={flow.item.id}
          open={flow.step === 'options'}
          item={flow.item}
          draft={flow.draft}
          onChange={(draft) => setFlow({ ...flow, draft })}
          onContinue={() => setFlow({ ...flow, step: 'confirm' })}
          onCancel={() => setFlow(null)}
          opener={opener}
        />
      )}
      <ConfirmItemDialog
        open={flow?.step === 'confirm'}
        summary={flow ? extraSummary(flow.item, flowChoices) : { eyebrow: '', title: '', rows: [], unitCents: 0 }}
        visual={flow && <ExtraVisual item={flow.item} size="fill" zoom choices={flowChoices} />}
        backLabel={hasChoices ? 'Voltar e editar' : 'Voltar'}
        onAddAndGoToCart={() => add(true)}
        onAddAndContinue={() => add(false)}
        onBack={() => setFlow(flow && hasChoices ? { ...flow, step: 'options' } : null)}
        opener={opener}
      />
      <AddedToast notice={notice} onDismiss={dismiss} />
      <FloatingOfferToast
        offer={offers.offer}
        snapshot={offers.snapshot}
        onAccept={takeOffer}
        onDismiss={() => offers.scheduler.dismiss()}
        onHold={(held) => offers.scheduler.setHeld(held)}
        onReactivate={() => offers.scheduler.reactivate()}
      />
    </>
  )
}
