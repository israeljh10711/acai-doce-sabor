import type { CategorySlug } from './categories.ts'
import { productPhoto, productPhotoSrc } from './photos.ts'

type ProductPhotoProps = {
  slug: CategorySlug
  /** Largura em que a foto aparece, no formato do atributo `sizes`. */
  sizes: string
  className?: string
  /** Foto da primeira dobra: carregar já. */
  priority?: boolean
  /** Use quando o texto ao lado já descreve o produto. */
  decorative?: boolean
}

/**
 * Foto fixa e real do produto, enviada pela loja. Aparece inteira e centralizada
 * (`object-contain`): copo, garrafa e cobertura nunca são cortados. Não muda com os ingredientes
 * nem com o recipiente escolhidos. A foto não pinta fundo: o quadro em volta decide (branco nos
 * cartões; o roxo da página no milk-shake recortado do topo da página inicial).
 */
export function ProductPhoto({ slug, sizes, className = '', priority = false, decorative = false }: ProductPhotoProps) {
  const photo = productPhoto(slug)
  return (
    <img
      src={productPhotoSrc(photo.name)}
      srcSet={`${productPhotoSrc(photo.name, 480)} 480w, ${productPhotoSrc(photo.name, 960)} 960w`}
      sizes={sizes}
      width={photo.width}
      height={photo.height}
      alt={decorative ? '' : photo.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      data-product-photo={photo.name}
      data-transparent={photo.transparent ? '' : undefined}
      className={`aspect-square object-contain ${className}`}
    />
  )
}
