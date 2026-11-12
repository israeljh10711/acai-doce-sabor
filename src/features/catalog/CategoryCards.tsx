import { Link } from 'react-router'
import { paths } from '../../paths.ts'
import { CATEGORIES } from './categories.ts'
import { ILLUSTRATIVE_NOTICE } from './notices.ts'
import { SHOWCASE_IMAGES, SHOWCASE_SIZE } from './showcaseImages.ts'

type CategoryCardsProps = {
  /** Nível do título de cada cartão, conforme o título que vem antes na página. */
  headingLevel: 'h2' | 'h3'
  /** Quando os cartões aparecem já na primeira tela, as imagens carregam na hora. */
  priority?: boolean
  className?: string
}

/**
 * Os três cartões que levam ao personalizador de cada categoria, com a imagem de cada um:
 * um render do Blender feito com os mesmos modelos do personalizador 3D.
 */
export function CategoryCards({ headingLevel: Heading, priority = false, className = '' }: CategoryCardsProps) {
  return (
    <div className={className}>
      {/* Celular: um cartão por linha, ilustração em cima. Tablet: deitado, ilustração à
          esquerda. Telas largas: três colunas. */}
      <ul className="grid gap-4 lg:grid-cols-3">
        {CATEGORIES.map((category) => {
          const image = SHOWCASE_IMAGES[category.slug]
          return (
            <li key={category.slug}>
              <Link
                to={paths.configurator(category.slug)}
                className="group flex h-full flex-col gap-5 rounded-2xl border border-cream-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-berry-600 hover:shadow-[0_18px_36px_-24px_rgba(107,15,76,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600 sm:p-5 md:flex-row md:items-center lg:flex-col lg:items-stretch"
              >
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-cream-100 md:aspect-square md:w-36 md:shrink-0 lg:aspect-[4/3] lg:w-auto">
                  {/* Decorativa: o nome e o resumo ao lado já dizem o que é, dentro do mesmo link. */}
                  <img
                    src={image.src}
                    srcSet={image.srcSet}
                    sizes="(min-width: 1024px) 360px, (min-width: 768px) 144px, calc(100vw - 4rem)"
                    width={SHOWCASE_SIZE.width}
                    height={SHOWCASE_SIZE.height}
                    alt=""
                    loading={priority ? 'eager' : 'lazy'}
                    decoding="async"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between gap-6 px-1 md:flex-row md:items-center lg:flex-col lg:items-stretch">
                  <div>
                    <Heading className="font-display text-2xl font-semibold tracking-tight text-plum-900">
                      {category.name}
                    </Heading>
                    <p className="mt-2 text-plum-950/75">{category.summary}</p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-2 font-semibold text-berry-600">
                    {category.actionLabel}
                    <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 text-sm text-plum-950/70">{ILLUSTRATIVE_NOTICE}</p>
    </div>
  )
}
