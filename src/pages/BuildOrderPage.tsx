import { Link } from 'react-router'
import { CATEGORIES } from '../features/catalog/categories.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'

export function BuildOrderPage() {
  usePageTitle('Monte seu Pedido')

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
        Monte seu Pedido
      </h1>
      <p className="mt-2 text-lg text-brand-950/80">Escolha por onde começar.</p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {CATEGORIES.map((category) => (
          <li key={category.slug}>
            <Link
              to={paths.configurator(category.slug)}
              className="group flex min-h-24 items-center justify-between gap-3 rounded-2xl border border-brand-900/15 bg-white p-5 text-lg font-semibold text-brand-900 transition-colors hover:border-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              {category.name}
              <span
                aria-hidden="true"
                className="text-accent-600 transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
