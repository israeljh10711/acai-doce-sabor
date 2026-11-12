import { Link } from 'react-router'
import { Container } from '../../components/layout/Container.tsx'
import { ArrowLeft } from '../../components/ui/icons.tsx'
import { usePageTitle } from '../../hooks/usePageTitle.ts'
import { paths } from '../../paths.ts'
import { findCategoryBySlug } from '../catalog/categories.ts'
import type { Product } from '../catalog/menu.ts'
import { FlavorStep } from '../milkshake-configurator/FlavorStep.tsx'
import { OrderSummary } from './OrderSummary.tsx'
import { PreviewPanel } from './PreviewPanel.tsx'
import { SizeStep } from './SizeStep.tsx'
import { ToppingStep } from './ToppingStep.tsx'
import { useConfigurator } from './useConfigurator.ts'

/**
 * Personalizador de um produto. É o mesmo para as três categorias: o que muda
 * (tamanhos, sabores, grupos de ingredientes) vem dos dados do produto.
 */
export function Configurator({ product }: { product: Product }) {
  usePageTitle(product.name, {
    description:
      product.flavors.length > 0
        ? `Monte seu ${product.name}: escolha o tamanho, um dos ${product.flavors.length} sabores e as coberturas, e veja o preço na hora. Açaí Doce Sabor, Teixeira, PB.`
        : `Monte seu ${product.name}: escolha o tamanho, os adicionais, as frutas e as coberturas, e veja o preço na hora. Açaí Doce Sabor, Teixeira, PB.`,
  })
  const cfg = useConfigurator(product)
  const summary = findCategoryBySlug(product.slug)?.summary

  const hasFlavors = product.flavors.length > 0
  const firstToppingStep = hasFlavors ? 3 : 2

  return (
    <>
      <div className="bg-acai-800 text-white">
        <Container className="pt-4 pb-7 sm:pt-7 sm:pb-9">
          <Link
            to={paths.buildOrder}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-gold-400 hover:text-gold-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeft className="size-4" />
            <span className="link-draw">Monte seu Pedido</span>
          </Link>
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">{product.name}</h1>
          {summary && <p className="mt-2 max-w-prose text-lg text-white/80">{summary}</p>}
        </Container>
      </div>

      <Container className="configurator-grid pt-5 pb-16 sm:pt-8">
        <div className="cfg-preview">
          <PreviewPanel product={product} cfg={cfg} />
        </div>

        <div className="cfg-base flex flex-col gap-10">
          <SizeStep product={product} cfg={cfg} number={1} />
          {hasFlavors && <FlavorStep product={product} cfg={cfg} number={2} />}
        </div>

        <div className="cfg-extras flex flex-col gap-10">
          {product.groups.map((group, index) => (
            <ToppingStep
              key={group}
              product={product}
              group={group}
              number={firstToppingStep + index}
              cfg={cfg}
            />
          ))}
          <OrderSummary product={product} cfg={cfg} />
        </div>
      </Container>

      {/* Anúncios para leitores de tela a cada mudança. */}
      <p aria-live="polite" className="sr-only">
        {cfg.announcement}
      </p>
    </>
  )
}
