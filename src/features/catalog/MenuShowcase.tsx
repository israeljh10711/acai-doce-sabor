import { m } from 'motion/react'
import { Link } from 'react-router'
import { ArrowRight, Crown, Flame } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { MAIN_ANCHORS } from './catalogNav.ts'
import { CATEGORIES, type Category, type CategorySlug } from './categories.ts'
import { PRODUCTS } from './menu.ts'
import { ProductPhoto } from './ProductPhoto.tsx'
import { productLightbox } from '../lightbox/lightboxImages.ts'
import { ZoomButton } from '../lightbox/ZoomButton.tsx'
import { SellerEditButton } from '../seller/SellerAccess.tsx'
import { startingPriceCents } from './showcase.ts'

const BADGE_ICONS = { 'Especialidade da casa': Crown, 'O mais pedido': Flame } as const

const reveal = {
  initial: { y: 18 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] },
} as const

/**
 * Cardápio em vitrine: o Açaí Oca em destaque e as outras três categorias em cartões.
 * Cada cartão tem âncora própria (#secao-acai-oca, #secao-acai-tradicional...) para a navegação do cardápio.
 * Com `visible` (resultado da busca), mostra só essas categorias.
 */
export function MenuShowcase({
  headingLevel = 'h3',
  visible,
}: {
  headingLevel?: 'h2' | 'h3'
  visible?: readonly CategorySlug[]
}) {
  const [featured, ...rest] = CATEGORIES
  const shows = (category: Category) => !visible || visible.includes(category.slug)
  const others = rest.filter(shows)
  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {shows(featured) && <FeaturedCard category={featured} Heading={headingLevel} />}
      {others.length > 0 && (
        <ul className="grid gap-6 md:grid-cols-3">
          {others.map((category) => (
            // A âncora (e o contorno da navegação) fica no <li>, sem o deslocamento da animação de
            // entrada: assim a rolagem até o cartão para no lugar certo.
            <li
              key={category.slug}
              id={MAIN_ANCHORS[category.slug]}
              tabIndex={-1}
              data-flash-target=""
              className="scroll-mt-34 rounded-[1.75rem] focus:outline-none lg:scroll-mt-6"
            >
              <m.div className="h-full" {...reveal}>
                <ProductCard category={category} Heading={headingLevel} />
              </m.div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Badges({ category }: { category: Category }) {
  if (category.badges.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Destaques">
      {category.badges.map((badge) => {
        const Icon = BADGE_ICONS[badge]
        return (
          <li
            key={badge}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1 text-xs font-extrabold tracking-wide text-acai-950 uppercase"
          >
            <Icon className="size-3.5" />
            {badge}
          </li>
        )
      })}
    </ul>
  )
}

function FeaturedCard({ category, Heading }: { category: Category; Heading: 'h2' | 'h3' }) {
  const product = PRODUCTS[category.slug]
  const kinds = [...new Set(product.sizes.map((size) => size.container))].length
  return (
    // A âncora fica no <article>, sem o deslocamento da animação de entrada (que fica por dentro).
    <article
      id={MAIN_ANCHORS[category.slug]}
      tabIndex={-1}
      data-flash-target=""
      aria-labelledby={`${category.slug}-titulo`}
      className="scroll-mt-34 rounded-[2rem] focus:outline-none lg:scroll-mt-6"
    >
      <m.div
        className="relative grid overflow-hidden rounded-[2rem] bg-acai-800 text-white shadow-lift xl:grid-cols-[1.05fr_1fr]"
        {...reveal}
      >
      <div className="relative bg-white">
        <ProductPhoto slug={category.slug} sizes="(min-width: 80rem) 480px, (min-width: 64rem) 680px, 100vw" className="size-full min-h-72" />
        <ZoomButton image={productLightbox(category.slug)} />
        <SellerEditButton target={{ kind: 'product', id: category.slug }} label={category.name} className="absolute top-3 left-3 z-20" />
      </div>
      <div className="flex flex-col justify-center gap-5 p-6 sm:p-10">
        <Badges category={category} />
        <Heading id={`${category.slug}-titulo`} className="font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">
          {category.name}
        </Heading>
        <p className="max-w-md text-lg leading-relaxed text-white/85">{category.tagline}</p>
        <dl className="grid max-w-md grid-cols-3 gap-3 text-center">
          <Fact label="A partir de" value={formatBRL(startingPriceCents(category.slug))} />
          <Fact label="Tamanhos" value={String(product.sizes.length)} />
          <Fact label="Recipientes" value={String(kinds)} />
        </dl>
        <Link
          to={paths.configurator(category.slug)}
          className="btn-gold inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full px-7 text-base font-extrabold tracking-tight uppercase focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white sm:w-fit"
        >
          {category.actionLabel}
          <ArrowRight className="size-5" />
        </Link>
      </div>
      </m.div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 px-2 py-3 ring-1 ring-white/15">
      <dt className="text-[0.7rem] font-bold tracking-wide text-white/75 uppercase">{label}</dt>
      <dd className="nums mt-0.5 font-display text-xl font-black whitespace-nowrap text-gold-400">{value}</dd>
    </div>
  )
}

function ProductCard({ category, Heading }: { category: Category; Heading: 'h2' | 'h3' }) {
  return (
    <article
      aria-labelledby={`${category.slug}-titulo`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative border-b border-line bg-white">
        {/* Espaço no alto para o selo de preço não cobrir a tampa do copo nem a da garrafa. */}
        <ProductPhoto slug={category.slug} sizes="(min-width: 48rem) 360px, 100vw" className="w-full px-4 pt-14 pb-3" />
        {/* Por cima do link que cobre o cartão: tocar na foto amplia, o resto abre o personalizador. */}
        <ZoomButton image={productLightbox(category.slug)} />
        <SellerEditButton target={{ kind: 'product', id: category.slug }} label={category.name} className="absolute top-4 left-4 z-20" />
        <p className="nums absolute top-4 right-4 rounded-full bg-gold-400 px-3 py-1 text-sm font-extrabold whitespace-nowrap text-acai-950 shadow-sm">
          <span className="font-semibold">a partir de </span>
          {formatBRL(startingPriceCents(category.slug))}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <Heading id={`${category.slug}-titulo`} className="font-display text-2xl font-black tracking-tight text-acai-800 uppercase">
          {category.name}
        </Heading>
        <p className="text-ink-soft">{category.tagline}</p>
        <p className="text-sm font-semibold text-acai-700">{category.summary}</p>
        <Link
          to={paths.configurator(category.slug)}
          className="mt-auto inline-flex min-h-12 items-center gap-2 pt-3 font-extrabold text-acai-800 after:absolute after:inset-0 after:content-[''] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800"
        >
          <span className="link-draw">{category.actionLabel}</span>
          <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  )
}
