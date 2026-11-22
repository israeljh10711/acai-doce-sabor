import { Link, NavLink } from 'react-router'
import { cartCount } from '../../features/cart/cart.ts'
import { StoreHeaderBadge } from '../../features/store-hours/StoreHeaderBadge.tsx'
import { useCart } from '../../features/cart/cartStore.ts'
import { paths } from '../../paths.ts'
import { useStoreSettings } from '../../features/catalog/catalogStore.ts'
import { Logo } from '../brand/Logo.tsx'
import { Bag } from '../ui/icons.tsx'
import { Container } from './Container.tsx'

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Topo do site (redesenho de 2026-11-22): claro e baixo, para a foto e o conteúdo da página
 * aparecerem logo. A logo no disco roxo e o nome da loja; a situação da loja; "Cardápio" e o
 * carrinho, a única ação principal do topo.
 */
export function SiteHeader() {
  // O nome das Configurações da loja (2026-11-21).
  const { name } = useStoreSettings().identity
  const count = cartCount(useCart())

  return (
    <header className="border-b border-line bg-canvas text-ink">
      <Container className="flex items-center justify-between gap-3 py-2">
        <Link to={paths.home} className={`-ml-1 inline-flex min-h-12 items-center gap-2.5 rounded-full pr-2 ${focusRing}`}>
          <Logo version="badge" sizes="44px" className="size-11" decorative />
          {/* No celular o nome sai da vista (não cabe ao lado de Cardápio e Carrinho), mas continua
              lido por leitores de tela; a logo fica. */}
          <span className="font-display text-xl font-extrabold tracking-tight whitespace-nowrap text-acai-800 max-sm:sr-only" translate="no">
            {name}
          </span>
        </Link>

        {/* Loja aberta ou fechada e o prazo de entrega (pedido de 2026-11-17); abaixo de 1024 px, numa
            linha fina embaixo do topo (ao lado da logo e do menu não cabe). */}
        <StoreHeaderBadge className="hidden min-w-0 lg:inline-flex" />

        <nav aria-label="Navegação principal" className="flex items-center gap-1 sm:gap-2">
          <NavLink
            to={paths.buildOrder}
            className={`group inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-acai-800 transition-colors duration-150 hover:bg-acai-100 ${focusRing}`}
          >
            {/* A página atual fica marcada por um traço orquídea embaixo do nome. */}
            <span className="border-b-2 border-transparent pb-0.5 group-aria-[current=page]:border-orchid-500">Cardápio</span>
          </NavLink>
          <NavLink
            to={paths.cart}
            className={`btn-primary relative inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap sm:px-5 ${focusRing}`}
          >
            <Bag className="size-5" />
            <span>Carrinho</span>
            {count > 0 && (
              <span className="nums grid min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs leading-6 font-extrabold text-orchid-700">
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
