import { Container } from '../components/layout/Container.tsx'
import { LEGACY_ANCHORS } from '../features/catalog/catalogNav.ts'
import { MenuBrowser } from '../features/catalog/MenuBrowser.tsx'
import { StoreClosedCard } from '../features/store-hours/StoreClosedCard.tsx'
import { StoreStatusBadge } from '../features/store-hours/StoreStatusBadge.tsx'
import { useHashScroll } from '../hooks/useHashScroll.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'

/**
 * Cardápio completo: os 4 produtos do personalizador e as 5 seções do catálogo (combos, potes
 * família, picolés, bebidas e doces), com busca, destaques e a navegação. Abre mesmo com a loja fechada.
 */
export function BuildOrderPage() {
  usePageTitle('Cardápio', {
    description:
      'Cardápio do Açaí Doce Sabor: Açaí Oca, Tradicional, Batido e Milk-shake montados do seu jeito, combos, barcas, potes de 1 e 2 litros, picolés, sorvetes, bebidas e doces. Teixeira, PB.',
  })
  useHashScroll(LEGACY_ANCHORS)

  return (
    <>
      <div className="bg-acai-800 bg-[radial-gradient(ellipse_at_80%_20%,#6a1650_0%,#4a0e36_50%,#3b072a_100%)] text-white">
        <Container className="flex flex-col items-start gap-4 pt-10 pb-12 sm:pt-12 sm:pb-14">
          <StoreStatusBadge />
          <h1 className="font-display text-5xl font-black tracking-tight uppercase sm:text-6xl">Cardápio</h1>
          <p className="max-w-xl text-lg text-white/85">
            Açaí Oca, Açaí Tradicional, Açaí Batido e Milk-shake, e também combos, potes família, picolés, bebidas e
            doces.
          </p>
        </Container>
      </div>
      {/* Loja fechada (pedido de 2026-11-17): o convite para voltar, o endereço e o WhatsApp. */}
      <Container className="pt-8 empty:hidden">
        <StoreClosedCard />
      </Container>
      <MenuBrowser headingLevel={2} />
    </>
  )
}
