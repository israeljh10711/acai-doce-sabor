import { describe, expect, it } from 'vitest'
import { getExtraItem } from '../catalog/extras.ts'
import { getTopping } from '../catalog/menu.ts'
import { FEATURED_OFFER_NOTIFICATIONS } from '../offers/offerNotifications.ts'
import { extraLightbox, offerLightbox, productLightbox, toppingLightbox } from './lightboxImages.ts'

const file = (src: string) => src.split('/').slice(-2).join('/')

describe('o que a foto ampliada mostra', () => {
  it('produto principal: a foto enviada pela loja (cópia de 960 px), o nome e o "a partir de" do cardápio', () => {
    const oca = productLightbox('acai-oca')
    expect([oca.id, file(oca.src), oca.title, oca.price, oca.width]).toEqual(['produto:acai-oca', 'produtos/acai-oca-960.webp', 'Açaí Oca', 'A partir de R$ 10,00', 960])
    expect(oca.alt.length).toBeGreaterThan(10)
    // O milk-shake enviado tem 627 px de largura: não passa disso (a cópia de 960 é ampliada).
    expect(productLightbox('milk-shake').width).toBe(627)
  })

  it('Pote 1 L Montado e Barca: a foto da gaveta', () => {
    expect([productLightbox('barca-de-acai').id, file(productLightbox('barca-de-acai').src)]).toEqual(['item:barca-de-acai', 'catalogo/barca-acai-960.webp'])
  })

  it('item das gavetas: foto, nome, preço e descrição do cardápio', () => {
    const sundae = extraLightbox(getExtraItem('sundae')!)
    expect([file(sundae.src), sundae.title, sundae.price, sundae.description]).toEqual([
      'catalogo/sundae-960.webp',
      'Sundae',
      'R$ 7,00',
      'Sorvete cremoso no copo com calda especial',
    ])
    expect(sundae.srcSet).toContain('sundae-480.webp 480w')
  })

  it('ingrediente: a foto inteira (as de banco na cópia grande), "Grátis" ou o preço e o grupo', () => {
    expect(Object.values(toppingLightbox(getTopping('banana')!)).slice(1)).toEqual([
      expect.stringMatching(/ingredientes\/banana\.png$/),
      'Banana',
      'Banana',
      'Grátis',
      'Frutas',
    ])
    const kiwi = toppingLightbox(getTopping('kiwi')!)
    expect(file(kiwi.src)).toBe('ingredientes/kiwi-grande.webp')
    const kitKat = toppingLightbox(getTopping('kit-kat')!)
    expect([kitKat.price, kitKat.description]).toEqual(['+ R$ 4,00', 'Adicionais pagos'])
  })

  it('oferta: o texto da notificação e a foto do item (ou a da loja, no Oca e no Batido)', () => {
    const images = FEATURED_OFFER_NOTIFICATIONS.map((offer) => offerLightbox(offer))
    expect(images.map((image) => image.id)).toEqual([
      'item:pote-de-acai-1-litro',
      'item:barca-de-acai',
      'item:kit-completo-casquinha',
      'item:pote-de-acai-2-litros',
      'item:combo-1-litro',
      'item:pote-de-sorvete-2-litros-especiais',
      'produto:acai-oca',
      'produto:acai-batido',
      'item:picole-gourmet',
      'item:picole-trufado',
      'item:moreninha',
      'item:cremosinho',
    ])
    for (const [index, offer] of FEATURED_OFFER_NOTIFICATIONS.entries()) {
      expect([images[index].title, images[index].price], offer.id).toEqual([offer.title, offer.priceText])
    }
  })
})
