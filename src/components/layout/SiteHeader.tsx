import { Link, NavLink } from 'react-router'
import { cartCount } from '../../features/cart/cart.ts'
import { StoreHeaderBadge } from '../../features/store-hours/StoreHeaderBadge.tsx'
import { useCart } from '../../features/cart/cartStore.ts'
import { paths } from '../../paths.ts'
import { useStoreSettings } from '../../features/catalog/catalogStore.ts'
import { Logo } from '../brand/Logo.tsx'
import { Bag } from '../ui/icons.tsx'
import { Container } from './Container.tsx'

const focusRing =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white'

export function SiteHeader() {
  // O nome das Configurações da loja (2026-11-21).
  const { name } = useStoreSettings().identity
  const count = cartCount(useCart())

  return (
    <header className="bg-acai-800 text-white">
      <Container className="flex items-center justify-between gap-3 py-2.5">
        <Link
          to={paths.home}
          className={`-ml-1.5 inline-flex min-h-12 items-center gap-2 rounded-full pr-2 ${focusRing}`}
        >
          <Logo version="symbolOnBrand" sizes="48px" className="size-12" decorative />
          {/* No celular o nome sai da vista (não cabe ao lado de Cardápio e Carrinho), mas continua
              lido por leitores de tela; o símbolo da logo fica. */}
          <span className="font-display text-[1.05rem] font-extrabold tracking-tight whitespace-nowrap uppercase max-sm:sr-only" translate="no">
            {name}
          </span>
        </Link>

        {/* Loja aberta ou fechada e o prazo de entrega (pedido de 2026-11-17); abaixo de 1024 px, numa
            linha fina embaixo do cabeçalho (ao lado da logo e do menu não cabe). */}
        <StoreHeaderBadge className="hidden min-w-0 lg:inline-flex" />

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
      <StoreHeaderBadge strip className="lg:hidden" />
    </header>
  )
}
