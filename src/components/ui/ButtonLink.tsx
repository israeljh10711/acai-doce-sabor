import type { ReactNode } from 'react'
import { Link } from 'react-router'

/**
 * Os botões do site, em duas versões: para fundo claro e para o fundo roxo da marca.
 * O principal é amarelo, "de apertar" (afunda ao toque); o secundário é de contorno.
 */
type Variant = 'primary' | 'secondary' | 'onBrandPrimary' | 'onBrandSecondary'

const base =
  'inline-flex min-h-12 cursor-pointer select-none items-center justify-center gap-2 rounded-full px-6 text-base font-bold tracking-tight transition duration-200 focus-visible:outline-3 focus-visible:outline-offset-3'

const variants: Record<Variant, string> = {
  primary: 'btn-primary focus-visible:outline-acai-800',
  secondary:
    'border-2 border-acai-800 text-acai-800 hover:bg-acai-800 hover:text-white active:scale-[0.98] focus-visible:outline-acai-800',
  onBrandPrimary: 'btn-primary focus-visible:outline-white',
  onBrandSecondary:
    'border-2 border-white/70 text-white hover:border-white hover:bg-white hover:text-acai-800 active:scale-[0.98] focus-visible:outline-white',
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
