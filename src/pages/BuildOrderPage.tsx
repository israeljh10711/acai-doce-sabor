import { Container } from '../components/layout/Container.tsx'
import { CategoryCards } from '../features/catalog/CategoryCards.tsx'
import { usePageTitle } from '../hooks/usePageTitle.ts'

export function BuildOrderPage() {
  usePageTitle('Monte seu Pedido', {
    description:
      'Monte seu açaí Oca, açaí Tradicional ou milk-shake do seu jeito e veja o preço na hora. Açaí Doce Sabor, Teixeira, PB.',
  })

  return (
    <>
      <div className="bg-acai-800 text-white">
        <Container className="pt-8 pb-24 sm:pt-12 sm:pb-28">
          <p className="text-sm font-bold tracking-[0.14em] text-gold-400 uppercase">Passo 1 de 3</p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight uppercase sm:text-6xl">
            Monte seu Pedido
          </h1>
          <p className="mt-3 max-w-prose text-lg text-white/80">
            Escolha por onde começar. No açaí, as frutas e as caldas entram à parte dos adicionais.
          </p>
        </Container>
      </div>

      {/* Os cartões sobem sobre a faixa roxa, como blocos. */}
      <Container className="-mt-16 pb-14 sm:-mt-20 sm:pb-20">
        <CategoryCards headingLevel="h2" priority />
      </Container>
    </>
  )
}
