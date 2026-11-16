import { describe, expect, it } from 'vitest'
import { fitSize, zoomScroll, zoomedSize } from './lightboxFit.ts'

describe('tamanho da foto ampliada', () => {
  const phone = { width: 390, height: 844 }
  const desktop = { width: 1280, height: 800 }

  it('foto quadrada grande no celular: 92% da largura da tela', () => {
    expect(fitSize({ width: 960, height: 960 }, phone)).toEqual({ width: 359, height: 359 })
  })

  it('foto quadrada grande no computador: 75% da altura da tela', () => {
    expect(fitSize({ width: 960, height: 960 }, desktop)).toEqual({ width: 600, height: 600 })
  })

  it('foto alta (milk-shake) cabe na altura, com a proporção certa', () => {
    expect(fitSize({ width: 627, height: 999 }, desktop)).toEqual({ width: 377, height: 600 })
  })

  it('foto pequena (banana, 201 px) não passa do dobro do tamanho real', () => {
    expect(fitSize({ width: 201, height: 167 }, desktop)).toEqual({ width: 402, height: 334 })
  })

  it('cópia de 480 px de uma foto de 960: vale a largura real', () => {
    expect(fitSize({ width: 480, height: 480 }, desktop, 960)).toEqual({ width: 600, height: 600 })
  })

  it('2x dobra os dois lados', () => {
    expect(zoomedSize({ width: 359, height: 359 })).toEqual({ width: 718, height: 718 })
  })
})

describe('rolagem ao ampliar', () => {
  const zoomed = { width: 718, height: 718 }
  const view = { width: 359, height: 359 }

  it('sem ponto (botão "Ampliar"): o centro da foto', () => {
    expect(zoomScroll(zoomed, view)).toEqual({ left: 180, top: 180 })
  })

  it('toque perto do canto: o canto, sem rolar para fora da foto', () => {
    expect(zoomScroll(zoomed, view, { x: 0, y: 0 })).toEqual({ left: 0, top: 0 })
    expect(zoomScroll(zoomed, view, { x: 1, y: 1 })).toEqual({ left: 359, top: 359 })
  })

  it('toque no meio da direita: rola para a direita', () => {
    expect(zoomScroll(zoomed, view, { x: 0.75, y: 0.5 })).toEqual({ left: 359, top: 180 })
  })
})
