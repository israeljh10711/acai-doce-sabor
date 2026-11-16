/**
 * O que a foto ampliada mostra (pedido de 2026-11-16): a foto na maior cópia que temos, o nome,
 * o preço e uma descrição curta. Um construtor para cada tipo de foto do site, para o nome e o
 * preço serem sempre os do cardápio.
 */
import { formatBRL } from '../../utils/money.ts'
import { type CategorySlug, findCategoryBySlug } from '../catalog/categories.ts'
import { type ExtraItem, extraForProduct } from '../catalog/extras.ts'
import { type ExtraProductSlug, type ProductSlug, TOPPING_GROUPS, type Topping } from '../catalog/menu.ts'
import { catalogPhotoSrc, catalogPhotoSrcSet, ingredientZoomSrc, productPhoto, productPhotoSrc } from '../catalog/photos.ts'
import { startingPriceCents } from '../catalog/showcase.ts'
import type { OfferNotification } from '../offers/offerNotifications.ts'

export type LightboxImage = {
  /** Identificador para os testes (`produto:acai-oca`, `item:sundae`, `ingrediente:banana`). */
  id: string
  src: string
  srcSet?: string
  /**
   * Largura real da maior cópia, em pixels. A foto nunca aparece maior que o dobro dela (as
   * fotos pequenas ficariam borradas). Sem o valor, vale a largura do arquivo carregado.
   */
  width?: number
  alt: string
  title: string
  /** Selo dourado ao lado do nome: "R$ 30,00", "A partir de R$ 10,00", "Grátis". */
  price?: string
  description?: string
}

type Overrides = Partial<Pick<LightboxImage, 'price' | 'description' | 'title'>>

/** Item das gavetas (e o Pote 1 L Montado e a Barca): a cópia de 960 px. */
export function extraLightbox(item: ExtraItem, overrides: Overrides = {}): LightboxImage {
  return {
    id: `item:${item.id}`,
    src: catalogPhotoSrc(item.image, 960),
    srcSet: catalogPhotoSrcSet(item.image),
    width: 960,
    alt: item.imageAlt,
    title: item.name,
    price: formatBRL(item.priceCents),
    description: item.description,
    ...overrides,
  }
}

/** Produto do personalizador: a foto enviada pela loja ou, no Pote 1 L e na Barca, a da gaveta. */
export function productLightbox(slug: ProductSlug, overrides: Overrides = {}): LightboxImage {
  const category = findCategoryBySlug(slug)
  if (!category) return extraLightbox(extraForProduct(slug as ExtraProductSlug), overrides)
  const photo = productPhoto(category.slug as CategorySlug)
  return {
    id: `produto:${category.slug}`,
    src: productPhotoSrc(photo.name, 960),
    srcSet: `${productPhotoSrc(photo.name, 480)} 480w, ${productPhotoSrc(photo.name, 960)} 960w`,
    // As cópias de 960 px das fotos menores que isso foram ampliadas: vale a foto enviada.
    width: Math.min(960, photo.width),
    alt: photo.alt,
    title: category.name,
    price: `A partir de ${formatBRL(startingPriceCents(category.slug as CategorySlug))}`,
    description: category.tagline,
    ...overrides,
  }
}

/** Adicional, fruta, calda ou creme: a foto inteira (as de banco, na cópia grande). */
export function toppingLightbox(topping: Topping, overrides: Overrides = {}): LightboxImage {
  return {
    id: `ingrediente:${topping.id}`,
    src: ingredientZoomSrc(topping) ?? '',
    alt: topping.name,
    title: topping.name,
    price: topping.priceCents > 0 ? `+ ${formatBRL(topping.priceCents)}` : 'Grátis',
    description: TOPPING_GROUPS[topping.group].name,
    ...overrides,
  }
}

/** A foto da oferta: a do item da gaveta, ou a do produto principal (Açaí Oca, Açaí Batido). */
export function offerLightbox(offer: OfferNotification): LightboxImage {
  if (offer.item) return extraLightbox(offer.item, { title: offer.title, price: offer.priceText, description: offer.subtitle })
  return productLightbox(offer.slug!, { title: offer.title, price: offer.priceText, description: offer.subtitle })
}
