/**
 * Como cada ingrediente, sabor e recipiente aparece no compositor de fotos.
 *
 * As imagens são recortes e texturas de fotos licenciadas (ver `public/images/CREDITOS.md`),
 * preparados por `scripts/fotos/preparar.mjs`. Este arquivo só diz qual imagem usar e em
 * que escala; quem decide o que aparece é `layout.ts`, a partir das escolhas do cliente.
 */
import type { CategorySlug } from '../catalog/categories.ts'
import type { ContainerKind, Topping } from '../catalog/menu.ts'
import spriteManifest from './sprites.json'

/** Caminho de uma imagem de `public/images`. */
export const image = (path: string) => `${import.meta.env.BASE_URL}images/${path}`

export type SpriteName = keyof typeof spriteManifest
export type Sprite = { src: string; aspect: number }

/** Peças recortadas (fundo transparente), com a proporção largura/altura de cada uma. */
export const SPRITES: Readonly<Record<SpriteName, readonly Sprite[]>> = Object.fromEntries(
  Object.entries(spriteManifest).map(([name, list]) => [
    name,
    list.map((sprite) => ({ src: `${import.meta.env.BASE_URL}${sprite.src.replace(/^\//, '')}`, aspect: sprite.aspect })),
  ]),
) as unknown as Record<SpriteName, readonly Sprite[]>

export type ToppingVisual =
  /** Setor do açaí coberto pela textura do ingrediente. `scale`: tamanho de um ladrilho da textura. */
  | { kind: 'texture'; src: string; scale: number }
  /** Setor com peças soltas (rodelas de banana, chocoball). `size`: peça em fração do diâmetro. */
  | { kind: 'scatter'; sprite: SpriteName; size: number; perTurn: number }
  /** Fio de calda por cima de tudo. */
  | { kind: 'drizzle'; color: string; shade: string }
  /** Porção de creme. */
  | { kind: 'dollop'; src: string }
  /** Peça inteira por cima (cereja, Kit Kat, BIS, canudinho). `size`: maior lado em fração do diâmetro. */
  | { kind: 'piece'; sprite: SpriteName; size: number }

const texture = (name: string, scale: number): ToppingVisual => ({ kind: 'texture', src: image(`toppings/${name}.webp`), scale })
const drizzle = (color: string, shade: string): ToppingVisual => ({ kind: 'drizzle', color, shade })
const dollop = (name: string): ToppingVisual => ({ kind: 'dollop', src: image(`creams/${name}.webp`) })

/** Aparência de cada ingrediente, pelo nome da foto (`look` ou o próprio identificador). */
export const TOPPING_VISUALS: Readonly<Record<string, ToppingVisual>> = {
  'leite-em-po': texture('leite-em-po', 0.42),
  granola: texture('granola', 0.36),
  biscoito: texture('biscoito', 0.42),
  pacoca: texture('pacoca', 0.4),
  chocoball: { kind: 'scatter', sprite: 'chocoball', size: 0.085, perTurn: 46 },
  amendoim: texture('amendoim', 0.32),
  'gotas-de-chocolate': texture('gotas-de-chocolate', 0.34),
  canudinho: { kind: 'piece', sprite: 'canudinho', size: 0.62 },
  bis: { kind: 'piece', sprite: 'bis', size: 0.34 },
  'farinha-lactea': texture('farinha-lactea', 0.42),
  sucrilhos: texture('sucrilhos', 0.48),
  marshmallow: texture('marshmallow', 0.5),

  kiwi: texture('kiwi', 0.62),
  morango: texture('morango', 0.52),
  banana: { kind: 'scatter', sprite: 'banana', size: 0.2, perTurn: 20 },

  'calda-leite-condensado': drizzle('#f6eedb', '#b9a77f'),
  'calda-morango': drizzle('#c81d3c', '#6e0b1e'),
  'calda-chocolate': drizzle('#3d1b0b', '#160602'),
  'calda-banana-caramelizada': drizzle('#cf7a1f', '#7c3f08'),
  'calda-acai': drizzle('#4a0f37', '#1b0312'),
  'calda-doce-de-leite': drizzle('#b26a29', '#5f330b'),
  'calda-frutas-vermelhas': drizzle('#931633', '#4a0613'),

  'creme-de-avela': dollop('creme-de-avela'),
  'creme-de-ninho': dollop('creme-de-ninho'),
  'creme-de-morango': dollop('creme-de-morango'),
  'creme-de-cookies': dollop('creme-de-cookies'),
  cereja: { kind: 'piece', sprite: 'cereja', size: 0.17 },
  'kit-kat': { kind: 'piece', sprite: 'kit-kat', size: 0.4 },
  ovomaltine: texture('ovomaltine', 0.38),
}

/** Nome da foto de um ingrediente. */
export const lookOf = (topping: Pick<Topping, 'id' | 'look'>) => topping.look ?? topping.id

/** Miniatura do ingrediente (foto recortada), para os cartões. */
export const ingredientImage = (topping: Pick<Topping, 'id' | 'look'>) => image(`ingredients/${lookOf(topping)}.webp`)

export type SurfaceKind = 'acai' | 'batido' | 'milkshake'

export const SURFACES: Readonly<Record<SurfaceKind, { src: string; scale: number }>> = {
  acai: { src: image('backgrounds/acai.webp'), scale: 0.62 },
  batido: { src: image('backgrounds/batido.webp'), scale: 0.7 },
  milkshake: { src: image('backgrounds/milkshake.webp'), scale: 0.7 },
}

export const SURFACE_OF: Readonly<Record<CategorySlug, SurfaceKind>> = {
  'acai-oca': 'acai',
  'acai-tradicional': 'acai',
  'acai-batido': 'batido',
  'milk-shake': 'milkshake',
}

/** Cor de cada sabor de milk-shake, aplicada sobre o creme. */
export const SHAKE_COLORS: Readonly<Record<string, string>> = {
  acai: '#7a2a5c',
  toffe: '#c08a50',
  ninho: '#f2e7cf',
  pitaya: '#de4a88',
  maracuja: '#f3c63e',
  morango: '#f4a3b8',
  prestigio: '#8a5c40',
  chocolate: '#6a3c24',
  choconute: '#7f5634',
  'laka-bis': '#eedfc3',
  'iogurte-grego': '#f7f2e9',
  'ninho-trufado': '#dcc39c',
  'chocolate-branco': '#f4e6cb',
}

/** O que cada sabor do batido acrescenta por cima: todos levam leite condensado. */
export const BATIDO_FLAVOR_TOPPINGS: Readonly<Record<string, readonly string[]>> = {
  'leite-condensado': ['calda-leite-condensado'],
  'leite-condensado-amendoim': ['calda-leite-condensado', 'amendoim'],
  'leite-condensado-pacoca': ['calda-leite-condensado', 'pacoca'],
}

/** Recipiente visto de cima. `surface`: diâmetro do açaí em fração do recipiente. */
export const CONTAINERS: Readonly<Record<ContainerKind, { surface: number; label: string }>> = {
  isopor: { surface: 0.79, label: 'tigela de isopor' },
  copo: { surface: 0.94, label: 'copo transparente' },
  pote: { surface: 0.84, label: 'pote' },
}

/** Tamanho do recipiente no palco, pelo tamanho escolhido (maior recipiente, maior na tela). */
export const SIZE_SCALE: Readonly<Record<string, number>> = {
  'pote-150': 0.64,
  'pote-200': 0.68,
  'pote-250': 0.72,
  'pote-530': 0.84,
  'copo-400': 0.76,
  'copo-500': 0.82,
  'isopor-p': 0.8,
  'isopor-m': 0.86,
  'isopor-g': 0.92,
  'isopor-gg': 0.98,
  '300-ml': 0.74,
  '400-ml': 0.78,
  '500-ml': 0.86,
}
