/**
 * Como cada ingrediente aparece na cena 3D: qual modelo do Blender, de que jeito ele é
 * posicionado e quanto espaço ocupa.
 *
 * Os adicionais, as frutas e os cremes ganham um setor do topo (como nos isopores das fotos de
 * referência) e o cobrem com fartura; a quantidade escolhida aumenta o setor.
 */
import { TOPPING_LOOKS } from '../catalog/illustration/looks.ts'

export type Placement =
  /** Montinhos (granola, amendoim...) que cobrem o setor do ingrediente. */
  | 'cluster'
  /** Rodelas e fatias de fruta em fileiras, uma sobre a outra, no setor. */
  | 'slices'
  /** Rosetas de creme no setor. */
  | 'dollop'
  /** Barras e canudinhos espetados no açaí. */
  | 'stuck'
  /** No alto do monte (cereja). */
  | 'top'
  /** Calda: fio sobre tudo, ampliado pelo raio do monte. */
  | 'drizzle'
  /** Pó: mancha ampliada pelo raio do monte, virada para o setor do ingrediente. */
  | 'patch'

export type ModelSpec = {
  /** Arquivo em public/models, sem a extensão. Nas caldas, depende do produto. */
  file: string | { acai: string; shake: string }
  placement: Placement
  /** Cor que substitui a do material, nas camadas que mudam de cor. */
  color?: string
  /** Raio do pedaço visto de cima, em metros. Decide quantos cabem no setor. */
  footprint?: number
  /** Quantas vezes o setor fica coberto (montinhos se sobrepõem um pouco). */
  coverage?: number
  /** Barras, cereja e creme: pedaços para cada unidade escolhida, mínimo e máximo. */
  perUnit?: number
  base?: number
  max?: number
}

const cluster = (file: string, footprint = 0.0095, coverage = 2.1): ModelSpec => ({
  file,
  placement: 'cluster',
  footprint,
  coverage,
})
const syrup = (id: string): ModelSpec => {
  const look = TOPPING_LOOKS[id]
  return {
    file: { acai: 'topping-calda-acai', shake: 'topping-calda-shake' },
    placement: 'drizzle',
    color: look.kind === 'drizzle' ? look.color : undefined,
  }
}
const powder = (id: string): ModelSpec => {
  const look = TOPPING_LOOKS[id]
  return { file: 'topping-po-acai', placement: 'patch', color: look.kind === 'powder' ? look.color : undefined }
}

export const MODEL_SPECS: Readonly<Record<string, ModelSpec>> = {
  'leite-em-po': powder('leite-em-po'),
  'farinha-lactea': powder('farinha-lactea'),
  granola: cluster('topping-granola'),
  biscoito: cluster('topping-biscoito', 0.0095, 1.7),
  pacoca: cluster('topping-pacoca'),
  chocoball: cluster('topping-chocoball', 0.0088, 1.8),
  amendoim: cluster('topping-amendoim'),
  'gotas-de-chocolate': cluster('topping-gotas-de-chocolate', 0.0092, 1.9),
  canudinho: { file: 'topping-canudinho', placement: 'stuck', base: 0, perUnit: 1, max: 3 },
  bis: { file: 'topping-bis', placement: 'stuck', base: 0, perUnit: 1, max: 3 },
  sucrilhos: cluster('topping-sucrilhos', 0.0105, 1.8),
  marshmallow: cluster('topping-marshmallow', 0.0085, 1.7),

  kiwi: { file: 'topping-kiwi', placement: 'slices', footprint: 0.0128 },
  morango: { file: 'topping-morango', placement: 'slices', footprint: 0.0125 },
  banana: { file: 'topping-banana', placement: 'slices', footprint: 0.0125 },

  'calda-leite-condensado': syrup('calda-leite-condensado'),
  'calda-morango': syrup('calda-morango'),
  'calda-chocolate': syrup('calda-chocolate'),
  'calda-banana-caramelizada': syrup('calda-banana-caramelizada'),
  'calda-acai': syrup('calda-acai'),
  'calda-doce-de-leite': syrup('calda-doce-de-leite'),
  'calda-frutas-vermelhas': syrup('calda-frutas-vermelhas'),

  'creme-de-avela': { file: 'topping-creme-de-avela', placement: 'dollop', base: 1, perUnit: 1, max: 5 },
  'creme-de-ninho': { file: 'topping-creme-de-ninho', placement: 'dollop', base: 1, perUnit: 1, max: 5 },
  cereja: { file: 'topping-cereja', placement: 'top', base: 0, perUnit: 1, max: 3 },
  'kit-kat': { file: 'topping-kit-kat', placement: 'stuck', base: 0, perUnit: 1, max: 3 },
}

/** Ingredientes que ocupam um setor do topo. */
export const SECTOR_PLACEMENTS: readonly Placement[] = ['cluster', 'slices', 'dollop', 'patch']

/**
 * Cremes e coberturas grossas que também aparecem como faixa dentro do copo e do pote, vistas
 * pelo plástico (como nas fotos de referência). Em ordem de prioridade: no máximo duas faixas.
 */
export const INNER_BAND_TOPPINGS: readonly string[] = [
  'creme-de-ninho',
  'creme-de-avela',
  'calda-leite-condensado',
  'calda-doce-de-leite',
]

/** Pedaços que não dependem do setor (barras, cereja, creme): pela quantidade escolhida. */
export function pieceCount(spec: ModelSpec, quantity: number): number {
  return Math.min((spec.base ?? 0) + (spec.perUnit ?? 1) * quantity, spec.max ?? Infinity)
}
