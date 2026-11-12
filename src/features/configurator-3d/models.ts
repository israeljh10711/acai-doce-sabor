/**
 * Como cada ingrediente aparece na cena 3D: qual modelo do Blender, de que jeito ele é
 * posicionado e quantos pedaços aparecem por unidade escolhida.
 */
import { TOPPING_LOOKS } from '../catalog/illustration/looks.ts'

export type Placement =
  /** Pedaços espalhados pelo monte (granola, paçoca...). */
  | 'scatter'
  /** Rodelas e metades de fruta, deitadas sobre o monte. */
  | 'slices'
  /** Porções de creme, perto do topo. */
  | 'dollop'
  /** Barras e canudinhos espetados no açaí. */
  | 'stuck'
  /** No alto do monte (cereja). */
  | 'top'
  /** Camada modelada sobre o monte padrão (calda, pó). */
  | 'layer'

export type ModelSpec = {
  /** Arquivo em public/models, sem a extensão. Nas caldas, depende do produto. */
  file: string | { acai: string; shake: string }
  placement: Placement
  /** Cor que substitui a do material, nas camadas que mudam de cor. */
  color?: string
  /** Quantos pedaços para cada unidade escolhida, e o máximo. */
  perUnit?: number
  base?: number
  max?: number
}

const scatter = (file: string): ModelSpec => ({ file, placement: 'scatter', base: 4, perUnit: 3, max: 12 })
const syrup = (id: string): ModelSpec => {
  const look = TOPPING_LOOKS[id]
  return {
    file: { acai: 'topping-calda-acai', shake: 'topping-calda-shake' },
    placement: 'layer',
    color: look.kind === 'drizzle' ? look.color : undefined,
  }
}
const powder = (id: string): ModelSpec => {
  const look = TOPPING_LOOKS[id]
  return { file: 'topping-po-acai', placement: 'layer', color: look.kind === 'powder' ? look.color : undefined }
}

export const MODEL_SPECS: Readonly<Record<string, ModelSpec>> = {
  'leite-em-po': powder('leite-em-po'),
  'farinha-lactea': powder('farinha-lactea'),
  granola: scatter('topping-granola'),
  biscoito: { ...scatter('topping-biscoito'), base: 3, perUnit: 2, max: 8 },
  pacoca: scatter('topping-pacoca'),
  chocoball: scatter('topping-chocoball'),
  amendoim: scatter('topping-amendoim'),
  'gotas-de-chocolate': { ...scatter('topping-gotas-de-chocolate'), base: 6, perUnit: 4, max: 16 },
  canudinho: { file: 'topping-canudinho', placement: 'stuck', base: 0, perUnit: 1, max: 3 },
  bis: { file: 'topping-bis', placement: 'stuck', base: 0, perUnit: 1, max: 3 },
  sucrilhos: { ...scatter('topping-sucrilhos'), base: 3, perUnit: 3, max: 10 },
  marshmallow: { ...scatter('topping-marshmallow'), base: 3, perUnit: 2, max: 9 },

  kiwi: { file: 'topping-kiwi', placement: 'slices', base: 3, perUnit: 0, max: 3 },
  morango: { file: 'topping-morango', placement: 'slices', base: 3, perUnit: 0, max: 3 },
  banana: { file: 'topping-banana', placement: 'slices', base: 3, perUnit: 0, max: 3 },

  'calda-leite-condensado': syrup('calda-leite-condensado'),
  'calda-morango': syrup('calda-morango'),
  'calda-chocolate': syrup('calda-chocolate'),
  'calda-banana-caramelizada': syrup('calda-banana-caramelizada'),
  'calda-acai': syrup('calda-acai'),
  'calda-doce-de-leite': syrup('calda-doce-de-leite'),
  'calda-frutas-vermelhas': syrup('calda-frutas-vermelhas'),

  'creme-de-avela': { file: 'topping-creme-de-avela', placement: 'dollop', base: 0, perUnit: 1, max: 3 },
  'creme-de-ninho': { file: 'topping-creme-de-ninho', placement: 'dollop', base: 0, perUnit: 1, max: 3 },
  cereja: { file: 'topping-cereja', placement: 'top', base: 0, perUnit: 1, max: 3 },
  'kit-kat': { file: 'topping-kit-kat', placement: 'stuck', base: 0, perUnit: 1, max: 3 },
}

/** Quantos pedaços desenhar para a quantidade escolhida. */
export function pieceCount(spec: ModelSpec, quantity: number): number {
  if (spec.placement === 'layer') return 1
  return Math.min((spec.base ?? 0) + (spec.perUnit ?? 1) * quantity, spec.max ?? Infinity)
}
