import type { ComponentType } from 'react'
import { Candy, CupSoda, Gift, IceCreamBowl, IceCreamCone, Popsicle } from '../../components/ui/icons.tsx'
import { findCategoryBySlug } from './categories.ts'
import type { Emblem } from './emblems.ts'
import { type EmblemIcon, type ExtraItem, extraForProduct } from './extras.ts'
import type { ExtraProductSlug, ProductSlug } from './menu.ts'
import { catalogPhotoSrc, catalogPhotoSrcSet } from './photos.ts'
import { ProductPhoto } from './ProductPhoto.tsx'
import { extraLightbox, productLightbox } from '../lightbox/lightboxImages.ts'
import { ZoomButton } from '../lightbox/ZoomButton.tsx'

const ICONS: Record<EmblemIcon, ComponentType<{ className?: string }>> = {
  gift: Gift,
  iceCreamBowl: IceCreamBowl,
  iceCreamCone: IceCreamCone,
  popsicle: Popsicle,
  cupSoda: CupSoda,
  candy: Candy,
}

type VisualSize = 'sm' | 'md' | 'fill'

const BOX: Record<VisualSize, string> = {
  sm: 'size-11 rounded-xl',
  md: 'size-24 rounded-2xl',
  fill: 'aspect-square w-full rounded-2xl',
}

// No tamanho "fill" o emblema ocupa o quadro em volta: o ícone acompanha a largura dele.
const ICON_SIZE: Record<VisualSize, string> = {
  sm: 'size-6',
  md: 'size-8',
  fill: 'aspect-square h-auto w-[38%]',
}

/** Largura em que a foto aparece em cada tamanho (atributo `sizes`): o navegador escolhe a cópia. */
const PHOTO_SIZES: Record<VisualSize, string> = {
  sm: '44px',
  md: '96px',
  fill: '(min-width: 40rem) 160px, 112px',
}

/**
 * Emblema da gaveta (ícone e selo, em fundo lilás) no botão que abre cada gaveta. É decorativo:
 * o título da gaveta está sempre ao lado.
 */
export function ItemEmblem({ emblem, size = 'md', className = '' }: { emblem: Emblem; size?: VisualSize; className?: string }) {
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

type ExtraVisualProps = {
  item: ExtraItem
  size?: VisualSize
  /** Largura em que a foto aparece, quando não é a padrão do tamanho. */
  sizes?: string
  /** Nos cartões e janelas o nome do item está ao lado: a foto é enfeite (sem texto alternativo). */
  decorative?: boolean
  /** Foto da primeira dobra: carregar já. */
  priority?: boolean
  /** Tocar na foto abre a foto ampliada (com a lupa no canto). */
  zoom?: boolean
}

/** Quadro em volta da foto com a lupa, do mesmo tamanho dela. */
const ZOOM_FRAME: Record<VisualSize, string> = {
  sm: 'relative shrink-0 rounded-xl',
  md: 'relative shrink-0 self-start rounded-2xl',
  fill: 'relative block w-full rounded-2xl',
}

/**
 * Foto do item das gavetas (pedido de 2026-11-15): quadrada, preenchendo o quadro, na cópia leve
 * (WebP de 480 ou 960 px) que serve ao tamanho em que aparece.
 */
export function ExtraVisual({ item, size = 'md', sizes, decorative = true, priority = false, zoom = false }: ExtraVisualProps) {
  const photo = <ExtraPhoto item={item} size={size} sizes={sizes} decorative={decorative} priority={priority} />
  if (!zoom) return photo
  return (
    <span className={ZOOM_FRAME[size]}>
      {photo}
      <ZoomButton image={extraLightbox(item)} />
    </span>
  )
}

function ExtraPhoto({ item, size, sizes, decorative, priority }: Required<Omit<ExtraVisualProps, 'zoom' | 'sizes'>> & { sizes?: string }) {
  return (
    <img
      src={catalogPhotoSrc(item.image, 480)}
      srcSet={catalogPhotoSrcSet(item.image)}
      sizes={sizes ?? PHOTO_SIZES[size]}
      alt={decorative ? '' : item.imageAlt}
      width={480}
      height={480}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-item-photo={item.id}
      className={`shrink-0 bg-white object-cover ring-1 ring-line ${BOX[size]}`}
    />
  )
}

type ProductVisualProps = {
  slug: ProductSlug
  sizes: string
  className?: string
  priority?: boolean
  decorative?: boolean
  /** Tocar na foto abre a foto ampliada (com a lupa no canto). */
  zoom?: boolean
}

/**
 * Foto fixa do produto do personalizador: a enviada pela loja (Açaí Oca, Tradicional, Batido e
 * Milk-shake) ou, nos que vêm das gavetas (Pote 1 L Montado, Barca), a foto do item da gaveta.
 */
export function ProductVisual({ slug, sizes, className = '', priority, decorative, zoom = false }: ProductVisualProps) {
  const category = findCategoryBySlug(slug)
  const photo = category ? (
    <ProductPhoto slug={category.slug} sizes={sizes} className={className} priority={priority} decorative={decorative} />
  ) : (
    <ExtraPhoto item={extraForProduct(slug as ExtraProductSlug)} size="fill" sizes={sizes} decorative={decorative ?? false} priority={priority ?? false} />
  )
  if (!zoom) return photo
  return (
    <span className="relative block size-full rounded-[inherit]">
      {photo}
      <ZoomButton image={productLightbox(slug)} />
    </span>
  )
}
