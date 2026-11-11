import { Link, NavLink } from 'react-router'
import { paths } from '../../paths.ts'
import { storeInfo } from '../../services/storeInfo.ts'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

const navLinkClass = `inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-white/85 transition-colors hover:text-white aria-[current=page]:bg-white/15 aria-[current=page]:text-white sm:px-3 ${focusRing}`

export function SiteHeader() {
  return (
    <header className="bg-brand-900 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-2 px-4 py-2 sm:gap-x-4 sm:px-6">
        <Link
          to={paths.home}
          className={`inline-flex min-h-11 items-center rounded-lg text-base font-bold tracking-tight sm:text-lg ${focusRing}`}
        >
          {storeInfo.name}
        </Link>

        <nav aria-label="Navegação principal" className="flex items-center gap-1">
          <NavLink to={paths.home} end className={navLinkClass}>
            Início
          </NavLink>
          <NavLink to={paths.buildOrder} className={navLinkClass}>
            Monte seu Pedido
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
