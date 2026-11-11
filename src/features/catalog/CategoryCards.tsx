import { Link } from 'react-router'
import { paths } from '../../paths.ts'
import { CATEGORIES } from './categories.ts'

type CategoryCardsProps = {
  /** Nível do título de cada cartão, conforme o título que vem antes na página. */
  headingLevel: 'h2' | 'h3'
  className?: string
}

/** Os três cartões que levam ao personalizador de cada categoria. */
export function CategoryCards({ headingLevel: Heading, className = '' }: CategoryCardsProps) {
  return (
    // Em celular, um cartão por linha. Em tablet, também um por linha, mas deitado
    // (texto à esquerda, ação à direita), porque três colunas ficariam apertadas.
    // Em telas largas, três colunas.
    <ul className={`grid gap-4 lg:grid-cols-3 ${className}`}>
      {CATEGORIES.map((category) => (
        <li key={category.slug}>
          <Link
            to={paths.configurator(category.slug)}
            className="group flex h-full flex-col justify-between gap-8 rounded-2xl border border-cream-200 bg-white p-6 transition duration-200 hover:-translate-y-0.5 hover:border-berry-600 hover:shadow-[0_18px_36px_-24px_rgba(107,15,76,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600 md:flex-row md:items-center lg:flex-col lg:items-stretch"
          >
            <div>
              <Heading className="font-display text-2xl font-semibold tracking-tight text-plum-900">
                {category.name}
              </Heading>
              <p className="mt-2 text-plum-950/75">{category.summary}</p>
            </div>

            <span className="inline-flex shrink-0 items-center gap-2 font-semibold text-berry-600">
              {category.actionLabel}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
