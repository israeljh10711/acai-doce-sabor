import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { ArrowRight, Check } from '../components/ui/icons.tsx'
import { CategoryNav } from '../features/catalog/CategoryNav.tsx'
import { MenuShowcase } from '../features/catalog/MenuShowcase.tsx'
import type { AddedItemState } from '../features/configurator-core/OrderSummary.tsx'
import { StoreStatusBadge } from '../features/store-hours/StoreStatusBadge.tsx'
import { useHashScroll } from '../hooks/useHashScroll.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'

/** Cardápio completo, com as quatro categorias. O cardápio abre mesmo com a loja fechada. */
export function BuildOrderPage() {
  usePageTitle('Cardápio', {
    description:
      'Cardápio do Açaí Doce Sabor: Açaí Oca, Açaí Tradicional, Açaí Batido e Milk-shake, montados do seu jeito, com preço na hora. Teixeira, PB.',
  })
  useHashScroll()

  return (
    <>
      <div className="bg-acai-800 bg-[radial-gradient(ellipse_at_80%_20%,#6a1650_0%,#4a0e36_50%,#3b072a_100%)] text-white">
        <Container className="flex flex-col items-start gap-4 pt-10 pb-12 sm:pt-12 sm:pb-14">
          <StoreStatusBadge />
          <h1 className="font-display text-5xl font-black tracking-tight uppercase sm:text-6xl">Cardápio</h1>
          <p className="max-w-xl text-lg text-white/85">
            Açaí Oca, Açaí Tradicional, Açaí Batido e Milk-shake. Escolha uma categoria e monte o seu.
          </p>
          <AddedNotice />
        </Container>
      </div>
      <CategoryNav />
      <div className="bg-acai-50 py-10 sm:py-14">
        <Container>
          <MenuShowcase headingLevel="h2" />
        </Container>
      </div>
    </>
  )
}

/**
 * Aviso de item adicionado, quando o cliente chega pelo "Adicionar e continuar comprando" do
 * personalizador. A região de anúncio já está na página e recebe o texto logo depois, para o
 * leitor de tela ler. O aviso sai do histórico: recarregar a página não o repete.
 */
function AddedNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const [added] = useState(() => (location.state as AddedItemState | null)?.added ?? null)
  const [text, setText] = useState('')

  useEffect(() => {
    if (!added) return
    navigate(location.pathname + location.hash, { replace: true, state: null })
    const timer = window.setTimeout(() => setText(`${added} adicionado ao carrinho.`), 120)
    return () => window.clearTimeout(timer)
  }, [added, navigate, location.pathname, location.hash])

  return (
    <p role="status" className="max-w-xl">
      {text && (
        <span className="inline-flex flex-wrap items-center gap-x-3 rounded-2xl bg-gold-100 py-1 pr-2 pl-4 text-sm font-semibold text-acai-950 ring-1 ring-gold-400">
          <span className="inline-flex items-center gap-2">
            <Check className="size-4 text-acai-700" />
            {text}
          </span>
          <Link
            to={paths.cart}
            className="inline-flex min-h-11 items-center gap-1 font-extrabold text-acai-800 underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            Ver carrinho
            <ArrowRight className="size-4" />
          </Link>
        </span>
      )}
    </p>
  )
}
