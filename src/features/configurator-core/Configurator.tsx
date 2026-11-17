import { Link, useSearchParams } from 'react-router'
import { Container } from '../../components/layout/Container.tsx'
import { ArrowLeft, Crown, Flame, Tag } from '../../components/ui/icons.tsx'
import { usePageTitle } from '../../hooks/usePageTitle.ts'
import { paths } from '../../paths.ts'
import { findItem } from '../cart/cart.ts'
import { useCart } from '../cart/cartStore.ts'
import { type Product, flavorTermOf } from '../catalog/menu.ts'
import { productInfo } from '../catalog/productInfo.ts'
import { EMPTY_SELECTION } from '../catalog/selection.ts'
import { FlavorStep } from '../milkshake-configurator/FlavorStep.tsx'
import { OrderSummary } from './OrderSummary.tsx'
import { PreviewPanel } from './PreviewPanel.tsx'
import { CompleteBar } from './CompleteBar.tsx'
import { SizeStep } from './SizeStep.tsx'
import { ToppingStep } from './ToppingStep.tsx'
import { useConfigurator } from './useConfigurator.ts'

/** Ícone de cada selo do cabeçalho. Outros selos (como "Oferta") usam a etiqueta. */
const BADGE_ICONS: Readonly<Record<string, typeof Crown>> = { 'Especialidade da casa': Crown, 'O mais pedido': Flame }

/** Descrição da página para buscadores, com o que o produto pede para escolher. */
function pageDescription(product: Product, summary: string): string {
  const store = 'Açaí Doce Sabor, Teixeira, PB.'
  if (product.sizes.length === 1) return `${product.name}: ${summary}. Monte do seu jeito e veja o preço na hora. ${store}`
  return product.flavors.length > 0
    ? `Monte seu ${product.name}: escolha o tamanho, um dos ${product.flavors.length} sabores e as coberturas, e veja o preço na hora. ${store}`
    : `Monte seu ${product.name}: escolha o tamanho, os adicionais, as frutas e as coberturas, e veja o preço na hora. ${store}`
}

/**
 * Personalizador de um produto. É o mesmo para todos: o que muda (tamanhos, sabores, grupos de
 * ingredientes) vem dos dados do produto. Produto de um tamanho só (Pote 1 L Montado, Barca)
 * já abre com ele escolhido. Com `?item=<id>` no endereço, abre um item do carrinho para editar.
 */
export function Configurator({ product }: { product: Product }) {
  const info = productInfo(product.slug)
  usePageTitle(product.name, { description: pageDescription(product, info.summary) })
  const [searchParams] = useSearchParams()
  const cart = useCart()
  const found = findItem(cart, searchParams.get('item'))
  const editing = found?.kind === 'product' && found.slug === product.slug ? found : undefined
  const onlySize = product.sizes.length === 1 ? product.sizes[0] : undefined
  const cfg = useConfigurator(
    product,
    editing?.selection ?? (onlySize ? { ...EMPTY_SELECTION, sizeId: onlySize.id } : undefined),
  )
  const summary = info.summary

  const hasFlavors = product.flavors.length > 0
  const firstToppingStep = hasFlavors ? 3 : 2

  return (
    <>
      <div className="bg-acai-800 text-white">
        <Container className="pt-4 pb-7 sm:pt-7 sm:pb-9">
          <Link
            to={editing ? paths.cart : info.menuPath}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-gold-400 hover:text-gold-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeft className="size-4" />
            <span className="link-draw">{editing ? 'Voltar ao carrinho' : 'Cardápio'}</span>
          </Link>
          {info.badges.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Destaques">
              {info.badges.map((badge) => {
                const Icon = BADGE_ICONS[badge] ?? Tag
                return (
                  <li key={badge} className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-xs font-extrabold tracking-wide text-acai-950 uppercase">
                    <Icon className="size-3.5" />
                    {badge}
                  </li>
                )
              })}
            </ul>
          )}
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">{product.name}</h1>
          {summary && <p className="mt-2 max-w-prose text-lg text-white/80">{summary}</p>}
          {info.priceNote && (
            <p className="nums mt-2 text-lg font-bold text-gold-400">{info.priceNote}</p>
          )}
          {editing && (
            <p className="mt-3 inline-block rounded-full bg-white/12 px-3 py-1 text-sm font-semibold ring-1 ring-white/25">
              Editando um item do carrinho
            </p>
          )}
        </Container>
      </div>

      <Container className="configurator-grid pt-5 pb-16 sm:pt-8">
        <div className="cfg-preview">
          <PreviewPanel product={product} cfg={cfg} />
        </div>

        <div className="cfg-base flex flex-col gap-10">
          <SizeStep product={product} cfg={cfg} number={1} />
          {hasFlavors && <FlavorStep product={product} cfg={cfg} number={2} title={flavorTermOf(product).label} />}
        </div>

        <div className="cfg-extras flex flex-col gap-10">
          {cfg.hasComplete && <CompleteBar cfg={cfg} />}
          {product.groups.map((group, index) => (
            <ToppingStep
              key={group}
              product={product}
              group={group}
              number={firstToppingStep + index}
              cfg={cfg}
            />
          ))}
          <OrderSummary product={product} cfg={cfg} editingItemId={editing?.id} />
        </div>
      </Container>

      {/* Anúncios para leitores de tela a cada mudança. */}
      <p aria-live="polite" className="sr-only">
        {cfg.announcement}
      </p>
    </>
  )
}
