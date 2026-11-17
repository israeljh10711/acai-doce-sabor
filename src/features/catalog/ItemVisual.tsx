import { Camera } from '../../components/ui/icons.tsx'
import { findCategoryBySlug } from './categories.ts'
import { type ExtraItem, extraForProduct, extraPhoto } from './extras.ts'
import type { ExtraProductSlug, ProductSlug } from './menu.ts'
import { catalogPhotoFit, catalogPhotoSrc, catalogPhotoSrcSet } from './photos.ts'
import { ProductPhoto } from './ProductPhoto.tsx'
import { extraLightbox, productLightbox } from '../lightbox/lightboxImages.ts'
import { ZoomButton } from '../lightbox/ZoomButton.tsx'

type VisualSize = 'sm' | 'md' | 'fill'

const BOX: Record<VisualSize, string> = {
  sm: 'size-11 rounded-xl',
  md: 'size-24 rounded-2xl',
  fill: 'aspect-square w-full rounded-2xl',
}

/** Respiro em volta da foto inteira (artes com texto e embalagens), no fundo claro. */
const CONTAIN_PAD: Record<VisualSize, string> = {
  sm: 'p-0.5',
  md: 'p-1.5',
  fill: 'p-2',
}

/** Largura em que a foto aparece em cada tamanho (atributo `sizes`): o navegador escolhe a cópia. */
const PHOTO_SIZES: Record<VisualSize, string> = {
  sm: '44px',
  md: '96px',
  fill: '(min-width: 40rem) 160px, 112px',
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
  /** Escolhas feitas: com o sabor escolhido, a foto daquele sabor (quando a loja mandou). */
  choices?: Readonly<Record<string, string>>
}

/** Quadro em volta da foto com a lupa, do mesmo tamanho dela. */
const ZOOM_FRAME: Record<VisualSize, string> = {
  sm: 'relative shrink-0 rounded-xl',
  md: 'relative shrink-0 self-start rounded-2xl',
  fill: 'relative block w-full rounded-2xl',
}

/**
 * Foto do item das gavetas num quadro quadrado: a foto da loja (catálogo do WhatsApp, desde
 * 2026-11-16) preenche o quadro, ou aparece inteira quando é uma tabela de sabores. Com o sabor
 * escolhido, a foto do pote daquele sabor.
 */
export function ExtraVisual({ item, size = 'md', sizes, decorative = true, priority = false, zoom = false, choices }: ExtraVisualProps) {
  const photo = (
    <ExtraPhoto item={item} size={size} sizes={sizes} decorative={decorative} priority={priority} choices={choices} />
  )
  if (!zoom) return photo
  return (
    <span className={ZOOM_FRAME[size]}>
      {photo}
      <ZoomButton image={extraLightbox(item, {}, choices)} />
    </span>
  )
}

type ExtraPhotoProps = Required<Pick<ExtraVisualProps, 'item' | 'size' | 'decorative' | 'priority'>> &
  Pick<ExtraVisualProps, 'sizes' | 'choices'>

function ExtraPhoto({ item, size, sizes, decorative, priority, choices }: ExtraPhotoProps) {
  const { image, alt } = extraPhoto(item, choices)
  const contain = catalogPhotoFit(image) === 'contain'
  // Item novo do vendedor ainda sem foto: um quadro com a câmera, do mesmo tamanho.
  if (!image) {
    return (
      <span
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : `${item.name}, sem foto`}
        aria-hidden={decorative ? true : undefined}
        data-item-photo={item.id}
        className={`grid shrink-0 place-items-center bg-acai-50 text-acai-600/60 ring-1 ring-line ${BOX[size]}`}
      >
        <Camera className="size-1/3 max-h-10 max-w-10" />
      </span>
    )
  }
  return (
    <img
      // A chave troca a imagem inteira ao mudar de sabor: nada da foto anterior fica na tela.
      key={image}
      src={catalogPhotoSrc(image, 480)}
      srcSet={catalogPhotoSrcSet(image)}
      sizes={sizes ?? PHOTO_SIZES[size]}
      alt={decorative ? '' : alt}
      width={480}
      height={480}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-item-photo={item.id}
      data-photo={image.split('/').pop()}
      className={`shrink-0 ring-1 ring-line ${contain ? `bg-neutral-50 object-contain ${CONTAIN_PAD[size]}` : 'bg-white object-cover'} ${BOX[size]}`}
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
