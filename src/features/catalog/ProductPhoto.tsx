import type { CategorySlug } from './categories.ts'
import type { ContainerKind } from './menu.ts'
import { productPhoto, productPhotoSrc } from './photos.ts'

type ProductPhotoProps = {
  slug: CategorySlug
  container?: ContainerKind
  /** Largura em que a foto aparece, no formato do atributo `sizes`. */
  sizes: string
  className?: string
  /** Foto da primeira dobra: carregar já. */
  priority?: boolean
  /** Use quando o texto ao lado já descreve o produto. */
  decorative?: boolean
}

/** Foto fixa e real do produto, quadrada. Não muda com os ingredientes escolhidos. */
export function ProductPhoto({ slug, container, sizes, className = '', priority = false, decorative = false }: ProductPhotoProps) {
  const photo = productPhoto(slug, container)
  return (
    <img
      src={productPhotoSrc(photo.name, 800)}
      srcSet={`${productPhotoSrc(photo.name, 400)} 400w, ${productPhotoSrc(photo.name, 800)} 800w`}
      sizes={sizes}
      width={800}
      height={800}
      alt={decorative ? '' : photo.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-product-photo={photo.name}
      className={`aspect-square object-cover ${className}`}
    />
  )
}
