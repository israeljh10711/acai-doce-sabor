import { Container } from '../components/layout/Container.tsx'
import { CategoryNav } from '../features/catalog/CategoryNav.tsx'
import { MenuShowcase } from '../features/catalog/MenuShowcase.tsx'
import { StoreStatusBadge } from '../features/store-hours/StoreStatusBadge.tsx'
import { useHashScroll } from '../hooks/useHashScroll.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'

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
