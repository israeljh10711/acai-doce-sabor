import { m } from 'motion/react'
import { Link } from 'react-router'
import { ArrowRight } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { CATEGORIES, type CategorySlug } from './categories.ts'
import { PRODUCTS } from './menu.ts'
import { ILLUSTRATIVE_NOTICE } from './notices.ts'
import { SHOWCASE_IMAGES, SHOWCASE_SIZE } from './showcaseImages.ts'

type CategoryCardsProps = {
  /** Nível do título de cada cartão, conforme o título que vem antes na página. */
  headingLevel: 'h2' | 'h3'
  /** Quando os cartões aparecem já na primeira tela, as imagens carregam na hora. */
  priority?: boolean
  className?: string
}

/** Menor preço do cardápio para a categoria (o tamanho mais barato). */
const fromPrice = (slug: CategorySlug) => Math.min(...PRODUCTS[slug].sizes.map((size) => size.priceCents))

/**
 * Os três cartões que levam ao personalizador de cada categoria, com a imagem de cada um:
 * um render do Blender feito com os mesmos modelos do personalizador 3D, sobre o roxo da marca.
 */
export function CategoryCards({ headingLevel: Heading, priority = false, className = '' }: CategoryCardsProps) {
  return (
    <div className={className}>
      <ul className="grid gap-5 md:grid-cols-3">
        {CATEGORIES.map((category, index) => {
          const image = SHOWCASE_IMAGES[category.slug]
          return (
            <m.li
              key={category.slug}
              // Só desloca, sem esconder: o cartão está sempre visível, mesmo antes de entrar na tela.
              initial={{ y: 14 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: '0px 0px -40px 0px' }}
              transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <Link
                to={paths.configurator(category.slug)}
                className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-acai-800 bg-[radial-gradient(75%_65%_at_50%_45%,#7b1d5c_0%,#4a0e36_72%)]">
                  {/* Decorativa: o nome e o resumo logo abaixo já dizem o que é, dentro do mesmo link. */}
                  <img
                    src={image.src}
                    srcSet={image.srcSet}
                    sizes="(min-width: 1152px) 360px, (min-width: 768px) 31vw, calc(100vw - 2rem)"
                    width={SHOWCASE_SIZE.width}
                    height={SHOWCASE_SIZE.height}
                    alt=""
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                    className="size-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                  />
                  <span className="nums absolute top-3 left-3 rounded-full bg-gold-400 px-3 py-1 text-sm font-bold whitespace-nowrap text-acai-950 shadow-sm">
                    a partir de {formatBRL(fromPrice(category.slug))}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                  <Heading className="font-display text-2xl font-black tracking-tight text-balance text-acai-800 uppercase">
                    {category.name}
                  </Heading>
                  <p className="text-ink-soft">{category.summary}</p>
                  <span className="btn-gold mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 font-bold">
                    {category.actionLabel}
                    <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </m.li>
          )
        })}
      </ul>

      <p className="mt-7 text-sm text-ink-soft">{ILLUSTRATIVE_NOTICE}</p>
    </div>
  )
}
