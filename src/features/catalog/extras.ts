/**
 * "Mais opções do cardápio": as 5 gavetas da vitrine, com os itens, preços e sabores enviados
 * pelo responsável em 2026-11-15. Preços em centavos.
 *
 * - Nenhum item tem foto ainda (`image: null`). Enquanto não tiver, o cartão mostra um emblema
 *   com o ícone da gaveta: nada de foto inventada nem imagem quebrada. Quando a loja mandar a
 *   foto real, basta pôr o caminho em `image`.
 * - `keywords` alimentam a busca, com os sinônimos do pedido ("dindin", "refri", "cascão"...).
 * - `action` decide o botão do cartão:
 *   - `direct_confirm`: vai direto para a confirmação;
 *   - `flavor_modal`: abre a escolha de sabor (`choices`);
 *   - `customizer`: abre o personalizador de um produto (`menu.ts`).
 */
import { capitalize, foldText } from '../../utils/text.ts'
import type { ExtraProductSlug } from './menu.ts'

export type DrawerId = 'combos-e-ofertas' | 'barcas-e-potes' | 'picoles-e-sorvetes' | 'bebidas' | 'doces-e-bomboniere'

/** Ícones dos emblemas (desenhos do Lucide, em `components/ui/icons.tsx`). */
export type EmblemIcon = 'gift' | 'iceCreamBowl' | 'iceCreamCone' | 'popsicle' | 'cupSoda' | 'candy'

export type Drawer = {
  id: DrawerId
  title: string
  /** Texto do atalho na barra fixa. */
  shortcut: string
  icon: EmblemIcon
  /** Selo curto do emblema dos itens. */
  seal: string
  /** Palavras que acham todos os itens da gaveta na busca ("bebida", "doce"...). */
  keywords: readonly string[]
  /** A primeira gaveta começa aberta; as outras, fechadas. */
  defaultOpen: boolean
}

export const DRAWERS: readonly Drawer[] = [
  {
    id: 'combos-e-ofertas',
    title: 'Combos e Ofertas',
    shortcut: 'Combos e Ofertas',
    icon: 'gift',
    seal: 'Combo',
    keywords: ['combo', 'combos', 'oferta', 'ofertas', 'promocao'],
    defaultOpen: true,
  },
  {
    id: 'barcas-e-potes',
    title: 'Barcas e Potes Família (1L, 1,5L e 2L)',
    shortcut: 'Barcas e Potes 1L/2L',
    icon: 'iceCreamBowl',
    seal: 'Pote',
    keywords: ['familia', 'potes familia'],
    defaultOpen: false,
  },
  {
    id: 'picoles-e-sorvetes',
    title: 'Picolés e Sorvetes',
    shortcut: 'Picolés e Sorvetes',
    icon: 'popsicle',
    seal: 'Gelado',
    keywords: ['gelado', 'gelados'],
    defaultOpen: false,
  },
  {
    id: 'bebidas',
    title: 'Bebidas',
    shortcut: 'Bebidas',
    icon: 'cupSoda',
    seal: 'Bebida',
    keywords: ['bebida', 'bebidas'],
    defaultOpen: false,
  },
  {
    id: 'doces-e-bomboniere',
    title: 'Doces e Bomboniere',
    shortcut: 'Doces e Bomboniere',
    icon: 'candy',
    seal: 'Doce',
    keywords: ['doce', 'doces', 'bomboniere'],
    defaultOpen: false,
  },
]

/** Uma escolha do item (sabor do sorvete, sabor da cobertura...). Sempre obrigatória. */
export type ChoiceGroup = {
  id: string
  label: string
  options: readonly string[]
  /** Aceita "Outro sabor", escrito pelo cliente. */
  allowOther?: boolean
}

export type ExtraAction =
  | { type: 'direct_confirm' }
  | { type: 'flavor_modal'; choices: readonly ChoiceGroup[] }
  | { type: 'customizer'; product: ExtraProductSlug; label: string }

export type ExtraItem = {
  id: string
  drawer: DrawerId
  name: string
  description: string
  priceCents: number
  /** Preço anterior, mostrado riscado. */
  originalPriceCents?: number
  badge?: string
  keywords: readonly string[]
  /** Caminho da foto real, quando a loja mandar. Até lá, `null` e o cartão mostra o emblema. */
  image: string | null
  /** Ícone e selo do emblema, quando não são os da gaveta. */
  icon?: EmblemIcon
  seal?: string
  action: ExtraAction
}

/* Listas de sabores repetidas no pedido. */
const SORVETE_KIT = ['Napolitano', 'Chocolate', 'Morango', 'Flocos', 'Creme', 'Sensação']
const COBERTURAS_KIT = ['Chocolate', 'Morango', 'Caramelo', 'Leite Condensado', 'Frutas Vermelhas']
const TRADICIONAIS = ['Napolitano', 'Chocolate', 'Morango', 'Flocos', 'Creme']

const direct = { type: 'direct_confirm' } as const
const flavor = (options: readonly string[], allowOther = false): ExtraAction => ({
  type: 'flavor_modal',
  choices: [{ id: 'sabor', label: 'Sabor', options, ...(allowOther ? { allowOther } : {}) }],
})
const kitChoices: ExtraAction = {
  type: 'flavor_modal',
  choices: [
    { id: 'sorvete', label: 'Sabor do sorvete (2 litros)', options: SORVETE_KIT, allowOther: true },
    { id: 'cobertura', label: 'Sabor da cobertura', options: COBERTURAS_KIT },
  ],
}

type Item = Omit<ExtraItem, 'drawer' | 'image'> & { image?: string | null }
const inDrawer = (drawer: DrawerId, items: Item[]): ExtraItem[] =>
  items.map((item) => ({ ...item, drawer, image: item.image ?? null }))

export const EXTRA_ITEMS: readonly ExtraItem[] = [
  ...inDrawer('combos-e-ofertas', [
    {
      id: 'kit-completo-casquinha',
      name: 'Kit Completo Casquinha',
      description: 'Pote de sorvete 2 litros + 1 cobertura + 10 casquinhas',
      priceCents: 4100,
      keywords: ['kit', 'completo', 'casquinha', 'pote', '2 litros', '2l', 'cobertura', 'combo', 'oferta', 'cascao'],
      icon: 'iceCreamCone',
      seal: 'Kit',
      action: kitChoices,
    },
    {
      id: 'kit-completo',
      name: 'Kit Completo',
      description: 'Combo completo acompanhando pote de sorvete 2 litros, cobertura e casquinhas',
      priceCents: 4100,
      keywords: ['kit', 'completo', 'combo', 'sorvete', '2 litros', '2l', 'oferta'],
      icon: 'iceCreamCone',
      seal: 'Kit',
      action: kitChoices,
    },
    {
      id: 'pote-de-acai-1-litro',
      name: 'Pote de Açaí 1 Litro Montado',
      description: 'Pote de 1 Litro de açaí com até 7 adicionais grátis à sua escolha',
      priceCents: 3000,
      originalPriceCents: 3300,
      badge: 'Oferta',
      keywords: ['pote', '1 litro', '1l', 'acai', 'montado', 'oferta', 'promocao'],
      icon: 'iceCreamBowl',
      seal: 'Pote',
      action: { type: 'customizer', product: 'pote-de-acai-1-litro', label: 'Montar pote' },
    },
    {
      id: 'combo-1-litro',
      name: 'Combo 1 Litro',
      description: 'Pote de sorvete 1 litro + 10 casquinhas crocantes',
      priceCents: 2400,
      keywords: ['combo', '1 litro', '1l', 'casquinhas', 'sorvete', 'oferta', 'cascao'],
      icon: 'iceCreamCone',
      action: {
        type: 'flavor_modal',
        choices: [{ id: 'sorvete', label: 'Sabor do sorvete (1 litro)', options: TRADICIONAIS }],
      },
    },
    {
      id: 'combo-de-sorvete',
      name: 'Combo de Sorvete',
      description: 'Combo especial para compartilhar com potes variados + 10 unidades de casquinhas',
      priceCents: 2000,
      keywords: ['combo', 'sorvete', 'casquinhas', 'oferta', 'cascao'],
      icon: 'iceCreamCone',
      action: direct,
    },
  ]),

  ...inDrawer('barcas-e-potes', [
    {
      id: 'barca-de-acai',
      name: 'Barca de Açaí',
      description: 'Barca caprichada de açaí acompanhando 1 cobertura à escolha',
      priceCents: 3000,
      keywords: ['barca', 'acai', 'cobertura'],
      seal: 'Barca',
      action: { type: 'customizer', product: 'barca-de-acai', label: 'Montar barca' },
    },
    {
      id: 'pote-de-acai-2-litros',
      name: 'Pote de Açaí 2 Litros (Açaímix)',
      description: 'Pote família de 2 litros de açaí cremoso pronto',
      priceCents: 3500,
      keywords: ['pote', 'dois litros', '2 litros', '2l', 'acai', 'acaimix'],
      action: direct,
    },
    {
      id: 'acai-de-1-litro',
      name: 'Açaí de 1 Litro (Açaímix)',
      description: 'Pote de 1 litro de açaí cremoso pronto',
      priceCents: 2300,
      keywords: ['acai', '1 litro', '1l', 'pote', 'acaimix'],
      action: direct,
    },
    {
      id: 'pote-de-sorvete-1-5-litro',
      name: 'Pote de Sorvete 1,5 Litro',
      description: 'Pote de sorvete cremoso 1,5 litro em sabores variados',
      priceCents: 3000,
      keywords: ['pote', '1,5 litros', '1.5l', 'sorvete'],
      action: flavor(TRADICIONAIS, true),
    },
    {
      id: 'pote-de-sorvete-2-litros-especiais',
      name: 'Pote de Sorvete 2 Litros (Sabores Especiais)',
      description: 'Pote de sorvete 2 litros — Sensação e sabores especiais',
      priceCents: 2800,
      keywords: ['pote', '2 litros', '2l', 'sorvete', 'sensacao'],
      action: flavor(['Sensação', 'Napolitano', 'Chocolate Trufado', 'Maracujá'], true),
    },
    {
      id: 'pote-de-sorvete-2-litros-tradicional',
      name: 'Pote de Sorvete 2 Litros (Tradicional)',
      description: 'Pote de sorvete 2 litros — sabores tradicionais',
      priceCents: 2600,
      keywords: ['pote', '2 litros', '2l', 'sorvete'],
      action: flavor(TRADICIONAIS),
    },
    {
      id: 'pote-de-sorvete-1-litro-especiais',
      name: 'Pote de Sorvete 1 Litro (Sabores Especiais)',
      description: 'Pote de sorvete 1 litro — sabores especiais',
      priceCents: 1800,
      keywords: ['pote', '1 litro', '1l', 'sorvete', 'qbombon'],
      action: flavor(['Chocolate', 'Sensação', 'Napolitano', 'Flocos', 'Creme']),
    },
    {
      id: 'pote-de-sorvete-1-litro-tradicional',
      name: 'Pote de Sorvete 1 Litro (Tradicional)',
      description: 'Pote de sorvete 1 litro — sabores tradicionais',
      priceCents: 1600,
      keywords: ['pote', '1 litro', '1l', 'sorvete'],
      action: flavor(TRADICIONAIS),
    },
    {
      id: 'acai-com-creme-ninho',
      name: 'Açaí com Creme Ninho (Pronto)',
      description: 'Copo montado com açaí, creme de Ninho e amendoim',
      priceCents: 1200,
      keywords: ['acai', 'creme ninho', 'ninho', 'amendoim', 'pronto'],
      seal: 'Copo',
      action: direct,
    },
    {
      id: 'acai-mix-150-ml',
      name: 'Açaí Mix 150 ml',
      description: 'Potinho individual de açaí 150 ml',
      priceCents: 500,
      keywords: ['acai', 'mix', '150ml', 'potinho'],
      action: direct,
    },
  ]),

  ...inDrawer('picoles-e-sorvetes', [
    {
      id: 'copo-diamante-negro',
      name: 'Copo Diamante Negro',
      description: 'Sorvete sabor Diamante Negro com cobertura e morango',
      priceCents: 1200,
      keywords: ['copo', 'diamante negro', 'sorvete', 'chocolate'],
      icon: 'iceCreamBowl',
      seal: 'Copo',
      action: direct,
    },
    {
      id: 'copao-400-ml',
      name: 'Copão 400 ml',
      description: 'Copão de sorvete 400 ml (Napolitano e sabores)',
      priceCents: 950,
      keywords: ['copao', '400ml', 'sorvete', 'napolitano'],
      icon: 'iceCreamBowl',
      seal: 'Copo',
      action: flavor(['Napolitano', 'Chocolate', 'Morango', 'Flocos']),
    },
    {
      id: 'sundae',
      name: 'Sundae',
      description: 'Sorvete cremoso no copo com calda especial',
      priceCents: 700,
      keywords: ['sundae', 'sorvete', 'calda', 'morango', 'chocolate'],
      icon: 'iceCreamBowl',
      seal: 'Copo',
      action: flavor(['Morango', 'Chocolate', 'Caramelo']),
    },
    {
      id: 'cascao-duo',
      name: 'Cascão DUO',
      description: 'Cascão crocante recheado sabor baunilha com chocolate',
      priceCents: 700,
      keywords: ['cascao', 'duo', 'casquinha', 'baunilha', 'chocolate'],
      icon: 'iceCreamCone',
      seal: 'Cascão',
      action: direct,
    },
    {
      id: 'cobertura-sterbom',
      name: 'Cobertura Sterbom (Frasco)',
      description: 'Frasco de cobertura para sorvete (sabores variados)',
      priceCents: 700,
      keywords: ['cobertura', 'sterbom', 'calda', 'sorvete'],
      seal: 'Calda',
      action: flavor(['Chocolate', 'Morango', 'Caramelo', 'Leite Condensado', 'Uva']),
    },
    {
      id: 'moreninha',
      name: 'Moreninha',
      description: 'Casquinha com sorvete banhada na cobertura crocante de chocolate',
      priceCents: 350,
      keywords: ['moreninha', 'casquinha', 'sorvete', 'chocolate', 'cascao'],
      icon: 'iceCreamCone',
      seal: 'Casquinha',
      action: direct,
    },
    {
      id: 'picole-trufado',
      name: 'Picolé Trufado',
      description: 'Picolé cremoso recheado (Mousse de Maracujá e sabores)',
      priceCents: 300,
      keywords: ['picole', 'trufado', 'mousse', 'maracuja', 'recheado'],
      seal: 'Picolé',
      action: flavor(['Mousse de Maracujá', 'Chocolate', 'Morango', 'Ninho com Nutella']),
    },
    {
      id: 'picole-gourmet',
      name: 'Picolé Gourmet',
      description: 'Picolé artesanal super cremoso',
      priceCents: 300,
      keywords: ['picole', 'gourmet', 'nutella', 'pacoca', 'iogurte'],
      seal: 'Picolé',
      action: flavor(['Nutella', 'Paçoca', 'Morango com Chocolate', 'Iogurte', 'Maracujá']),
    },
    {
      id: 'garrafinha',
      name: 'Garrafinha',
      description: 'Geladinho cremoso na garrafinha',
      priceCents: 300,
      keywords: ['garrafinha', 'geladinho', 'dindin', 'sacole'],
      action: flavor(['Chocolate', 'Morango', 'Blue Ice', 'Coco']),
    },
    {
      id: 'roscao-mel',
      name: 'Roscão Mel',
      description: 'Sorvete no roscão / copinho',
      priceCents: 200,
      keywords: ['roscao', 'mel', 'sorvete'],
      icon: 'iceCreamCone',
      action: direct,
    },
    {
      id: 'picole-comum',
      name: 'Picolé Comum',
      description: 'Picolé refrescante em sabores variados',
      priceCents: 150,
      keywords: ['picole', 'comum', 'fruta'],
      seal: 'Picolé',
      action: flavor(['Coco', 'Chocolate', 'Morango', 'Uva', 'Limão', 'Maracujá']),
    },
    {
      id: 'cremosinho',
      name: 'Cremosinho',
      description: 'Dindin / geladinho cremoso',
      priceCents: 150,
      keywords: ['cremosinho', 'dindin', 'geladinho', 'sacole'],
      action: flavor(['Chocolate', 'Morango', 'Coco', 'Maracujá', 'Ninho']),
    },
  ]),

  ...inDrawer('bebidas', [
    {
      id: 'refrigerante-350-ml',
      name: 'Refrigerante 350 ml',
      description: 'Lata 350 ml bem gelada',
      priceCents: 500,
      keywords: ['refrigerante', 'refri', '350ml', 'lata', 'coca', 'guarana', 'fanta'],
      action: flavor(['Coca-Cola', 'Guaraná Antarctica', 'Fanta Laranja', 'Fanta Uva', 'Sprite']),
    },
    {
      id: 'agua-mineral-500-ml',
      name: 'Água Mineral 500 ml',
      description: 'Garrafa de água mineral sem gás 500 ml',
      priceCents: 200,
      keywords: ['agua', 'mineral', '500ml', 'indaia'],
      seal: 'Água',
      action: direct,
    },
  ]),

  ...inDrawer('doces-e-bomboniere', [
    {
      id: 'quadradinho-de-brownie',
      name: 'Quadradinho de Brownie',
      description: 'Brownie artesanal macio de chocolate',
      priceCents: 599,
      originalPriceCents: 600,
      keywords: ['brownie', 'quadradinho', 'chocolate', 'doce'],
      action: direct,
    },
    {
      id: 'pippos',
      name: "Pippo's",
      description: "Salgadinho Pippo's sabor Churrasco",
      priceCents: 375,
      keywords: ['pippos', "pippo's", 'salgadinho', 'churrasco'],
      seal: 'Salgado',
      action: direct,
    },
    {
      id: 'trufas',
      name: 'Trufas',
      description: 'Trufa artesanal recheada',
      priceCents: 250,
      originalPriceCents: 300,
      keywords: ['trufa', 'trufas', 'chocolate', 'beijinho', 'maracuja', 'coco'],
      action: flavor(['Chocolate 50%', 'Beijinho', 'Maracujá', 'Coco']),
    },
    {
      id: 'trident',
      name: 'Trident',
      description: 'Chiclete Trident sem açúcar',
      priceCents: 250,
      keywords: ['trident', 'chiclete', 'goma', 'menta'],
      seal: 'Chiclete',
      action: flavor(['Menta', 'Hortelã', 'Melancia', 'Tutti-Frutti']),
    },
    {
      id: 'batom-ao-leite',
      name: 'Batom ao Leite',
      description: 'Chocolate Garoto Batom ao Leite',
      priceCents: 200,
      keywords: ['batom', 'chocolate', 'ao leite'],
      action: direct,
    },
    {
      id: 'mentos',
      name: 'Mentos',
      description: 'Bala mastigável Mentos',
      priceCents: 200,
      keywords: ['mentos', 'bala', 'fruit', 'menta'],
      seal: 'Bala',
      action: flavor(['Fruit (Frutas)', 'Mint (Menta)', 'Rainbow']),
    },
    {
      id: 'halls',
      name: 'Halls',
      description: 'Bala refrescante Halls',
      priceCents: 200,
      keywords: ['halls', 'bala', 'menta', 'cereja', 'morango'],
      seal: 'Bala',
      action: flavor(['Extra Forte', 'Menta', 'Cereja', 'Morango', 'Melancia']),
    },
    {
      id: 'pipoca-kigarot-75g',
      name: 'Pipoca Kigarot 75g',
      description: 'Pipoca doce/salgada Kigarot pacote 75g — Sabor Manteiga',
      priceCents: 200,
      keywords: ['pipoca', 'kigarot', '75g', 'manteiga'],
      seal: 'Pipoca',
      action: direct,
    },
    {
      id: 'pipoca-kigarot-45g',
      name: 'Pipoca Kigarot 45g',
      description: 'Pipoca Kigarot pacote 45g — Sabor Manteiga',
      priceCents: 150,
      keywords: ['pipoca', 'kigarot', '45g', 'manteiga'],
      seal: 'Pipoca',
      action: direct,
    },
    {
      id: 'fini-gelatinas',
      name: 'Fini Gelatinas',
      description: 'Pacotinho individual de balas de gelatina Fini',
      priceCents: 150,
      keywords: ['fini', 'gelatina', 'bala', 'doce'],
      seal: 'Bala',
      action: direct,
    },
    {
      id: 'docile-canudinho',
      name: 'Docile Canudinho',
      description: 'Canudinho doce Docile',
      priceCents: 150,
      keywords: ['docile', 'canudinho', 'fini', 'doce'],
      action: direct,
    },
    {
      id: 'jujuba',
      name: 'Jujuba',
      description: 'Pacote de balas de goma / jujuba colorida',
      priceCents: 100,
      keywords: ['jujuba', 'goma', 'bala', 'gomets'],
      seal: 'Bala',
      action: direct,
    },
    {
      id: 'nucita',
      name: 'Nucita',
      description: 'Creme doce Napolitano Nucita',
      priceCents: 50,
      keywords: ['nucita', 'creme', 'napolitano', 'doce'],
      action: direct,
    },
    {
      id: 'chocolate-recheado',
      name: 'Chocolate Recheado',
      description: 'Bombom / chocolate recheado individual',
      priceCents: 50,
      keywords: ['chocolate', 'recheado', 'bombom', 'uva'],
      seal: 'Bombom',
      action: direct,
    },
  ]),
]

const drawersById = new Map(DRAWERS.map((drawer) => [drawer.id, drawer]))
const itemsById = new Map(EXTRA_ITEMS.map((item) => [item.id, item]))

export function drawerById(id: DrawerId): Drawer {
  return drawersById.get(id)!
}

export function getExtraItem(id: string): ExtraItem | undefined {
  return itemsById.get(id)
}

/** Itens de uma gaveta, na ordem do pedido. */
export function itemsOf(drawer: DrawerId): ExtraItem[] {
  return EXTRA_ITEMS.filter((item) => item.drawer === drawer)
}

/** Item da gaveta que abre o personalizador deste produto (Pote 1 L Montado, Barca). */
export function extraForProduct(slug: ExtraProductSlug): ExtraItem {
  return EXTRA_ITEMS.find((item) => item.action.type === 'customizer' && item.action.product === slug)!
}

/** Escolhas obrigatórias do item. Vazio nos itens sem escolha. */
export function choiceGroupsOf(item: ExtraItem): readonly ChoiceGroup[] {
  return item.action.type === 'flavor_modal' ? item.action.choices : []
}

/** Vai para o carrinho direto da gaveta (com ou sem escolha de sabor), sem personalizador. */
export function isOrderableExtra(item: ExtraItem): boolean {
  return item.action.type !== 'customizer'
}

/* "Outro sabor" escrito pelo cliente. */

export const OTHER_MAX_LENGTH = 40

/**
 * Limpa o "outro sabor" escrito pelo cliente: tira caracteres de controle e os símbolos que
 * formatam texto no WhatsApp (* _ ~ `), junta os espaços e corta em 40 caracteres.
 */
export function cleanOtherText(text: string): string {
  return text
    .replace(/[\p{Cc}\p{Cf}*_~`]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, OTHER_MAX_LENGTH)
    .trim()
}

/**
 * Confere as escolhas de um item pelas regras dele: cada grupo precisa de uma opção da lista
 * ou, quando o grupo aceita, de um "outro sabor" escrito. Um "outro sabor" igual a uma opção
 * (ignorando acentos e maiúsculas) vira a própria opção. Devolve `null` quando falta ou sobra
 * algo inválido; chaves que o item não tem são ignoradas.
 */
export function normalizeChoices(item: ExtraItem, raw: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> | null {
  if (!isOrderableExtra(item)) return null
  const choices: Record<string, string> = {}
  for (const group of choiceGroupsOf(item)) {
    const value = raw[group.id]
    if (typeof value !== 'string') return null
    if (group.options.includes(value)) {
      choices[group.id] = value
      continue
    }
    if (!group.allowOther) return null
    const text = cleanOtherText(value)
    if (!text) return null
    choices[group.id] = group.options.find((option) => foldText(option) === foldText(text)) ?? text
  }
  return Object.freeze(choices)
}

/** Valor de uma escolha como o cliente lê: a opção, ou "Morango com ninho (outro sabor)". */
export function choiceValueText(group: ChoiceGroup, value: string): string {
  return group.options.includes(value) ? value : `${capitalize(value)} (outro sabor)`
}

/** Linhas "Sabor: Nutella" de um item com as escolhas feitas, na ordem dos grupos. */
export function choiceRows(item: ExtraItem, choices: Readonly<Record<string, string>>): { label: string; value: string }[] {
  return choiceGroupsOf(item)
    .filter((group) => choices[group.id] !== undefined)
    .map((group) => ({ label: group.label, value: choiceValueText(group, choices[group.id]) }))
}
