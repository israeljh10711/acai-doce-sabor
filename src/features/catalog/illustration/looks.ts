/**
 * Aparência de cada recipiente, sabor e ingrediente na ilustração 2D.
 *
 * As formas e as cores são aproximações, só para ilustrar. As medidas reais dos
 * recipientes ainda não foram informadas pelo proprietário.
 */
import type { CategorySlug } from '../categories.ts'

export type ContainerShape = {
  kind: 'pote' | 'copo' | 'isopor' | 'shake'
  /** Meia largura na boca. */
  top: number
  /** Meia largura na base. */
  bottom: number
  height: number
}

const AÇAI_SHAPES: Record<string, ContainerShape> = {
  'pote-150': { kind: 'pote', top: 40, bottom: 33, height: 46 },
  'pote-200': { kind: 'pote', top: 44, bottom: 36, height: 52 },
  'pote-250': { kind: 'pote', top: 47, bottom: 38, height: 58 },
  'pote-530': { kind: 'pote', top: 58, bottom: 47, height: 74 },
  'copo-400': { kind: 'copo', top: 43, bottom: 30, height: 112 },
  'copo-500': { kind: 'copo', top: 46, bottom: 32, height: 126 },
  'isopor-p': { kind: 'isopor', top: 50, bottom: 36, height: 58 },
  'isopor-m': { kind: 'isopor', top: 56, bottom: 40, height: 64 },
  'isopor-g': { kind: 'isopor', top: 62, bottom: 44, height: 70 },
  'isopor-gg': { kind: 'isopor', top: 68, bottom: 48, height: 76 },
}

const SHAKE_SHAPES: Record<string, ContainerShape> = {
  '400-ml': { kind: 'shake', top: 38, bottom: 27, height: 124 },
  '500-ml': { kind: 'shake', top: 41, bottom: 29, height: 138 },
}

export function shapeFor(slug: CategorySlug, sizeId: string): ContainerShape | undefined {
  return (slug === 'milk-shake' ? SHAKE_SHAPES : AÇAI_SHAPES)[sizeId]
}

/** Cor do açaí: o corpo, mais escuro, e o topo. */
export const ACAI_COLORS = { body: '#3a0f3f', top: '#4b1552', shine: '#6d2c77' }

/** Cor do milk-shake antes de o sabor ser escolhido. */
export const SHAKE_NEUTRAL = { body: '#eadfce', top: '#f3eadc', shine: '#fffaf1' }

type BaseColors = typeof ACAI_COLORS

/** Cor do milk-shake por sabor. */
export const FLAVOR_COLORS: Record<string, BaseColors> = {
  acai: { body: '#6a2a78', top: '#7b3789', shine: '#9a57a8' },
  toffe: { body: '#c08a52', top: '#cf9c66', shine: '#e3b98a' },
  ninho: { body: '#f0e3bf', top: '#f7edd2', shine: '#fffaea' },
  pitaya: { body: '#d2468f', top: '#de5d9f', shine: '#ee8cbc' },
  maracuja: { body: '#eec24a', top: '#f4cf66', shine: '#fbe299' },
  morango: { body: '#ee8fa3', top: '#f4a3b4', shine: '#fbc6d1' },
  prestigio: { body: '#8a5a3e', top: '#9b6a4c', shine: '#b98a6c' },
  chocolate: { body: '#6a4028', top: '#7b4d33', shine: '#9c6d52' },
  choconute: { body: '#7c4d2c', top: '#8d5c39', shine: '#ad7d5a' },
  'laka-bis': { body: '#ead9b6', top: '#f2e4c8', shine: '#fdf5e1' },
  'iogurte-grego': { body: '#f1ece0', top: '#f8f4ea', shine: '#ffffff' },
  'ninho-trufado': { body: '#e2cda3', top: '#ecdab6', shine: '#f8ecd2' },
  'chocolate-branco': { body: '#efe0c0', top: '#f6ead0', shine: '#fffaea' },
}

export type BitShape = 'round' | 'chip' | 'square' | 'flake' | 'drop' | 'pillow'

/** Como um ingrediente é desenhado. */
export type ToppingLook =
  | { kind: 'drizzle'; color: string }
  | { kind: 'powder'; color: string; speck: string; from: number; to: number }
  | { kind: 'bits'; shape: BitShape; colors: string[]; size: number }
  | { kind: 'slices'; fruit: 'banana' | 'kiwi' | 'morango' }
  | { kind: 'dollop'; color: string; shine: string; at: number }
  | { kind: 'stick' }
  | { kind: 'bar'; color: string; shine: string; width: number; length: number }
  | { kind: 'cherry' }

export const TOPPING_LOOKS: Record<string, ToppingLook> = {
  'leite-em-po': { kind: 'powder', color: '#fbf6e8', speck: '#ece2c8', from: 0.16, to: 0.58 },
  'farinha-lactea': { kind: 'powder', color: '#f0deA6', speck: '#dcc47e', from: 0.44, to: 0.86 },
  granola: { kind: 'bits', shape: 'chip', colors: ['#c99657', '#a9733a', '#dcb47a'], size: 3.6 },
  biscoito: { kind: 'bits', shape: 'square', colors: ['#e3c491', '#d2ae74'], size: 4.6 },
  pacoca: { kind: 'bits', shape: 'square', colors: ['#d8b07a', '#c79b62'], size: 3.6 },
  chocoball: { kind: 'bits', shape: 'round', colors: ['#4a2816', '#5c3421'], size: 3.6 },
  amendoim: { kind: 'bits', shape: 'flake', colors: ['#dcbd8c', '#cfa970'], size: 3.8 },
  'gotas-de-chocolate': { kind: 'bits', shape: 'drop', colors: ['#3a1f12', '#4c2b19'], size: 2.6 },
  sucrilhos: { kind: 'bits', shape: 'flake', colors: ['#eba63c', '#f1bb58', '#dd922a'], size: 4.4 },
  marshmallow: { kind: 'bits', shape: 'pillow', colors: ['#ffffff', '#fbd3e0'], size: 4.6 },
  canudinho: { kind: 'stick' },
  bis: { kind: 'bar', color: '#5b3520', shine: '#7b4b30', width: 8, length: 22 },

  kiwi: { kind: 'slices', fruit: 'kiwi' },
  morango: { kind: 'slices', fruit: 'morango' },
  banana: { kind: 'slices', fruit: 'banana' },

  'calda-leite-condensado': { kind: 'drizzle', color: '#fff6dc' },
  'calda-morango': { kind: 'drizzle', color: '#e0364a' },
  'calda-chocolate': { kind: 'drizzle', color: '#4f2915' },
  'calda-banana-caramelizada': { kind: 'drizzle', color: '#dfa233' },
  'calda-acai': { kind: 'drizzle', color: '#8a3a9a' },
  'calda-doce-de-leite': { kind: 'drizzle', color: '#bb7733' },
  'calda-frutas-vermelhas': { kind: 'drizzle', color: '#a3123b' },

  'creme-de-avela': { kind: 'dollop', color: '#5a3420', shine: '#7a4a30', at: 0.34 },
  'creme-de-ninho': { kind: 'dollop', color: '#f5ead0', shine: '#fffaea', at: 0.66 },
  cereja: { kind: 'cherry' },
  'kit-kat': { kind: 'bar', color: '#6b3a22', shine: '#8a5236', width: 11, length: 30 },
}

/** Ordem em que os tipos de ingrediente são desenhados, de baixo para cima. */
export const LAYER_ORDER: ToppingLook['kind'][] = [
  'dollop',
  'drizzle',
  'powder',
  'bits',
  'slices',
  'bar',
  'stick',
  'cherry',
]
