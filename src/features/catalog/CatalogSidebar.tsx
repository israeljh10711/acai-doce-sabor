import { ArrowRight, Flame } from '../../components/ui/icons.tsx'
import { type NavEntry, OFFERS_ANCHOR } from './catalogNav.ts'
import { SellerAccessButton } from '../seller/SellerAccess.tsx'
import { SectionIcon } from './SectionIcon.tsx'

type NavProps = {
  entries: readonly NavEntry[]
  /** Âncora da seção à vista. */
  current: string | null
  onGo: (anchor: string) => void
}

const GROUPS = [
  { id: 'monte', title: 'Monte do seu jeito' },
  { id: 'catalogo', title: 'Catálogo completo' },
] as const

/**
 * Barra lateral fixa do cardápio no computador (pedido de 2026-11-16): o atalho de ofertas e as 9
 * seções em 2 grupos, com a seção à vista marcada. Fica à esquerda, presa ao topo ao rolar.
 */
export function CatalogSidebar({ entries, current, onGo }: NavProps) {
  return (
    <div className="sticky top-4 z-20 max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-acai-800/12 bg-white p-4 shadow-lg">
      <p className="mb-2 px-2 text-[11px] font-extrabold tracking-wider text-ink-soft uppercase">Navegação rápida</p>
      <OffersShortcut onGo={onGo} />
      <nav aria-label="Categorias do cardápio" className="mt-4">
        <CategoryList entries={entries} current={current} onGo={onGo} idPrefix="lateral" />
      </nav>
      {/* Acesso discreto do vendedor / dono (pedido de 2026-11-16). */}
      <div className="mt-3 border-t border-line pt-3">
        <SellerAccessButton />
      </div>
    </div>
  )
}

/** Atalho "Ver Ofertas & Combos": leva à seção Combos e Ofertas. */
export function OffersShortcut({ onGo }: { onGo: (anchor: string) => void }) {
  return (
    <a
      href={`#${OFFERS_ANCHOR}`}
      onClick={(event) => {
        event.preventDefault()
        onGo(OFFERS_ANCHOR)
      }}
      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-acai-800 bg-linear-to-r from-acai-800 to-acai-600 p-3 text-white shadow-sm transition hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
    >
      <span className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-400 text-acai-950">
          <Flame className="size-5" />
        </span>
        <span className="leading-tight font-extrabold">Ver Ofertas &amp; Combos</span>
      </span>
      <ArrowRight className="size-5 text-gold-400" />
    </a>
  )
}

/**
 * As 9 seções em 2 grupos ("Monte do seu jeito" e "Catálogo completo"), com ícone, nome, a dica
 * dos 4 produtos e a contagem das 5 seções. A seção à vista fica roxa, com ícone e contagem
 * dourados. Na busca, as seções sem resultado ficam apagadas (escolher uma limpa a busca).
 */
export function CategoryList({ entries, current, onGo, idPrefix }: NavProps & { idPrefix: string }) {
  // A barra lateral e o menu do celular estão na mesma página: cada lista tem os seus ids.
  return GROUPS.map((group, index) => (
    <div key={group.id} className={index > 0 ? 'mt-3 border-t border-line pt-3' : ''}>
      <p id={`${idPrefix}-grupo-${group.id}`} className="mb-1.5 px-2 text-[11px] font-extrabold tracking-wider text-ink-soft uppercase">
        {group.title}
      </p>
      <ul aria-labelledby={`${idPrefix}-grupo-${group.id}`} className="flex flex-col gap-1">
        {entries
          .filter((entry) => entry.group === group.id)
          .map((entry) => (
            <li key={entry.anchor}>
              <a
                href={`#${entry.anchor}`}
                data-nav={entry.anchor}
                data-empty={entry.available ? undefined : ''}
                aria-current={current === entry.anchor ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  onGo(entry.anchor)
                }}
                className="group flex min-h-12 items-center gap-3 rounded-2xl px-2.5 py-1.5 text-acai-800 transition-colors duration-200 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 data-empty:text-ink-soft aria-[current=true]:bg-acai-800 aria-[current=true]:text-white aria-[current=true]:shadow-sm aria-[current=true]:hover:bg-acai-800"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-acai-100 text-acai-700 transition-colors duration-200 group-data-empty:bg-acai-50 group-aria-[current=true]:bg-white/10 group-aria-[current=true]:text-gold-400"
                >
                  <SectionIcon icon={entry.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-tight font-bold">{entry.label}</span>
                  {entry.hint && (
                    <span className="mt-0.5 block text-xs leading-tight text-ink-soft group-aria-[current=true]:text-white/80">
                      {entry.hint}
                    </span>
                  )}
                </span>
                {entry.count !== null && (
                  <span className="nums grid min-w-7 shrink-0 place-items-center rounded-full bg-acai-100 px-2 py-0.5 text-xs font-extrabold text-acai-800 transition-colors duration-200 group-data-empty:bg-acai-50 group-data-empty:text-ink-soft group-aria-[current=true]:bg-gold-400 group-aria-[current=true]:text-acai-800">
                    {entry.count}
                    <span className="sr-only"> {entry.count === 1 ? 'item' : 'itens'}</span>
                  </span>
                )}
              </a>
            </li>
          ))}
      </ul>
    </div>
  ))
}
