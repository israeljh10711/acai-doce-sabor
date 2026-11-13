import { Link, NavLink } from 'react-router'
import { cartCount } from '../../features/cart/cart.ts'
import { useCart } from '../../features/cart/cartStore.ts'
import { paths } from '../../paths.ts'
import { storeInfo } from '../../services/storeInfo.ts'
import { Logo } from '../brand/Logo.tsx'
import { Bag } from '../ui/icons.tsx'
import { Container } from './Container.tsx'

const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white'

export function SiteHeader() {
  const count = cartCount(useCart())

  return (
    <header className="bg-acai-800 text-white">
      <Container className="flex items-center justify-between gap-3 py-2.5">
        <Link
          to={paths.home}
          className={`-ml-1.5 inline-flex min-h-12 items-center gap-2 rounded-full pr-2 ${focusRing}`}
        >
          <Logo version="symbolOnBrand" sizes="48px" className="size-12" decorative />
          {/* Em telas muito estreitas o nome sai da vista, mas continua lido por leitores de tela. */}
          <span className="font-display text-sm font-extrabold tracking-tight whitespace-nowrap uppercase max-[379px]:sr-only sm:text-[1.05rem]" translate="no">
            {storeInfo.name}
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="flex items-center gap-1.5 sm:gap-3">
          <NavLink
            to={paths.buildOrder}
            className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-white/85 hover:text-white aria-[current=page]:text-gold-400 ${focusRing}`}
          >
            <span className="link-draw">Cardápio</span>
          </NavLink>
          <NavLink
            to={paths.cart}
            className={`btn-gold relative inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap sm:px-5 ${focusRing}`}
          >
            <Bag className="size-5" />
            <span>Carrinho</span>
            {count > 0 && (
              <span className="nums grid min-w-6 place-items-center rounded-full bg-acai-800 px-1.5 text-xs leading-6 font-extrabold text-gold-400">
                {count}
                <span className="sr-only"> {count === 1 ? 'item' : 'itens'}</span>
              </span>
            )}
          </NavLink>
        </nav>
      </Container>
    </header>
  )
}
