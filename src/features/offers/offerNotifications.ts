/**
 * Ofertas das notificações flutuantes. Desde o cardápio dinâmico (2026-11-21) vêm do banco
 * (`catalog_offers`): o vendedor escolhe produto, tamanho, textos, selo, ordem, datas e, se quiser,
 * um preço promocional (que muda o preço do produto em todo o site e é conferido no servidor). A
 * semente são as 12 do pedido de 2026-11-15 (`baseOffers.ts`).
 *
 * Preços e valores no meio dos textos vêm do cardápio, então a notificação nunca mostra um preço
 * diferente do cardápio e do carrinho.
 */
import { formatBRL } from '../../utils/money.ts'
import type { CategorySlug } from '../catalog/categories.ts'
import { CATEGORIES } from '../catalog/categories.ts'
import { getCatalogRecords, getLiveOffers } from '../catalog/catalogState.ts'
import { EXTRA_ITEMS, type ExtraItem, getExtraItem } from '../catalog/extras.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { catalogPhotoSrc, productPhoto, productPhotoSrc } from '../catalog/photos.ts'
import type { LiveOffer } from '../catalog/recordsAdapter.ts'
import { startingPriceCents } from '../catalog/showcase.ts'
import { BASE_OFFER_RECORDS, offerText } from './baseOffers.ts'

/**
 * O que o toque na oferta abre: o personalizador (o Pote 1 L e a Barca com nome próprio, de antes),
 * a escolha de sabor, a confirmação direta ou um produto da vitrine (Oca e Batido com nome próprio).
 */
export type OfferActionType =
  | 'customizer_1l'
  | 'customizer_barca'
  | 'customizer'
  | 'flavor_modal'
  | 'direct_confirm'
  | 'open_oca'
  | 'open_batido'
  | 'open_main'

/**
 * Nunca entraram nas notificações do pedido de 2026-11-15 (bomboniere de baixo valor e água). A
 * semente não tem nenhum deles; desde 2026-11-21 quem decide é o vendedor, no painel de ofertas.
 */
export const NEVER_IN_OFFERS: readonly string[] = [
  'fini-gelatinas',
  'pipoca-kigarot-45g',
  'pipoca-kigarot-75g',
  'pippos',
  'halls',
  'trident',
  'mentos',
  'jujuba',
  'nucita',
  'batom-ao-leite',
  'docile-canudinho',
  'chocolate-recheado',
  'agua-mineral-500-ml',
]

/**
 * Miniatura da notificação (pedido de 2026-11-15): a mesma foto do cardápio, na cópia de 480 px.
 * As fotos da gaveta são quadradas e preenchem o quadro (`cover`); as dos produtos principais,
 * enviadas pela loja, aparecem inteiras (`contain`), como em todo o site.
 */
export type OfferPhoto = { src: string; fit: 'cover' | 'contain' }

/** Oferta pronta para mostrar: textos com os preços do catálogo e o destino do toque. */
export type OfferNotification = {
  id: string
  badge: { emoji: string; text: string }
  title: string
  subtitle: string
  priceText: string
  oldPriceText: string | null
  photo: OfferPhoto
  actionType: OfferActionType
  /** Item das seções (abre a escolha, a confirmação ou o personalizador). */
  item: ExtraItem | null
  /** Produto da vitrine (abre o personalizador dele). */
  slug: CategorySlug | null
}

/** Foto do item: a do cardápio (`images/...`, em cópia de 480 px) ou a enviada pelo vendedor. */
const itemPhoto = (image: string) => (image.startsWith('images/') ? catalogPhotoSrc(image, 480) : image)

function mainAction(slug: string): OfferActionType {
  return slug === 'acai-oca' ? 'open_oca' : slug === 'acai-batido' ? 'open_batido' : 'open_main'
}

function itemAction(item: ExtraItem): OfferActionType {
  if (item.action.type !== 'customizer') return item.action.type
  return item.action.product === 'pote-de-acai-1-litro' ? 'customizer_1l' : item.action.product === 'barca-de-acai' ? 'customizer_barca' : 'customizer'
}

function resolve(offer: LiveOffer): OfferNotification | null {
  const badge = { emoji: offer.badgeEmoji, text: offer.badgeText }
  const promo = offer.priceCents < offer.regularCents
  const category = CATEGORIES.find((candidate) => candidate.slug === offer.productId)
  if (category) {
    if (PRODUCTS[category.slug]?.available === false) return null
    const price = formatBRL(offer.priceCents)
    const uploaded = category.photo
    return {
      id: offer.id,
      badge,
      title: offer.title,
      subtitle: offerText(offer.subtitle, { price, oldPrice: promo ? formatBRL(offer.regularCents) : null }),
      priceText: `A partir de ${price}`,
      oldPriceText: promo ? formatBRL(offer.regularCents) : null,
      photo: uploaded ? { src: uploaded, fit: 'cover' } : { src: productPhotoSrc(productPhoto(category.slug).name, 480), fit: 'contain' },
      actionType: mainAction(category.slug),
      item: null,
      slug: category.slug,
    }
  }
  const item = getExtraItem(offer.productId)
  if (!item || item.available === false) return null
  const price = formatBRL(offer.priceCents)
  const old = promo ? offer.regularCents : (item.originalPriceCents ?? null)
  const oldPrice = old !== null && old > offer.priceCents ? formatBRL(old) : null
  return {
    id: offer.id,
    badge,
    title: offer.title,
    subtitle: offerText(offer.subtitle, { price, oldPrice }),
    priceText: price,
    oldPriceText: oldPrice,
    photo: { src: itemPhoto(item.image), fit: 'cover' },
    actionType: itemAction(item),
    item,
    slug: null,
  }
}

/**
 * As ofertas valendo: as do banco ou, antes da primeira leitura (e nos testes antigos), as da
 * semente com os preços do cardápio em uso.
 */
function liveOffers(): readonly LiveOffer[] {
  if (getCatalogRecords()) return getLiveOffers()
  return BASE_OFFER_RECORDS.flatMap((offer): LiveOffer[] => {
    const category = CATEGORIES.find((candidate) => candidate.slug === offer.productId)
    const cents = category ? startingPriceCents(category.slug) : getExtraItem(offer.productId)?.priceCents
    return cents === undefined ? [] : [{ ...offer, regularCents: cents, priceCents: cents }]
  })
}

let current: { key: readonly unknown[]; offers: readonly OfferNotification[]; byId: ReadonlyMap<string, OfferNotification> } | null = null

function currentOffers() {
  const key = [EXTRA_ITEMS, PRODUCTS, CATEGORIES, getLiveOffers(), getCatalogRecords()]
  if (!current || current.key.some((part, index) => part !== key[index])) {
    const offers = liveOffers().flatMap((offer) => resolve(offer) ?? [])
    current = { key, offers, byId: new Map(offers.map((offer) => [offer.id, offer])) }
  }
  return current
}

/** As notificações valendo agora, na ordem do vendedor. */
export function featuredOffers(): readonly OfferNotification[] {
  return currentOffers().offers
}

/** A oferta pelo id, com os preços de agora; `undefined` se saiu (item esgotado, oferta acabou). */
export function getOffer(id: string | null): OfferNotification | undefined {
  return id ? currentOffers().byId.get(id) : undefined
}
