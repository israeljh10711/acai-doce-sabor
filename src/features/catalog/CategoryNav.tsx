import { useEffect, useState } from 'react'
import { CATEGORIES } from './categories.ts'

/**
 * Barra de categorias do cardápio, fixa no topo durante a rolagem. Cada botão rola até a
 * categoria; o da categoria visível fica marcado. No celular a barra rola para os lados.
 */
export function CategoryNav() {
  const [current, setCurrent] = useState<string | null>(null)

  useEffect(() => {
    const sections = CATEGORIES.map((category) => document.getElementById(category.slug)).filter(
      (element): element is HTMLElement => element !== null,
    )
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setCurrent(visible[0].target.id)
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Categorias do cardápio" className="sticky top-0 z-30 border-b border-line bg-white/92 backdrop-blur-md">
      <ul className="mx-auto flex max-w-6xl snap-x gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:justify-center sm:px-6">
        {CATEGORIES.map((category) => (
          <li key={category.slug} className="snap-start">
            <a
              href={`#${category.slug}`}
              aria-current={current === category.slug ? 'true' : undefined}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold whitespace-nowrap text-acai-800 ring-1 ring-line transition-colors duration-200 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 aria-[current=true]:bg-acai-800 aria-[current=true]:text-white aria-[current=true]:ring-acai-800"
            >
              {category.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
