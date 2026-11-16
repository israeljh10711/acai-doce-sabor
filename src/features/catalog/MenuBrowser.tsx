import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Container } from '../../components/layout/Container.tsx'
import { paths } from '../../paths.ts'
import { cartActions } from '../cart/cartStore.ts'
import { ConfirmItemDialog } from '../configurator-core/ConfirmItemDialog.tsx'
import { extraSummary } from '../configurator-core/confirmSummary.ts'
import type { AddedItemState } from '../configurator-core/OrderSummary.tsx'
import { FloatingOfferToast } from '../offers/FloatingOfferToast.tsx'
import type { OfferNotification } from '../offers/offerNotifications.ts'
import { useOfferScheduler } from '../offers/useOfferScheduler.ts'
import { type AddedNotice, AddedToast } from './AddedToast.tsx'
import { CATEGORIES } from './categories.ts'
import { CategoryNav, type NavTarget } from './CategoryNav.tsx'
import { type ChoiceDraft, EMPTY_DRAFT, draftChoices } from './choiceDraft.ts'
import { ExtraOptionsDialog } from './ExtraOptionsDialog.tsx'
import { DRAWERS, type DrawerId, EXTRA_ITEMS, type ExtraItem, choiceGroupsOf, drawerById, normalizeChoices } from './extras.ts'
import { ExtraVisual } from './ItemVisual.tsx'
import { useLightbox } from '../lightbox/lightboxContext.ts'
import { MenuShowcase } from './MenuShowcase.tsx'
import { CatalogSections, type SectionView } from './CatalogSections.tsx'
import { MAIN_ANCHORS } from './catalogNav.ts'
import { highlightItems } from './highlights.ts'
import { TopHighlightsStrip } from './TopHighlightsStrip.tsx'
import { ILLUSTRATIVE_NOTICE } from './notices.ts'
import { SearchBar } from './SearchBar.tsx'
import { searchMenu } from './search.ts'

const NAV_TARGETS: readonly NavTarget[] = [
  ...CATEGORIES.map((category) => ({ id: MAIN_ANCHORS[category.slug], label: category.name, group: 'produtos' as const })),
  ...DRAWERS.map((drawer) => ({ id: drawer.anchor, label: drawer.pillLabel, group: 'gavetas' as const })),
]

const drawerOfAnchor = (anchor: string): DrawerId | null => DRAWERS.find((drawer) => drawer.anchor === anchor)?.id ?? null

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Item das gavetas em andamento: escolhendo o sabor ou confirmando. */
type Flow = { item: ExtraItem; step: 'options' | 'confirm'; draft: ChoiceDraft }

type MenuBrowserProps = {
  /** Nível dos títulos dos cartões: 2 na página Cardápio, 3 no início (abaixo do título "Cardápio"). */
  headingLevel: 2 | 3
  /** Bloco antes da vitrine (o título do cardápio no início). */
  intro?: ReactNode
  /** Âncora da área do cardápio (#cardapio no início). */
  sectionId?: string
  labelledBy?: string
  className?: string
}

/**
 * O cardápio inteiro, igual no início e na página Cardápio (pedido de 2026-11-15):
 * busca, barra fixa de atalhos, a vitrine dos 4 produtos e as 5 gavetas de "Mais opções".
 * Os itens das gavetas passam pela escolha de sabor (quando têm) e pela mesma confirmação do
 * personalizador antes de entrar no carrinho. De tempos em tempos, uma notificação flutuante
 * mostra uma das 12 ofertas escolhidas (`features/offers`); ela some enquanto há janela aberta,
 * texto na busca ou o aviso de item adicionado.
 */
export function MenuBrowser({ headingLevel, intro, sectionId, labelledBy, className = 'py-10 sm:py-14' }: MenuBrowserProps) {
  const location = useLocation()
  const navigate = useNavigate()

  /* Busca */
  const [query, setQuery] = useState('')
  const result = useMemo(() => searchMenu(query), [query])
  const searching = result.query !== ''

  /* Seções: todas começam abertas; aqui ficam as que o cliente recolheu. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<DrawerId>>(new Set())
  // Na busca, as gavetas com resultado abrem sozinhas; estas o cliente fechou nesta busca.
  const [closedInSearch, setClosedInSearch] = useState<{ query: string; ids: ReadonlySet<DrawerId> }>({
    query: '',
    ids: new Set(),
  })
  const closedNow = closedInSearch.query === result.query ? closedInSearch.ids : new Set<DrawerId>()

  const isOpen = (id: DrawerId) => (searching ? result.drawers.has(id) && !closedNow.has(id) : !collapsed.has(id))

  // Gavetas abertas pelo atalho: aparecem já abertas, sem animar a altura (ver `DrawerView`).
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

  /* Atalhos: abrem a gaveta (e limpam a busca se ela esconde o destino) e rolam até a seção. */
  const [scrollTarget, setScrollTarget] = useState<{ id: string; count: number } | null>(null)
  const scrollCount = useRef(0)

  const goTo = (id: string) => {
    const drawer = drawerOfAnchor(id)
    const hidden = searching && (drawer ? !result.drawers.has(drawer) : !result.main.some((slug) => MAIN_ANCHORS[slug] === id))
    if (hidden) setQuery('')
    if (drawer) {
      if (!isOpen(drawer)) setInstantIds((current) => new Set(current).add(drawer))
      setCollapsed((current) => {
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
    scrollCount.current += 1
    setScrollTarget({ id, count: scrollCount.current })
  }

  useEffect(() => {
    if (!scrollTarget) return
    document.getElementById(scrollTarget.id)?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [scrollTarget])

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

  /* Itens das gavetas: sabor (quando tem), confirmação e carrinho. */
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

  /* Notificações de ofertas: param com janela aberta, busca digitada ou aviso do carrinho. */
  // A foto ampliada aberta pela própria oferta só segura a oferta; as outras escondem, como janela.
  const lightbox = useLightbox()
  const zoomOpen = lightbox.current !== null && lightbox.current.origin !== 'offer'
  const offers = useOfferScheduler(flow !== null || query.trim().length > 0 || notice !== null || zoomOpen)

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
    // A janela devolve o foco ao botão do item, quando ele está na tela, ou ao conteúdo.
    const button =
      document.querySelector<HTMLElement>(`[data-item="${item.id}"] button:not([data-zoom])`) ?? document.getElementById('conteudo')
    if (button) choose(item, button)
  }

  /* O que aparece */
  const views: SectionView[] = DRAWERS.flatMap((drawer) => {
    const items = searching ? result.drawers.get(drawer.id) : EXTRA_ITEMS.filter((item) => item.drawer === drawer.id)
    return items ? [{ drawer, items, open: isOpen(drawer.id), instant: instantIds.has(drawer.id) }] : []
  })
  const observeKey = `${result.query}|${[...collapsed].join(',')}|${[...closedNow].join(',')}`
  const available = new Set<string>(
    searching && result.total === 0
      ? []
      : searching
        ? [...result.main.map((slug) => MAIN_ANCHORS[slug]), ...[...result.drawers.keys()].map((id) => drawerById(id).anchor)]
        : NAV_TARGETS.map((target) => target.id),
  )
  const highlights = highlightItems(result)
  const Wrapper = labelledBy ? 'section' : 'div'

  return (
    <>
      <SearchBar value={query} onChange={setQuery} searching={searching} total={result.total} />
      <CategoryNav targets={NAV_TARGETS} available={available} onGo={goTo} observeKey={observeKey} />

      <Wrapper id={sectionId} aria-labelledby={labelledBy} className={`scroll-mt-16 bg-acai-50 ${className}`}>
        <Container>
          {intro}

          {searching && result.total === 0 ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-white px-6 py-10 text-center ring-1 ring-line">
              <p className="text-lg font-semibold text-acai-950">
                Nenhum produto encontrado para “{query.trim()}”
              </p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="btn-gold inline-flex min-h-12 cursor-pointer items-center rounded-full px-6 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                Limpar busca
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-12 sm:gap-16">
              <TopHighlightsStrip items={highlights} level={headingLevel} onChoose={choose} />
              {result.main.length > 0 && (
                <MenuShowcase headingLevel={`h${headingLevel}`} visible={searching ? result.main : undefined} />
              )}
              {views.length > 0 && (
                <CatalogSections level={headingLevel} views={views} searching={searching} onToggle={toggle} onChoose={choose} />
              )}
            </div>
          )}

          <p className="mt-10 text-center text-sm text-ink-soft">{ILLUSTRATIVE_NOTICE}</p>
        </Container>
      </Wrapper>

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
