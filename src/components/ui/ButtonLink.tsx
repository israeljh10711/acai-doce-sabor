import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Os dois botões do site, em duas versões: para fundo claro e para o fundo roxo da marca.
 */
type Variant = 'primary' | 'secondary' | 'onBrandPrimary' | 'onBrandSecondary'

const base =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2'

const variants: Record<Variant, string> = {
  primary: 'bg-berry-600 text-white hover:bg-berry-700 focus-visible:outline-berry-600',
  secondary:
    'border border-plum-700/35 text-plum-900 hover:border-plum-700 focus-visible:outline-berry-600',
  onBrandPrimary: 'bg-cream-50 text-plum-900 hover:bg-white focus-visible:outline-white',
  onBrandSecondary:
    'border border-white/45 text-white hover:border-white hover:bg-white/10 focus-visible:outline-white',
}

type ButtonLinkProps = {
  children: ReactNode
  variant?: Variant
  className?: string
} & (
  | { /** Página do próprio site. */ to: string; href?: never }
  | { /** Endereço externo. Abre em nova aba. */ href: string; to?: never }
)

export function ButtonLink({
  children,
  variant = 'primary',
  className = '',
  to,
  href,
}: ButtonLinkProps) {
  const classes = `${base} ${variants[variant]} ${className}`

  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={classes}>
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  )
}
