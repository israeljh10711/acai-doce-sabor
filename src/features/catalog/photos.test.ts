import { describe, expect, it } from 'vitest'
import { PRODUCTS, TOPPINGS, toppingsOf } from './menu.ts'
import { ALL_PRODUCT_PHOTOS, ingredientFile, ingredientPhoto, productPhoto, productPhotoSrc } from './photos.ts'

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

  it('creme de cookies, Ovomaltine e creme de morango do batido usam as fotos enviadas, preenchendo o quadro', () => {
    const photo = (name: string) => ingredientPhoto(toppingsOf(PRODUCTS['acai-batido'], 'batido').find((topping) => topping.name === name)!)
    expect([photo('Creme de cookies'), photo('Ovomaltine'), photo('Creme de morango')].map((p) => [p?.src.split('/').pop(), p?.fit])).toEqual([
      ['creme-cookies.png', 'cover'],
      ['ovomaltine.png', 'cover'],
      ['creme-morango.png', 'cover'],
    ])
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
  it('cada produto usa a foto enviada pela loja', () => {
    const names = Object.fromEntries(
      Object.keys(PRODUCTS).map((slug) => [slug, productPhoto(slug as keyof typeof PRODUCTS).name]),
    )
    expect(names).toEqual({
      'acai-oca': 'acai-oca',
      'acai-tradicional': 'acai-tradicional',
      'acai-batido': 'acai-batido',
      'milk-shake': 'milkshake',
    })
  })

  it('tem descrição para leitores de tela e o tamanho da foto', () => {
    for (const photo of ALL_PRODUCT_PHOTOS) {
      expect(photo.alt.length, photo.name).toBeGreaterThan(15)
      expect(photo.width * photo.height, photo.name).toBeGreaterThan(0)
    }
  })

  it('aponta para o PNG enviado e para as cópias leves', () => {
    expect(productPhotoSrc('milkshake')).toMatch(/\/images\/produtos\/milkshake\.png$/)
    expect(productPhotoSrc('acai-oca', 480)).toMatch(/\/images\/produtos\/acai-oca-480\.webp$/)
    expect(productPhotoSrc('acai-oca', 960)).toMatch(/\/images\/produtos\/acai-oca-960\.webp$/)
  })
})
