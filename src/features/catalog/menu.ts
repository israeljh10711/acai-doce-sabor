/**
 * Cardápio do Açaí Doce Sabor.
 *
 * Fonte: transcrição do cardápio enviada pelo proprietário e as regras que ele
 * confirmou em 2026-11-11. Nada aqui é inventado: sabores, tamanhos, preços e
 * regras só mudam quando o proprietário mudar o cardápio.
 *
 * Por enquanto os dados ficam fixos neste arquivo. Na Fase 6 passam a vir do
 * banco, no mesmo formato, e o painel administrativo passa a editá-los.
 *
 * Os preços estão em centavos.
 */
import type { CategorySlug } from './categories.ts'

export type ContainerKind = 'pote' | 'copo' | 'isopor'

export type ProductSize = {
  id: string
  /** Como aparece para o cliente. Ex.: "Pote 200 ml". */
  name: string
  container: ContainerKind
  priceCents: number
  /** Quantos adicionais gratuitos este tamanho inclui. */
  freeToppings: number
}

export type ToppingGroupId = 'dry' | 'fruit' | 'syrup' | 'paid'

/**
 * Como um grupo de ingredientes entra no pedido:
 *
 * - `limited`: sem custo, mas cada unidade consome o limite gratuito do tamanho;
 * - `included`: sem custo e sem limite; cada item entra uma vez ou não entra;
 * - `paid`: cobrado por unidade, fora do limite gratuito.
 */
export type ToppingRule = 'limited' | 'included' | 'paid'

export type ToppingGroup = {
  id: ToppingGroupId
  name: string
  rule: ToppingRule
}

export type Topping = {
  id: string
  name: string
  group: ToppingGroupId
  /** Preço por unidade. Zero nos grupos sem custo. */
  priceCents: number
}

export type Flavor = {
  id: string
  name: string
}

export type Product = {
  slug: CategorySlug
  name: string
  sizes: readonly ProductSize[]
  /** Grupos de ingredientes que o produto aceita, na ordem em que aparecem. */
  groups: readonly ToppingGroupId[]
  /** Sabores para escolher. Vazio quando o produto não tem sabores. */
  flavors: readonly Flavor[]
}

/**
 * Limite técnico de unidades de um mesmo adicional pago em um produto.
 * Não é regra do cardápio: só evita quantidades absurdas por engano.
 */
export const MAX_PAID_UNITS = 10

export const TOPPING_GROUPS: Readonly<Record<ToppingGroupId, ToppingGroup>> = {
  dry: { id: 'dry', name: 'Adicionais', rule: 'limited' },
  fruit: { id: 'fruit', name: 'Frutas', rule: 'included' },
  syrup: { id: 'syrup', name: 'Coberturas', rule: 'included' },
  paid: { id: 'paid', name: 'Adicionais pagos', rule: 'paid' },
}

const free = (group: ToppingGroupId, id: string, name: string): Topping => ({
  id,
  name,
  group,
  priceCents: 0,
})

const paid = (id: string, name: string, priceCents: number): Topping => ({
  id,
  name,
  group: 'paid',
  priceCents,
})

/** Todos os ingredientes, na ordem do cardápio. */
export const TOPPINGS: readonly Topping[] = [
  free('dry', 'leite-em-po', 'Leite em pó'),
  free('dry', 'granola', 'Granola'),
  free('dry', 'biscoito', 'Biscoito'),
  free('dry', 'pacoca', 'Paçoca'),
  free('dry', 'chocoball', 'Chocoball'),
  free('dry', 'amendoim', 'Amendoim'),
  free('dry', 'gotas-de-chocolate', 'Gotas de chocolate'),
  free('dry', 'canudinho', 'Canudinho'),
  free('dry', 'bis', 'BIS'),
  free('dry', 'farinha-lactea', 'Farinha láctea'),
  free('dry', 'sucrilhos', 'Sucrilhos'),
  free('dry', 'marshmallow', 'Marshmallow'),

  free('fruit', 'kiwi', 'Kiwi'),
  free('fruit', 'morango', 'Morango'),
  free('fruit', 'banana', 'Banana'),

  free('syrup', 'calda-leite-condensado', 'Leite condensado'),
  free('syrup', 'calda-morango', 'Morango'),
  free('syrup', 'calda-chocolate', 'Chocolate'),
  free('syrup', 'calda-banana-caramelizada', 'Banana caramelizada'),
  free('syrup', 'calda-acai', 'Açaí'),
  free('syrup', 'calda-doce-de-leite', 'Doce de leite'),
  free('syrup', 'calda-frutas-vermelhas', 'Frutas vermelhas'),

  paid('creme-de-avela', 'Creme de avelã', 300),
  paid('creme-de-ninho', 'Creme de ninho', 300),
  paid('cereja', 'Cereja', 300),
  paid('kit-kat', 'Kit Kat', 400),
]

const size = (
  id: string,
  name: string,
  container: ContainerKind,
  priceCents: number,
  freeToppings: number,
): ProductSize => ({ id, name, container, priceCents, freeToppings })

const ACAI_GROUPS: readonly ToppingGroupId[] = ['dry', 'fruit', 'syrup', 'paid']

export const PRODUCTS: Readonly<Record<CategorySlug, Product>> = {
  'acai-oca': {
    slug: 'acai-oca',
    name: 'Açaí Oca',
    groups: ACAI_GROUPS,
    flavors: [],
    sizes: [
      size('pote-200', 'Pote 200 ml', 'pote', 1000, 2),
      size('pote-530', 'Pote 530 ml', 'pote', 2000, 4),
      size('copo-400', 'Copo 400 ml', 'copo', 1700, 3),
      size('copo-500', 'Copo 500 ml', 'copo', 2000, 3),
      size('isopor-p', 'Isopor P', 'isopor', 1600, 4),
      size('isopor-m', 'Isopor M', 'isopor', 2200, 5),
      size('isopor-g', 'Isopor G', 'isopor', 3000, 6),
      size('isopor-gg', 'Isopor GG', 'isopor', 3800, 7),
    ],
  },

  'acai-tradicional': {
    slug: 'acai-tradicional',
    name: 'Açaí Tradicional',
    groups: ACAI_GROUPS,
    flavors: [],
    sizes: [
      size('pote-150', 'Pote 150 ml', 'pote', 600, 2),
      size('pote-200', 'Pote 200 ml', 'pote', 700, 2),
      size('pote-250', 'Pote 250 ml', 'pote', 800, 2),
      size('pote-530', 'Pote 530 ml', 'pote', 1300, 4),
      size('copo-400', 'Copo 400 ml', 'copo', 1000, 3),
      size('copo-500', 'Copo 500 ml', 'copo', 1200, 3),
      size('isopor-p', 'Isopor P', 'isopor', 1100, 4),
      size('isopor-m', 'Isopor M', 'isopor', 1500, 5),
      size('isopor-g', 'Isopor G', 'isopor', 1800, 6),
      size('isopor-gg', 'Isopor GG', 'isopor', 2200, 7),
    ],
  },

  'milk-shake': {
    slug: 'milk-shake',
    name: 'Milk-shake',
    // O cardápio do milk-shake é tamanho e sabor. O proprietário pediu que o cliente
    // também possa incluir coberturas e adicionais pagos. Não leva adicionais nem frutas.
    groups: ['syrup', 'paid'],
    sizes: [
      size('400-ml', '400 ml', 'copo', 1000, 0),
      size('500-ml', '500 ml', 'copo', 1200, 0),
    ],
    flavors: [
      { id: 'acai', name: 'Açaí' },
      { id: 'toffe', name: 'Toffe' },
      { id: 'ninho', name: 'Ninho' },
      { id: 'pitaya', name: 'Pitaya' },
      { id: 'maracuja', name: 'Maracujá' },
      { id: 'morango', name: 'Morango' },
      { id: 'prestigio', name: 'Prestígio' },
      { id: 'chocolate', name: 'Chocolate' },
      { id: 'choconute', name: 'Choconute' },
      { id: 'laka-bis', name: 'Laka Bis' },
      { id: 'iogurte-grego', name: 'Iogurte Grego' },
      { id: 'ninho-trufado', name: 'Ninho Trufado' },
      { id: 'chocolate-branco', name: 'Chocolate Branco' },
    ],
  },
}

const toppingsById = new Map(TOPPINGS.map((topping) => [topping.id, topping]))

export function getTopping(id: string): Topping | undefined {
  return toppingsById.get(id)
}

/** Ingredientes de um grupo que o produto aceita, na ordem do cardápio. */
export function toppingsOf(product: Product, group: ToppingGroupId): Topping[] {
  if (!product.groups.includes(group)) return []
  return TOPPINGS.filter((topping) => topping.group === group)
}
