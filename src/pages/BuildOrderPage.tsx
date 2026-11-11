import { Container } from '../components/layout/Container.tsx'
import { CategoryCards } from '../features/catalog/CategoryCards.tsx'
import { usePageTitle } from '../hooks/usePageTitle.ts'

export function BuildOrderPage() {
  usePageTitle('Monte seu Pedido')

  return (
    <Container className="py-10 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-plum-900 sm:text-5xl">
        Monte seu Pedido
      </h1>
      <p className="mt-3 max-w-prose text-lg text-plum-950/75">
        Escolha por onde começar. No açaí, as frutas e as caldas entram à parte dos adicionais.
      </p>

      <CategoryCards headingLevel="h2" className="mt-8" />
    </Container>
  )
}
