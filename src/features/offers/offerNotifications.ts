/**
 * Ofertas das notificações flutuantes (pedido de 2026-11-15): só estes 12 produtos, escolhidos
 * pelo responsável por valor e apelo. Preços e valores no meio dos textos vêm do catálogo, então
 * a notificação nunca mostra um preço diferente do cardápio e do carrinho. Para um "preço
 * relâmpago", mude o preço do item no catálogo (`catalog/extras.ts`), com o preço antigo em
 * `originalPriceCents`: cartão, notificação, carrinho e mensagem mudam juntos.
 */
import { formatBRL } from '../../utils/money.ts'
import type { CategorySlug } from '../catalog/categories.ts'
import { type ExtraItem, getExtraItem } from '../catalog/extras.ts'
import { catalogPhotoSrc, productPhoto, productPhotoSrc } from '../catalog/photos.ts'
import { startingPriceCents } from '../catalog/showcase.ts'

/** O que acontece ao tocar na notificação (os nomes são os do pedido). */
export type OfferActionType =
  | 'customizer_1l'
  | 'customizer_barca'
  | 'flavor_modal'
  | 'direct_confirm'
  | 'open_oca'
  | 'open_batido'

type OfferTarget = { kind: 'extra'; itemId: string } | { kind: 'main'; slug: Extract<CategorySlug, 'acai-oca' | 'acai-batido'> }

type Prices = { price: string; oldPrice: string | null }

type OfferConfig = {
  id: string
  target: OfferTarget
  /** Selo: o emoji é enfeite (não é lido pelo leitor de tela). */
  badge: { emoji: string; text: string }
  title: string
  subtitle: (prices: Prices) => string
  actionType: OfferActionType
}

const extra = (itemId: string): OfferTarget => ({ kind: 'extra', itemId })

/** Os 12 produtos permitidos, na ordem do pedido. */
const OFFERS: readonly OfferConfig[] = [
  {
    id: 'pote-de-acai-1-litro',
    target: extra('pote-de-acai-1-litro'),
    badge: { emoji: '🔥', text: 'Oferta mais pedida' },
    title: 'Pote de Açaí 1 Litro Montado',
    subtitle: ({ price, oldPrice }) => `Escolha até 7 adicionais grátis por apenas ${price} (de ${oldPrice})!`,
    actionType: 'customizer_1l',
  },
  {
    id: 'barca-de-acai',
    target: extra('barca-de-acai'),
    badge: { emoji: '⭐', text: 'Especial da casa' },
    title: 'Barca de Açaí Completa',
    subtitle: ({ price }) => `Barca super recheada + 1 cobertura à sua escolha por ${price}!`,
    actionType: 'customizer_barca',
  },
  {
    id: 'kit-completo-casquinha',
    target: extra('kit-completo-casquinha'),
    badge: { emoji: '🍦', text: 'Combo família' },
    title: 'Kit Completo Casquinha',
    subtitle: ({ price }) => `Pote de sorvete 2 Litros + 1 cobertura + 10 casquinhas por ${price}!`,
    actionType: 'flavor_modal',
  },
  {
    id: 'pote-de-acai-2-litros',
    target: extra('pote-de-acai-2-litros'),
    badge: { emoji: '🍨', text: 'Tamanho família' },
    title: 'Açaí Pote de 2 Litros',
    subtitle: () => '2 litros de açaí cremoso pronto para dividir com a galera!',
    actionType: 'direct_confirm',
  },
  {
    id: 'combo-1-litro',
    target: extra('combo-1-litro'),
    badge: { emoji: '⚡', text: 'Combo perfeito' },
    title: 'Combo Sorvete 1L + 10 Casquinhas',
    subtitle: ({ price }) => `Pote de 1 Litro + 10 casquinhas crocantes por apenas ${price}!`,
    actionType: 'flavor_modal',
  },
  {
    id: 'pote-de-sorvete-2-litros-especiais',
    target: extra('pote-de-sorvete-2-litros-especiais'),
    badge: { emoji: '🍧', text: 'Super cremoso' },
    title: 'Pote de Sorvete 2 Litros',
    // "Chocolate Trufado": é o nome do sabor no cardápio (o pedido escreveu "Chocolate").
    subtitle: ({ price }) => `Sabores especiais como Sensação, Napolitano e Chocolate Trufado por ${price}!`,
    actionType: 'flavor_modal',
  },
  {
    id: 'acai-oca',
    target: { kind: 'main', slug: 'acai-oca' },
    badge: { emoji: '👑', text: 'Carro-chefe da loja' },
    title: 'Açaí Oca — O Mais Pedido',
    subtitle: ({ price }) => `Monte no pote, copo ou isopor a partir de ${price} com adicionais grátis!`,
    actionType: 'open_oca',
  },
  {
    id: 'acai-batido',
    target: { kind: 'main', slug: 'acai-batido' },
    badge: { emoji: '🥤', text: 'Refrescante' },
    title: 'Açaí Batido Cremoso',
    subtitle: ({ price }) => `Com leite condensado, amendoim ou paçoca a partir de ${price}!`,
    actionType: 'open_batido',
  },
  {
    id: 'picole-gourmet',
    target: extra('picole-gourmet'),
    badge: { emoji: '🍫', text: 'Dica irresistível' },
    title: 'Picolé Gourmet Cremoso',
    subtitle: ({ price }) => `Sabores Nutella, Paçoca, Morango com Chocolate e Iogurte por ${price}!`,
    actionType: 'flavor_modal',
  },
  {
    id: 'picole-trufado',
    target: extra('picole-trufado'),
    badge: { emoji: '✨', text: 'Recheado' },
    title: 'Picolé Trufado',
    subtitle: ({ price }) => `Cremosidade e recheio de Mousse de Maracujá, Ninho com Nutella e mais por ${price}!`,
    actionType: 'flavor_modal',
  },
  {
    id: 'moreninha',
    target: extra('moreninha'),
    badge: { emoji: '🍦', text: 'Clássico gelado' },
    title: 'Sorvete Moreninha',
    // Como na descrição do item: a casquinha é banhada na cobertura crocante de chocolate.
    subtitle: ({ price }) => `Casquinha com sorvete banhada na cobertura crocante de chocolate por ${price}!`,
    actionType: 'direct_confirm',
  },
  {
    id: 'cremosinho',
    target: extra('cremosinho'),
    badge: { emoji: '❄️', text: 'Geladinho' },
    title: 'Cremosinho (Dindin)',
    subtitle: ({ price }) => `Super cremoso nos sabores Ninho, Chocolate, Morango e Coco por apenas ${price}!`,
    actionType: 'flavor_modal',
  },
]

/**
 * Nunca entram nas notificações (pedido de 2026-11-15): bomboniere de baixo valor e água. Ficam
 * só nas gavetas e na busca.
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
  /** O item das gavetas (escolha de sabor, confirmação ou personalizador). */
  item: ExtraItem | null
  /** A categoria principal (Açaí Oca, Açaí Batido). */
  slug: CategorySlug | null
}

function resolve(config: OfferConfig): OfferNotification {
  if (config.target.kind === 'main') {
    const price = `A partir de ${formatBRL(startingPriceCents(config.target.slug))}`
    return {
      id: config.id,
      badge: config.badge,
      title: config.title,
      subtitle: config.subtitle({ price: formatBRL(startingPriceCents(config.target.slug)), oldPrice: null }),
      priceText: price,
      oldPriceText: null,
      photo: { src: productPhotoSrc(productPhoto(config.target.slug).name, 480), fit: 'contain' },
      actionType: config.actionType,
      item: null,
      slug: config.target.slug,
    }
  }
  const item = getExtraItem(config.target.itemId)
  if (!item) throw new Error(`Oferta sem item no catálogo: ${config.target.itemId}`)
  const price = formatBRL(item.priceCents)
  const oldPrice = item.originalPriceCents ? formatBRL(item.originalPriceCents) : null
  return {
    id: config.id,
    badge: config.badge,
    title: config.title,
    subtitle: config.subtitle({ price, oldPrice }),
    priceText: price,
    oldPriceText: oldPrice,
    photo: { src: catalogPhotoSrc(item.image, 480), fit: 'cover' },
    actionType: config.actionType,
    item,
    slug: null,
  }
}

/** As 12 ofertas, com os preços atuais do catálogo e sem nenhum item da lista proibida. */
export const FEATURED_OFFER_NOTIFICATIONS: readonly OfferNotification[] = OFFERS.map(resolve).filter(
  (offer) => !offer.item || !NEVER_IN_OFFERS.includes(offer.item.id),
)

const offersById = new Map(FEATURED_OFFER_NOTIFICATIONS.map((offer) => [offer.id, offer]))

export function getOffer(id: string | null): OfferNotification | undefined {
  return id ? offersById.get(id) : undefined
}
