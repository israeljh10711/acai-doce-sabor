import { describe, expect, it } from 'vitest'
import { EXTRA_ITEMS, choiceGroupsOf, getExtraItem } from '../catalog/extras.ts'
import { formatBRL } from '../../utils/money.ts'
import { NEVER_IN_OFFERS, featuredOffers, getOffer } from './offerNotifications.ts'

/** As 12 ofertas do pedido de 2026-11-15, na ordem: [id, selo, título, subtítulo, preço, preço antigo, ação]. */
const PEDIDO = [
  ['pote-de-acai-1-litro', 'Oferta mais pedida', 'Pote de Açaí 1 Litro Montado', 'Escolha até 7 adicionais grátis por apenas R$ 30,00 (de R$ 33,00)!', 'R$ 30,00', 'R$ 33,00', 'customizer_1l'],
  ['barca-de-acai', 'Especial da casa', 'Barca de Açaí Completa', 'Barca super recheada + 1 cobertura à sua escolha por R$ 30,00!', 'R$ 30,00', null, 'customizer_barca'],
  ['kit-completo-casquinha', 'Combo família', 'Kit Completo Casquinha', 'Pote de sorvete 2 Litros + 1 cobertura + 10 casquinhas por R$ 41,00!', 'R$ 41,00', null, 'flavor_modal'],
  ['pote-de-acai-2-litros', 'Tamanho família', 'Açaí Pote de 2 Litros', '2 litros de açaí cremoso pronto para dividir com a galera!', 'R$ 35,00', null, 'direct_confirm'],
  ['combo-1-litro', 'Combo perfeito', 'Combo Sorvete 1L + 10 Casquinhas', 'Pote de 1 Litro + 10 casquinhas crocantes por apenas R$ 23,99!', 'R$ 23,99', null, 'flavor_modal'],
  ['pote-de-sorvete-2-litros-especiais', 'Super cremoso', 'Pote de Sorvete 2 Litros', 'Sabores especiais como Sensação, Napolitano e Chocolate por R$ 28,00!', 'R$ 28,00', null, 'flavor_modal'],
  ['acai-oca', 'Carro-chefe da loja', 'Açaí Oca — O Mais Pedido', 'Monte no pote, copo ou isopor a partir de R$ 10,00 com adicionais grátis!', 'A partir de R$ 10,00', null, 'open_oca'],
  ['acai-batido', 'Refrescante', 'Açaí Batido Cremoso', 'Com leite condensado, amendoim ou paçoca a partir de R$ 10,00!', 'A partir de R$ 10,00', null, 'open_batido'],
  ['picole-gourmet', 'Dica irresistível', 'Picolé Gourmet Cremoso', 'Sabores Nutella, Paçoca, Morango com Chocolate e Iogurte por R$ 3,00!', 'R$ 3,00', null, 'flavor_modal'],
  ['picole-trufado', 'Recheado', 'Picolé Trufado', 'Cremosidade e recheio de Mousse de Maracujá, Ninho com Nutella e mais por R$ 3,00!', 'R$ 3,00', null, 'flavor_modal'],
  ['moreninha', 'Clássico gelado', 'Sorvete Moreninha', 'Casquinha com sorvete banhada na cobertura crocante de chocolate por R$ 3,50!', 'R$ 3,50', null, 'direct_confirm'],
  ['cremosinho', 'Geladinho', 'Cremosinho (Dindin)', 'Super cremoso nos sabores Ninho, Chocolate, Morango e Coco por apenas R$ 1,50!', 'R$ 1,50', null, 'flavor_modal'],
] as const

describe('ofertas das notificações flutuantes', () => {
  it('são exatamente as 12 do pedido, na ordem, com selo, título, subtítulo, preço e ação', () => {
    expect(
      featuredOffers().map((offer) => [
        offer.id,
        offer.badge.text,
        offer.title,
        offer.subtitle,
        offer.priceText,
        offer.oldPriceText,
        offer.actionType,
      ]),
    ).toEqual(PEDIDO)
  })

  it('cada selo tem o emoji do pedido, só de enfeite', () => {
    expect(featuredOffers().map((offer) => offer.badge.emoji)).toEqual(['🔥', '⭐', '🍦', '🍨', '⚡', '🍧', '👑', '🥤', '🍫', '✨', '🍦', '❄️'])
  })

  it('nenhum item proibido (bomboniere de baixo valor e água) entra', () => {
    const ids = featuredOffers().flatMap((offer) => (offer.item ? [offer.item.id] : []))
    for (const id of NEVER_IN_OFFERS) expect(ids, id).not.toContain(id)
    for (const name of ['Fini Gelatinas', 'Pipoca Kigarot 45g', 'Pipoca Kigarot 75g', 'Halls', 'Trident', 'Jujuba', 'Água Mineral 500 ml']) {
      expect(featuredOffers().some((offer) => offer.item?.name === name || offer.title.includes(name)), name).toBe(false)
    }
    // A lista proibida aponta para itens que existem no cardápio (nenhum nome errado).
    for (const id of NEVER_IN_OFFERS) expect(getExtraItem(id), id).toBeDefined()
    expect(featuredOffers().some((offer) => offer.item?.drawer === 'doces-e-bomboniere' || offer.item?.drawer === 'bebidas')).toBe(false)
  })

  it('os preços vêm do catálogo: mudar o cardápio muda a notificação', () => {
    for (const offer of featuredOffers()) {
      if (!offer.item) continue
      expect(offer.priceText, offer.id).toBe(formatBRL(offer.item.priceCents))
      expect(offer.oldPriceText, offer.id).toBe(offer.item.originalPriceCents ? formatBRL(offer.item.originalPriceCents) : null)
      expect(offer.subtitle.includes(offer.priceText) || offer.id === 'pote-de-acai-2-litros', offer.id).toBe(true)
    }
  })

  it('a ação de cada oferta bate com o tipo do item no cardápio', () => {
    for (const offer of featuredOffers()) {
      if (offer.actionType === 'open_oca') expect(offer.slug).toBe('acai-oca')
      else if (offer.actionType === 'open_batido') expect(offer.slug).toBe('acai-batido')
      else if (offer.actionType === 'customizer_1l') expect(offer.item?.action).toMatchObject({ type: 'customizer', product: 'pote-de-acai-1-litro' })
      else if (offer.actionType === 'customizer_barca') expect(offer.item?.action).toMatchObject({ type: 'customizer', product: 'barca-de-acai' })
      else expect(offer.item?.action.type, offer.id).toBe(offer.actionType)
    }
  })

  it('os sabores citados nos textos existem no item', () => {
    const cited: Record<string, string[]> = {
      'pote-de-sorvete-2-litros-especiais': ['Sensação', 'Napolitano', 'Chocolate'],
      'picole-gourmet': ['Nutella', 'Paçoca', 'Morango com Chocolate', 'Iogurte'],
      'picole-trufado': ['Mousse de Maracujá', 'Ninho com Nutella'],
      cremosinho: ['Ninho', 'Chocolate', 'Morango', 'Coco'],
    }
    for (const [id, flavors] of Object.entries(cited)) {
      const options = choiceGroupsOf(getExtraItem(id)!).flatMap((group) => group.options)
      for (const flavor of flavors) expect(options, `${id}: ${flavor}`).toContain(flavor)
    }
  })

  it('cada oferta mostra a foto do cardápio em miniatura (a dos produtos principais, inteira)', () => {
    expect(featuredOffers().map((offer) => [offer.id, offer.photo.src.split('/').pop(), offer.photo.fit])).toEqual([
      ['pote-de-acai-1-litro', 'pote-1-litro-acai-montado-480.webp', 'cover'],
      ['barca-de-acai', 'barca-de-acai-480.webp', 'cover'],
      ['kit-completo-casquinha', 'kit-completo-casquinha-duo-480.webp', 'cover'],
      ['pote-de-acai-2-litros', 'pote-acai-2-litros-480.webp', 'cover'],
      ['combo-1-litro', 'combo-1-litro-480.webp', 'cover'],
      ['pote-de-sorvete-2-litros-especiais', 'pote-2l-sensacao-480.webp', 'cover'],
      ['acai-oca', 'acai-oca-480.webp', 'contain'],
      ['acai-batido', 'acai-batido-480.webp', 'contain'],
      ['picole-gourmet', 'picole-gourmet-480.webp', 'cover'],
      ['picole-trufado', 'picole-trufado-480.webp', 'cover'],
      ['moreninha', 'moreninha-480.webp', 'cover'],
      ['cremosinho', 'cremosinho-480.webp', 'cover'],
    ])
    // Que os arquivos existem em public/images é conferido em tests/assets.test.ts.
  })

  it('acha a oferta pelo identificador', () => {
    expect(getOffer('moreninha')?.title).toBe('Sorvete Moreninha')
    expect(getOffer('halls')).toBeUndefined()
    expect(getOffer(null)).toBeUndefined()
    expect(EXTRA_ITEMS.length).toBeGreaterThan(featuredOffers().length)
  })
})
