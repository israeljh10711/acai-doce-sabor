import type { ComponentType } from 'react'
import { Candy, CupSoda, Gift, IceCreamBowl, IceCreamCone, Popsicle } from '../../components/ui/icons.tsx'
import { findCategoryBySlug } from './categories.ts'
import { type Emblem, emblemOf } from './emblems.ts'
import { type EmblemIcon, type ExtraItem, extraForProduct } from './extras.ts'
import type { ExtraProductSlug, ProductSlug } from './menu.ts'
import { ProductPhoto } from './ProductPhoto.tsx'

const ICONS: Record<EmblemIcon, ComponentType<{ className?: string }>> = {
  gift: Gift,
  iceCreamBowl: IceCreamBowl,
  iceCreamCone: IceCreamCone,
  popsicle: Popsicle,
  cupSoda: CupSoda,
  candy: Candy,
}

type EmblemSize = 'sm' | 'md' | 'fill'

const BOX: Record<EmblemSize, string> = {
  sm: 'size-11 rounded-xl',
  md: 'size-18 rounded-2xl',
  fill: 'aspect-square w-full rounded-2xl',
}

// No tamanho "fill" o emblema ocupa o quadro em volta: o ícone acompanha a largura dele.
const ICON_SIZE: Record<EmblemSize, string> = {
  sm: 'size-6',
  md: 'size-8',
  fill: 'aspect-square h-auto w-[38%]',
}

/**
 * Emblema no lugar da foto, enquanto o item não tem foto real (pedido de 2026-11-15): o ícone da
 * categoria e um selo curto, em fundo lilás (ou dourado nas ofertas). É decorativo: o nome do
 * item está sempre ao lado.
 */
export function ItemEmblem({ emblem, size = 'md', className = '' }: { emblem: Emblem; size?: EmblemSize; className?: string }) {
  const Icon = ICONS[emblem.icon]
  const tone = emblem.tone === 'gold' ? 'bg-gold-400/25 ring-gold-400/60' : 'bg-acai-800/10 ring-acai-800/10'
  return (
    <span
      aria-hidden="true"
      data-emblem={emblem.icon}
      className={`flex shrink-0 flex-col items-center justify-center gap-1 text-acai-800 ring-1 ${tone} ${BOX[size]} ${className}`}
    >
      <Icon className={ICON_SIZE[size]} />
      {size !== 'sm' && (
        <span
          className={`leading-none font-extrabold tracking-wider uppercase ${size === 'fill' ? 'text-xs' : 'text-[0.625rem]'}`}
        >
          {emblem.seal}
        </span>
      )}
    </span>
  )
}

/** Foto real do item das gavetas, quando houver; até lá, o emblema. */
export function ExtraVisual({ item, size = 'md' }: { item: ExtraItem; size?: EmblemSize }) {
  if (item.image) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}${item.image}`}
        alt=""
        width={72}
        height={72}
        loading="lazy"
        decoding="async"
        className={`shrink-0 bg-white object-cover ring-1 ring-line ${BOX[size]}`}
      />
    )
  }
  return <ItemEmblem emblem={emblemOf(item)} size={size} />
}

type ProductVisualProps = {
  slug: ProductSlug
  sizes: string
  className?: string
  priority?: boolean
  decorative?: boolean
}

/**
 * Foto fixa do produto do personalizador. Os que vêm das gavetas (Pote 1 L Montado, Barca)
 * ainda não têm foto e mostram o emblema da gaveta.
 */
export function ProductVisual({ slug, sizes, className = '', priority, decorative }: ProductVisualProps) {
  const category = findCategoryBySlug(slug)
  if (category) {
    return <ProductPhoto slug={category.slug} sizes={sizes} className={className} priority={priority} decorative={decorative} />
  }
  const extra = extraForProduct(slug as ExtraProductSlug)
  return <ExtraVisual item={extra} size="fill" />
}
