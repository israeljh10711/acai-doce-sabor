import { useEffect, useRef } from 'react'
import type { NavEntry } from './catalogNav.ts'
import { SectionIcon } from './SectionIcon.tsx'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Botões das 9 seções na barra fixa do celular e do tablet (pedido de 2026-11-16): ícone, nome
 * curto e, nas 5 seções do catálogo, a contagem. A barra rola para os lados e acompanha a seção
 * marcada. Na busca, as seções sem resultado ficam apagadas (escolher uma limpa a busca).
 */
export function CategoryNav({
  entries,
  current,
  onGo,
}: {
  entries: readonly NavEntry[]
  current: string | null
  onGo: (anchor: string) => void
}) {
  const list = useRef<HTMLUListElement>(null)

  // Rola a barra para o botão marcado ficar no meio dela (só na horizontal).
  useEffect(() => {
    const bar = list.current
    const pill = current ? bar?.querySelector<HTMLElement>(`[data-target="${current}"]`) : null
    if (!bar || !pill || bar.scrollWidth <= bar.clientWidth) return
    const barBox = bar.getBoundingClientRect()
    const pillBox = pill.getBoundingClientRect()
    const delta = pillBox.left + pillBox.width / 2 - (barBox.left + barBox.width / 2)
    bar.scrollBy({ left: delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [current])

  return (
    <nav aria-label="Atalhos do cardápio">
      {/* "relative": os textos só para leitor de tela (" itens") ficam presos à barra que rola; sem
          isso, eles escapavam do corte e alargavam a página no celular. */}
      <ul ref={list} className="relative -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pt-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
        {entries.map((entry, index) => {
          const startsGroup = index > 0 && entries[index - 1].group !== entry.group
          return (
            <li key={entry.anchor} className={`shrink-0 snap-start ${startsGroup ? 'border-l border-line pl-2' : ''}`}>
              <a
                href={`#${entry.anchor}`}
                data-target={entry.anchor}
                data-empty={entry.available ? undefined : ''}
                aria-current={current === entry.anchor ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  onGo(entry.anchor)
                }}
                className="group inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold whitespace-nowrap text-acai-800 ring-1 ring-line transition-colors duration-200 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 data-empty:bg-acai-50 data-empty:text-ink-soft aria-[current=true]:bg-acai-800 aria-[current=true]:text-white aria-[current=true]:ring-acai-800"
              >
                <SectionIcon icon={entry.icon} className="size-4 text-acai-600 group-aria-[current=true]:text-orchid-400" />
                {entry.shortLabel}
                {entry.count !== null && (
                  <span className="nums grid min-w-5 place-items-center rounded-full bg-acai-100 px-1.5 text-xs leading-5 font-extrabold text-acai-800 group-data-empty:text-ink-soft group-aria-[current=true]:bg-orchid-400 group-aria-[current=true]:text-acai-800">
                    {entry.count}
                    <span className="sr-only"> {entry.count === 1 ? 'item' : 'itens'}</span>
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
