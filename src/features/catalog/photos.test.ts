import { describe, expect, it } from 'vitest'
import { PRODUCTS, TOPPINGS, toppingsOf } from './menu.ts'
import { ALL_PRODUCT_PHOTOS, ingredientFile, ingredientPhoto, productPhoto } from './photos.ts'

// Que os arquivos existem em public/images é conferido em tests/assets.test.ts.

describe('fotos dos ingredientes', () => {
  it('todo ingrediente do cardápio tem foto real', () => {
    for (const topping of TOPPINGS) expect(ingredientFile(topping), topping.id).toBeDefined()
  })

  it('usa as fotos enviadas em 2026-11-14 para os itens pedidos', () => {
    const file = (id: string) => ingredientFile(TOPPINGS.find((topping) => topping.id === id)!)
    expect({
      'leite-condensado': file('leite-condensado'),
      'leite-em-po': file('leite-em-po'),
      'farinha-lactea': file('farinha-lactea'),
      marshmallow: file('marshmallow'),
      amendoim: file('amendoim'),
      chocoball: file('chocoball'),
      pacoca: file('pacoca'),
      disquete: file('disquete'),
      banana: file('banana'),
      'creme-de-ninho': file('creme-de-ninho'),
      'creme-de-avela': file('creme-de-avela'),
      'calda-frutas-vermelhas': file('calda-frutas-vermelhas'),
      'calda-doce-de-leite': file('calda-doce-de-leite'),
      'calda-acai': file('calda-acai'),
      'calda-banana-caramelizada': file('calda-banana-caramelizada'),
      'calda-chocolate': file('calda-chocolate'),
      'calda-morango': file('calda-morango'),
    }).toEqual({
      'leite-condensado': 'leite-condensado.png',
      'leite-em-po': 'leite-em-po.png',
      'farinha-lactea': 'farinha-lactea.png',
      marshmallow: 'marshmallow.png',
      amendoim: 'amendoim.png',
      chocoball: 'chocoball.png',
      pacoca: 'pacoca.png',
      disquete: 'disquete-confete.png',
      banana: 'banana.png',
      'creme-de-ninho': 'creme-ninho.png',
      'creme-de-avela': 'creme-avela.png',
      'calda-frutas-vermelhas': 'cobertura-frutas-vermelhas.png',
      'calda-doce-de-leite': 'cobertura-doce-de-leite.png',
      'calda-acai': 'cobertura-acai.png',
      'calda-banana-caramelizada': 'cobertura-banana-caramelada.png',
      'calda-chocolate': 'cobertura-chocolate.png',
      'calda-morango': 'cobertura-morango.png',
    })
  })

  it('embalagens aparecem inteiras; texturas preenchem o quadro', () => {
    const fit = (id: string) => ingredientPhoto(TOPPINGS.find((topping) => topping.id === id)!)?.fit
    for (const id of ['leite-condensado', 'leite-em-po', 'farinha-lactea', 'calda-morango', 'calda-chocolate', 'calda-acai']) {
      expect(fit(id), id).toBe('contain')
    }
    for (const id of ['banana', 'marshmallow', 'amendoim', 'chocoball', 'pacoca', 'disquete', 'creme-de-ninho', 'creme-de-avela']) {
      expect(fit(id), id).toBe('cover')
    }
  })

  it('os cremes do batido e a cobertura de leite condensado do milk-shake usam as mesmas fotos', () => {
    const file = (slug: keyof typeof PRODUCTS, group: 'batido' | 'syrup', name: string) =>
      ingredientFile(toppingsOf(PRODUCTS[slug], group).find((topping) => topping.name === name)!)
    expect(file('acai-batido', 'batido', 'Creme de ninho')).toBe('creme-ninho.png')
    expect(file('acai-batido', 'batido', 'Creme de avelã')).toBe('creme-avela.png')
    expect(file('milk-shake', 'syrup', 'Leite condensado')).toBe('leite-condensado.png')
  })
})

describe('foto fixa de cada produto', () => {
  it('cada produto tem a sua, com descrição para leitores de tela', () => {
    for (const photo of ALL_PRODUCT_PHOTOS) expect(photo.alt.length, photo.name).toBeGreaterThan(15)
  })

  it('não muda com os ingredientes; só o isopor tem foto própria', () => {
    expect(productPhoto('acai-tradicional').name).toBe('acai-tradicional')
    expect(productPhoto('acai-tradicional', 'copo').name).toBe('acai-tradicional')
    expect(productPhoto('acai-tradicional', 'isopor').name).toBe('acai-isopor')
    expect(productPhoto('acai-oca', 'isopor').name).toBe('acai-isopor')
    expect(new Set(Object.keys(PRODUCTS).map((slug) => productPhoto(slug as keyof typeof PRODUCTS).name)).size).toBe(4)
  })
})
