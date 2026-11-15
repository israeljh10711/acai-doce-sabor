import { useEffect, useRef, useState } from 'react'

export type NavTarget = {
  /** Âncora da seção: o cartão do produto ou a gaveta. */
  id: string
  label: string
  group: 'produtos' | 'gavetas'
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Barra fixa de atalhos do cardápio (pedido de 2026-11-15): os 4 produtos principais e as 5
 * gavetas. Cada atalho chama `onGo`, que abre a gaveta quando preciso e rola até ela. O atalho
 * da seção à vista fica marcado. No celular a barra rola para os lados e acompanha o atalho
 * marcado.
 */
export function CategoryNav({
  targets,
  available,
  onGo,
  observeKey,
}: {
  targets: readonly NavTarget[]
  /** Seções que estão na página agora (a busca esconde algumas): só elas ficam marcadas. */
  available: ReadonlySet<string>
  onGo: (id: string) => void
  /** Muda quando as seções na tela mudam (busca, gaveta aberta): refaz a observação. */
  observeKey: string
}) {
  const [observed, setCurrent] = useState<string | null>(null)
  const current = observed && available.has(observed) ? observed : null
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const sections = targets
      .map((target) => document.getElementById(target.id))
      .filter((element): element is HTMLElement => element !== null)
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return
    const present = new Set(sections.map((section) => section.id))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        // Sem seção no meio da tela, mantém a marcada, a não ser que ela tenha saído (busca).
        setCurrent((marked) => visible[0]?.target.id ?? (marked && present.has(marked) ? marked : null))
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [targets, observeKey])

  // No celular, rola a barra para o atalho marcado ficar no meio dela (só na horizontal).
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
    <nav aria-label="Atalhos do cardápio" className="sticky top-0 z-30 border-b border-line bg-white/92 backdrop-blur-md">
      <ul
        ref={list}
        className="mx-auto flex max-w-7xl snap-x gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:justify-center-safe sm:px-6"
      >
        {targets.map((target, index) => {
          const startsGroup = index > 0 && targets[index - 1].group !== target.group
          return (
            <li
              key={target.id}
              className={`shrink-0 snap-start ${startsGroup ? 'ml-1 border-l border-line pl-2.5' : ''}`}
            >
              <a
                href={`#${target.id}`}
                data-target={target.id}
                onClick={(event) => {
                  event.preventDefault()
                  onGo(target.id)
                }}
                aria-current={current === target.id ? 'true' : undefined}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap text-acai-800 ring-1 ring-line transition-colors duration-200 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 aria-[current=true]:bg-acai-800 aria-[current=true]:text-white aria-[current=true]:ring-acai-800"
              >
                {target.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
