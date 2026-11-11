import { Link, NavLink } from 'react-router'
import { paths } from '../../paths.ts'
import { storeInfo } from '../../services/storeInfo.ts'
import { Logo } from '../brand/Logo.tsx'
import { Container } from './Container.tsx'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function SiteHeader() {
  return (
    <header className="bg-plum-700 text-white">
      <Container className="flex items-center justify-between gap-3 py-2.5">
        <Link
          to={paths.home}
          className={`-ml-1.5 inline-flex min-h-12 items-center gap-1.5 rounded-full pr-2 ${focusRing}`}
        >
          <Logo version="symbolOnBrand" sizes="48px" className="size-12" decorative />
          {/* Em telas muito estreitas o nome sai da vista, mas continua lido por leitores de tela. */}
          <span className="font-display text-lg font-semibold tracking-tight max-[359px]:sr-only">
            {storeInfo.name}
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="flex items-center gap-2">
          <NavLink
            to={paths.home}
            end
            className={`hidden min-h-11 items-center px-3 text-sm font-medium text-white/85 hover:text-white aria-[current=page]:text-white sm:inline-flex ${focusRing}`}
          >
            <span className="link-draw">Início</span>
          </NavLink>
          <NavLink
            to={paths.buildOrder}
            className={`inline-flex min-h-11 items-center rounded-full bg-cream-50 px-4 text-sm font-semibold text-plum-900 transition duration-200 hover:-translate-y-0.5 hover:bg-white active:translate-y-0 active:scale-[0.98] ${focusRing}`}
          >
            Montar pedido
          </NavLink>
        </nav>
      </Container>
    </header>
  )
}
