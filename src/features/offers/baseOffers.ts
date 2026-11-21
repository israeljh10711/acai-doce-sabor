/**
 * As 12 ofertas do aviso flutuante como estavam no código (pedido de 2026-11-15), em registros do
 * banco (cardápio dinâmico, 2026-11-21): a semente de `catalog_offers`. Nenhuma muda o preço
 * (`promoPriceCents: null`); `{preco}` e `{preco_antigo}` viram os preços do produto na hora.
 */
import type { OfferRecord } from '../catalog/records.ts'

type Seed = Pick<OfferRecord, 'id' | 'productId' | 'title' | 'subtitle' | 'badgeEmoji' | 'badgeText'>

const SEEDS: readonly Seed[] = [
  {
    id: 'pote-de-acai-1-litro',
    productId: 'pote-de-acai-1-litro',
    badgeEmoji: '🔥',
    badgeText: 'Oferta mais pedida',
    title: 'Pote de Açaí 1 Litro Montado',
    subtitle: 'Escolha até 7 adicionais grátis por apenas {preco} (de {preco_antigo})!',
  },
  {
    id: 'barca-de-acai',
    productId: 'barca-de-acai',
    badgeEmoji: '⭐',
    badgeText: 'Especial da casa',
    title: 'Barca de Açaí Completa',
    subtitle: 'Barca super recheada + 1 cobertura à sua escolha por {preco}!',
  },
  {
    id: 'kit-completo-casquinha',
    productId: 'kit-completo-casquinha',
    badgeEmoji: '🍦',
    badgeText: 'Combo família',
    title: 'Kit Completo Casquinha',
    subtitle: 'Pote de sorvete 2 Litros + 1 cobertura + 10 casquinhas por {preco}!',
  },
  {
    id: 'pote-de-acai-2-litros',
    productId: 'pote-de-acai-2-litros',
    badgeEmoji: '🍨',
    badgeText: 'Tamanho família',
    title: 'Açaí Pote de 2 Litros',
    subtitle: '2 litros de açaí cremoso pronto para dividir com a galera!',
  },
  {
    id: 'combo-1-litro',
    productId: 'combo-1-litro',
    badgeEmoji: '⚡',
    badgeText: 'Combo perfeito',
    title: 'Combo Sorvete 1L + 10 Casquinhas',
    subtitle: 'Pote de 1 Litro + 10 casquinhas crocantes por apenas {preco}!',
  },
  {
    id: 'pote-de-sorvete-2-litros-especiais',
    productId: 'pote-de-sorvete-2-litros-especiais',
    badgeEmoji: '🍧',
    badgeText: 'Super cremoso',
    title: 'Pote de Sorvete 2 Litros',
    subtitle: 'Sabores especiais como Sensação, Napolitano e Chocolate por {preco}!',
  },
  {
    id: 'acai-oca',
    productId: 'acai-oca',
    badgeEmoji: '👑',
    badgeText: 'Carro-chefe da loja',
    title: 'Açaí Oca — O Mais Pedido',
    subtitle: 'Monte no pote, copo ou isopor a partir de {preco} com adicionais grátis!',
  },
  {
    id: 'acai-batido',
    productId: 'acai-batido',
    badgeEmoji: '🥤',
    badgeText: 'Refrescante',
    title: 'Açaí Batido Cremoso',
    subtitle: 'Com leite condensado, amendoim ou paçoca a partir de {preco}!',
  },
  {
    id: 'picole-gourmet',
    productId: 'picole-gourmet',
    badgeEmoji: '🍫',
    badgeText: 'Dica irresistível',
    title: 'Picolé Gourmet Cremoso',
    subtitle: 'Sabores Nutella, Paçoca, Morango com Chocolate e Iogurte por {preco}!',
  },
  {
    id: 'picole-trufado',
    productId: 'picole-trufado',
    badgeEmoji: '✨',
    badgeText: 'Recheado',
    title: 'Picolé Trufado',
    subtitle: 'Cremosidade e recheio de Mousse de Maracujá, Ninho com Nutella e mais por {preco}!',
  },
  {
    id: 'moreninha',
    productId: 'moreninha',
    badgeEmoji: '🍦',
    badgeText: 'Clássico gelado',
    title: 'Sorvete Moreninha',
    subtitle: 'Casquinha com sorvete banhada na cobertura crocante de chocolate por {preco}!',
  },
  {
    id: 'cremosinho',
    productId: 'cremosinho',
    badgeEmoji: '❄️',
    badgeText: 'Geladinho',
    title: 'Cremosinho (Dindin)',
    subtitle: 'Super cremoso nos sabores Ninho, Chocolate, Morango e Coco por apenas {preco}!',
  },
]

export const BASE_OFFER_RECORDS: readonly OfferRecord[] = SEEDS.map((seed, position) => ({
  ...seed,
  variantId: null,
  promoPriceCents: null,
  position,
  status: 'ativa',
  startsAt: null,
  endsAt: null,
}))

/** A frase do aviso com os preços: `{preco}` e `{preco_antigo}` (vazio quando não há). */
export function offerText(template: string, prices: { price: string; oldPrice: string | null }): string {
  return template.replaceAll('{preco_antigo}', prices.oldPrice ?? '').replaceAll('{preco}', prices.price)
}
