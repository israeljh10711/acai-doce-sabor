/**
 * "Mais opções do cardápio": as 5 gavetas da vitrine, com os itens, preços e sabores enviados
 * pelo responsável em 2026-11-15 e, nas gavetas 1 e 2, atualizados pelo catálogo do WhatsApp da
 * loja (pedido de 2026-11-16). Preços em centavos.
 *
 * - Cada item tem uma foto (`image`, em `public/images/catalogo/`). Desde 2026-11-16 são fotos da
 *   loja, recortadas das capturas do catálogo do WhatsApp (`scripts/fotos/whatsapp.json` e
 *   `importar-whatsapp.mjs`); só uma continua de banco (`scripts/fotos/catalogo.json`). Alguns
 *   sabores têm a foto do pote daquele sabor (`photos` na escolha). Créditos em /creditos.
 * - Uma escolha pode mudar o preço (`prices`: o tamanho do Açaí do Oca).
 * - `keywords` alimentam a busca, com os sinônimos do pedido ("dindin", "refri", "cascão"...).
 * - `action` decide o botão do cartão:
 *   - `direct_confirm`: vai direto para a confirmação;
 *   - `flavor_modal`: abre a escolha de sabor (`choices`);
 *   - `customizer`: abre o personalizador de um produto (`menu.ts`).
 */
import { capitalize, foldText } from '../../utils/text.ts'
import type { ExtraProductSlug } from './menu.ts'

export type DrawerId = 'combos-e-ofertas' | 'barcas-e-potes' | 'picoles-e-sorvetes' | 'bebidas' | 'doces-e-bomboniere'

/**
 * Ícones das seções do cardápio (desenhos do Lucide, em `components/ui/icons.tsx`): os 4 produtos
 * principais e as 5 seções do catálogo.
 */
export type EmblemIcon =
  | 'crown'
  | 'iceCreamBowl'
  | 'cupSoda'
  | 'iceCreamCone'
  | 'gift'
  | 'sailboat'
  | 'popsicle'
  | 'glassWater'
  | 'candy'

/** Seção do catálogo (até 2026-11-16, uma gaveta de "Mais opções do cardápio"). */
export type Drawer = {
  id: DrawerId
  /** Título da seção. */
  title: string
  /** Nome na barra lateral e no menu do celular. */
  navLabel: string
  /** Nome curto, nos botões da barra do celular. */
  pillLabel: string
  /** Frase abaixo do título: o que a seção tem (só fatos do cardápio). */
  subtitle: string
  /** Âncora da seção no cardápio (`#secao-combos`...). */
  anchor: string
  icon: EmblemIcon
  /** Palavras que acham todos os itens da seção na busca ("bebida", "doce"...). */
  keywords: readonly string[]
}

/** As seções como estão no código (a base das mudanças do vendedor). */
export const BASE_DRAWERS: readonly Drawer[] = [
  {
    id: 'combos-e-ofertas',
    title: 'Combos e Ofertas',
    navLabel: 'Combos e Ofertas',
    pillLabel: 'Combos',
    subtitle: 'Kits com casquinhas, combos de sorvete e o pote de 1 litro montado.',
    anchor: 'secao-combos',
    icon: 'gift',
    keywords: ['combo', 'combos', 'oferta', 'ofertas', 'promocao'],
  },
  {
    id: 'barcas-e-potes',
    title: 'Barcas e Potes Família (1L, 1,5L e 2L)',
    navLabel: 'Barcas e Potes Família',
    pillLabel: 'Barcas e Potes',
    subtitle: 'Barca, potes de açaí e potes de sorvete de 1, 1,5 e 2 litros.',
    anchor: 'secao-barcas-potes',
    icon: 'sailboat',
    keywords: ['familia', 'potes familia'],
  },
  {
    id: 'picoles-e-sorvetes',
    title: 'Picolés e Sorvetes',
    navLabel: 'Picolés e Sorvetes',
    pillLabel: 'Picolés e Sorvetes',
    subtitle: 'Picolés, copos de sorvete, sundae, cascão, cremosinho e coberturas.',
    anchor: 'secao-picoles-sorvetes',
    icon: 'popsicle',
    keywords: ['gelado', 'gelados'],
  },
  {
    id: 'bebidas',
    title: 'Bebidas',
    navLabel: 'Bebidas',
    pillLabel: 'Bebidas',
    subtitle: 'Refrigerante em lata e água mineral.',
    anchor: 'secao-bebidas',
    icon: 'glassWater',
    keywords: ['bebida', 'bebidas'],
  },
  {
    id: 'doces-e-bomboniere',
    title: 'Doces e Bomboniere',
    navLabel: 'Doces e Bomboniere',
    pillLabel: 'Doces',
    subtitle: 'Brownie, trufas, balas, chicletes, pipocas, salgadinho e chocolates.',
    anchor: 'secao-doces-bomboniere',
    icon: 'candy',
    keywords: ['doce', 'doces', 'bomboniere'],
  },
]

/** Uma escolha do item (sabor do sorvete, sabor da cobertura, tamanho...). Sempre obrigatória. */
export type ChoiceGroup = {
  id: string
  label: string
  options: readonly string[]
  /** Aceita "Outro sabor", escrito pelo cliente. */
  allowOther?: boolean
  /**
   * Preço do item com cada opção, quando a opção muda o preço (o tamanho do Açaí do Oca). O
   * preço do item (`priceCents`) é então o menor deles, o "a partir de" do cartão.
   */
  prices?: Readonly<Record<string, number>>
  /** Foto de cada opção (o pote de cada sabor), quando a loja mandou; as outras usam a do item. */
  photos?: Readonly<Record<string, string>>
  /** Começo do texto alternativo das fotos das opções: "<photoAlt>, sabor <opção>". */
  photoAlt?: string
  /** Opções esgotadas pelo vendedor (pedido de 2026-11-17): aparecem desligadas. */
  unavailable?: readonly string[]
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
  /** Preço do item; com opções de preço diferente, o menor deles. */
  priceCents: number
  /** Preço anterior, mostrado riscado. */
  originalPriceCents?: number
  badge?: string
  keywords: readonly string[]
  /**
   * Foto do item, a partir de `public/` (`images/catalogo/<nome>.jpg` ou `.png`). O site mostra as
   * cópias leves `<nome>-480.webp` e `<nome>-960.webp`; o tamanho de cada uma está em
   * `catalogPhotos.json`. Desde 2026-11-16, quase todas são fotos da loja (catálogo do WhatsApp).
   */
  image: string
  /** O que a foto mostra (para leitores de tela, quando a foto é o assunto principal). */
  imageAlt: string
  action: ExtraAction
  /** `false` quando o vendedor marcou como esgotado: aparece, mas não dá para pedir. */
  available?: boolean
}

/*
 * Listas de sabores do catálogo da loja no WhatsApp (pedido de 2026-11-16). "Iogurte grego"
 * está escrito como na embalagem (o catálogo diz "Iorgute grego").
 */
const POTE_2L_QBOMBOM = [
  'Sensação',
  'Chocolate',
  'Napolitano',
  'Unicórnio',
  'Pavê',
  'Toffee',
  'Crocante',
  'Brownie',
  'Creme com passas',
  'Nata com goiabada',
  'Sonho de valsa',
  'Trio (Chocolate, flocos e creme)',
]
const POTE_1_5L_QBOMBOM = ['Mousse de maracujá', 'Leitinho trufado', 'Iogurte grego', 'Qmaltine', 'Cookies cream', 'Qgresco']
const POTE_1L_QBOMBOM = ['Qbrounie', 'Brigadeiro', 'Flocos', 'Napolitano']
const STER_BOM_DUETO = ['Azul com Creme', 'Nata Uva', 'Abacaxi com Coco', 'Nata com Morango', 'Nata com Chocolate', 'Morango com Chocolate']
const COBERTURAS_STERBOM = ['Uva', 'Morango', 'Chocolate', 'Caramelo', 'Leite condensado']
const TRADICIONAIS = ['Napolitano', 'Chocolate', 'Morango', 'Flocos', 'Creme']

const direct = { type: 'direct_confirm' } as const
const flavor = (options: readonly string[], allowOther = false): ExtraAction => ({
  type: 'flavor_modal',
  choices: [{ id: 'sabor', label: 'Sabor', options, ...(allowOther ? { allowOther } : {}) }],
})
/** Escolha de sabor com a foto do pote de cada sabor (`fotos`: sabor → arquivo em images/catalogo). */
const flavorWithPhotos = (
  options: readonly string[],
  fotos: Readonly<Record<string, string>>,
  photoAlt: string,
  allowOther = false,
): ExtraAction => ({
  type: 'flavor_modal',
  choices: [
    {
      id: 'sabor',
      label: 'Sabor',
      options,
      photos: Object.fromEntries(Object.entries(fotos).map(([option, file]) => [option, `images/catalogo/${file}`])),
      photoAlt,
      ...(allowOther ? { allowOther } : {}),
    },
  ],
})
const kitChoices: ExtraAction = {
  type: 'flavor_modal',
  choices: [
    { id: 'sorvete', label: 'Sabor do sorvete (2 litros)', options: POTE_2L_QBOMBOM, allowOther: true },
    { id: 'cobertura', label: 'Sabor da cobertura', options: COBERTURAS_STERBOM },
  ],
}

const inDrawer = (drawer: DrawerId, items: Omit<ExtraItem, 'drawer'>[]): ExtraItem[] =>
  items.map((item) => ({ ...item, drawer }))

/** O cardápio das seções como está no código (a base das mudanças do vendedor). */
export const BASE_EXTRA_ITEMS: readonly ExtraItem[] = [
  // Gavetas "Combos e Ofertas" e "Barcas e Potes": nomes, preços, sabores e fotos do pedido de
  // 2026-11-16 (catálogo do WhatsApp da loja).
  ...inDrawer('combos-e-ofertas', [
    {
      id: 'kit-completo-casquinha',
      name: 'Kit Completo Casquinha DUO',
      description: 'Pote 2 litros + cobertura 300g da sua preferência e 10 und de casquinha DUO.',
      image: 'images/catalogo/kit-completo-casquinha-duo.jpg',
      imageAlt: 'Kit com pacote de casquinhas DUO, frasco de cobertura e pote de sorvete Qbombom Trio de 2 litros',
      priceCents: 4100,
      keywords: ['kit', 'completo', 'casquinha', 'duo', 'pote', '2 litros', '2l', 'cobertura', 'combo', 'oferta', 'cascao'],
      action: kitChoices,
    },
    {
      id: 'kit-completo',
      name: 'Kit Completo',
      description:
        '1 Pote de sorvete 2 litros da sua preferência + 1 cobertura da sua preferência + 1 pacote com 10 und de casquinhas.',
      image: 'images/catalogo/kit-completo.jpg',
      imageAlt: 'Kit com frasco de cobertura de chocolate, pacote de casquinhas e pote de sorvete Qbombom Napolitano',
      priceCents: 4100,
      keywords: ['kit', 'completo', 'combo', 'sorvete', '2 litros', '2l', 'oferta'],
      action: kitChoices,
    },
    {
      id: 'pote-de-acai-1-litro',
      name: 'Pote de Açaí 1 Litro Montado',
      description: 'Pote de 1 Litro com até 7 adicionais grátis à sua escolha.',
      image: 'images/catalogo/pote-1-litro-acai-montado.jpg',
      imageAlt: 'Pote de 1 litro de açaí com morango, banana, gotas de chocolate e calda de chocolate',
      priceCents: 3000,
      originalPriceCents: 3300,
      badge: 'Oferta',
      keywords: ['pote', '1 litro', '1l', 'acai', 'montado', 'oferta', 'promocao'],
      action: { type: 'customizer', product: 'pote-de-acai-1-litro', label: 'Montar pote' },
    },
    {
      id: 'combo-1-litro',
      name: 'Combo 1 Litro',
      description: 'Pote de sorvete 1 litro + 10 casquinhas.',
      image: 'images/catalogo/combo-1-litro.jpg',
      imageAlt: 'Arte do combo: pote de sorvete Qbombom Napolitano de 1 litro e 10 casquinhas',
      priceCents: 2399,
      keywords: ['combo', '1 litro', '1l', 'casquinhas', 'sorvete', 'oferta', 'cascao', 'qbombom'],
      action: {
        type: 'flavor_modal',
        choices: [{ id: 'sorvete', label: 'Sabor do sorvete (1 litro)', options: POTE_1L_QBOMBOM }],
      },
    },
    {
      id: 'combo-de-sorvete',
      name: 'Combo de Sorvete',
      description: '1 litro do sorvete Ster Bom Dueto + 10 unidades de casquinhas para compartilhar.',
      image: 'images/catalogo/combo-de-sorvete.jpg',
      imageAlt: 'Arte do combo: potes de sorvete Ster Bom Dueto de 1 litro e 10 casquinhas',
      priceCents: 2000,
      keywords: ['combo', 'sorvete', 'casquinhas', 'oferta', 'cascao', '1 litro', '1l', 'dueto', 'ster bom', 'sterbom'],
      action: {
        type: 'flavor_modal',
        choices: [{ id: 'sorvete', label: 'Sabor do Ster Bom Dueto (1 litro)', options: STER_BOM_DUETO }],
      },
    },
  ]),

  ...inDrawer('barcas-e-potes', [
    {
      id: 'barca-de-acai',
      name: 'Barca de Açaí',
      description: 'Inclui 1 Cobertura, 2 Frutas e 7 Adicionais à sua escolha.',
      image: 'images/catalogo/barca-de-acai.jpg',
      imageAlt: 'Barca de açaí com confetes, gotas de chocolate, morango e cobertura, diante do coração de neon da loja',
      priceCents: 3000,
      keywords: ['barca', 'acai', 'cobertura', 'frutas', 'adicionais'],
      action: { type: 'customizer', product: 'barca-de-acai', label: 'Montar barca' },
    },
    {
      id: 'pote-de-acai-2-litros',
      name: 'Pote de Açaí 2 Litros (Açaímix Brazil)',
      description: 'Pote família 2 litros de Açaí Cremoso Açaímix pronto para consumo.',
      image: 'images/catalogo/pote-acai-2-litros.jpg',
      imageAlt: 'Pote de 2 litros de açaí Açaímix Brazil',
      priceCents: 3500,
      keywords: ['pote', 'dois litros', '2 litros', '2l', 'acai', 'acaimix', 'brazil', 'pronto'],
      action: direct,
    },
    {
      id: 'acai-de-1-litro',
      name: 'Açaí de 1 Litro (Açaímix Brazil)',
      description: 'Pote de 1 litro de Açaí Cremoso Açaímix pronto para consumo.',
      image: 'images/catalogo/acai-1-litro.jpg',
      imageAlt: 'Pote de 1 litro de açaí Açaímix Brazil, pronto para consumo',
      priceCents: 2300,
      keywords: ['acai', '1 litro', '1l', 'pote', 'acaimix', 'brazil', 'pronto'],
      action: direct,
    },
    {
      id: 'acai-do-oca-pronto',
      name: 'Açaí do Oca (Pote Pronto)',
      description: 'Pote pronto original Oca do Açaí Tradicional (escolha 500 ml ou 1 Litro).',
      image: 'images/catalogo/acai-do-oca-pote.jpg',
      imageAlt: 'Potes de açaí Oca do Açaí, sabor tradicional',
      priceCents: 1700,
      keywords: ['acai', 'oca', 'oca do acai', 'pote', 'pronto', 'tradicional', '500ml', '1 litro', '1l'],
      action: {
        type: 'flavor_modal',
        choices: [{ id: 'tamanho', label: 'Tamanho', options: ['500 ml', '1 Litro'], prices: { '500 ml': 1700, '1 Litro': 3300 } }],
      },
    },
    {
      id: 'pote-de-sorvete-1-5-litro',
      name: 'Pote de Sorvete 1,5 Litro (Qbombom)',
      description: 'Pote de sorvete cremoso 1,5L em 6 sabores especiais.',
      image: 'images/catalogo/pote-1-5l-qgresco.jpg',
      imageAlt: 'Pote de sorvete Qbombom de 1,5 litro, sabor Qgresco',
      priceCents: 3000,
      keywords: ['pote', '1,5 litros', '1.5l', 'sorvete', 'qbombom', 'torta gelada'],
      action: flavorWithPhotos(
        POTE_1_5L_QBOMBOM,
        {
          Qgresco: 'pote-1-5l-qgresco.jpg',
          'Mousse de maracujá': 'pote-1-5l-maracuja.jpg',
          'Leitinho trufado': 'pote-1-5l-leitinho-trufado.jpg',
          'Iogurte grego': 'pote-1-5l-iogurte-grego.jpg',
          'Cookies cream': 'pote-1-5l-cookies-cream.jpg',
          Qmaltine: 'pote-1-5l-qmaltine.jpg',
        },
        'Pote de sorvete Qbombom de 1,5 litro',
        true,
      ),
    },
    {
      id: 'pote-de-sorvete-2-litros-especiais',
      name: 'Pote de Sorvete 2 Litros (Qbombom Premium)',
      description: 'Pote de sorvete 2L em 12 sabores irresistíveis.',
      image: 'images/catalogo/pote-2l-sensacao.jpg',
      imageAlt: 'Pote de sorvete Qbombom Premium de 2 litros, sabor Sensação',
      priceCents: 2800,
      keywords: ['pote', '2 litros', '2l', 'sorvete', 'qbombom', 'premium'],
      action: flavorWithPhotos(
        POTE_2L_QBOMBOM,
        {
          Sensação: 'pote-2l-sensacao.jpg',
          Chocolate: 'pote-2l-chocolate.jpg',
          Unicórnio: 'pote-2l-unicornio.jpg',
          Pavê: 'pote-2l-pave.jpg',
          Crocante: 'pote-2l-crocante.jpg',
          'Creme com passas': 'pote-2l-creme-passas.jpg',
          'Nata com goiabada': 'pote-2l-nata-goiabada.jpg',
          'Sonho de valsa': 'pote-2l-sonho-de-valsa.jpg',
          'Trio (Chocolate, flocos e creme)': 'pote-2l-trio.jpg',
          Napolitano: 'pote-2l-napolitano.jpg',
        },
        'Pote de sorvete Qbombom Premium de 2 litros',
        true,
      ),
    },
    {
      id: 'pote-de-sorvete-2-litros-tradicional',
      name: 'Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)',
      description: 'Pote 2L Clássicos 4 em 1: Chocolate meio amargo, Creme, Morango e Flocos.',
      image: 'images/catalogo/pote-2l-sterbom-4em1.jpg',
      imageAlt: 'Pote de sorvete Ster Bom Clássicos 4 em 1 de 2 litros',
      priceCents: 2600,
      keywords: ['pote', '2 litros', '2l', 'sorvete', 'ster bom', 'sterbom', 'classicos', '4 em 1'],
      action: direct,
    },
    {
      id: 'pote-de-sorvete-1-litro-especiais',
      name: 'Pote de Sorvete 1 Litro (Qbombom Premium)',
      description: 'Pote de sorvete 1L Premium nos sabores Qbrounie, Brigadeiro, Flocos e Napolitano.',
      image: 'images/catalogo/pote-1l-qbrounie.jpg',
      imageAlt: 'Pote de sorvete Qbombom Premium de 1 litro, sabor Qbrounie',
      priceCents: 1800,
      keywords: ['pote', '1 litro', '1l', 'sorvete', 'qbombom', 'qbombon', 'premium'],
      action: flavorWithPhotos(
        POTE_1L_QBOMBOM,
        {
          Qbrounie: 'pote-1l-qbrounie.jpg',
          Brigadeiro: 'pote-1l-brigadeiro.jpg',
          Flocos: 'pote-1l-flocos.jpg',
          Napolitano: 'pote-1l-napolitano.jpg',
        },
        'Pote de sorvete Qbombom Premium de 1 litro',
      ),
    },
    // Daqui em diante, a lista do pedido de 2026-11-16 chegou cortada: só a foto mudou (a da loja,
    // pelo nome escrito na captura do WhatsApp); nome, preço e sabores continuam os de 2026-11-15.
    {
      id: 'pote-de-sorvete-1-litro-tradicional',
      name: 'Pote de Sorvete 1 Litro (Tradicional)',
      description: 'Pote de sorvete 1 litro — sabores tradicionais',
      image: 'images/catalogo/pote-sorvete-1l-tradicional.jpg',
      imageAlt: 'Sorvete com gotas de chocolate servido com a concha',
      priceCents: 1600,
      keywords: ['pote', '1 litro', '1l', 'sorvete'],
      action: flavor(TRADICIONAIS),
    },
    {
      id: 'acai-com-creme-ninho',
      name: 'Açaí com Creme Ninho (Pronto)',
      description: 'Copo montado com açaí, creme de Ninho e amendoim',
      image: 'images/catalogo/acai-creme-ninho-pronto.jpg',
      imageAlt: 'Copo de açaí em camadas com creme ninho, frutas, granola, jujuba e amendoim',
      priceCents: 1200,
      keywords: ['acai', 'creme ninho', 'ninho', 'amendoim', 'pronto'],
      action: direct,
    },
    {
      id: 'acai-mix-150-ml',
      name: 'Açaí Mix 150 ml',
      description: 'Potinho individual de açaí 150 ml',
      image: 'images/catalogo/acai-mix-150ml.jpg',
      imageAlt: 'Potinho de 150 ml de açaí Açaímix Brazil',
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
      image: 'images/catalogo/copo-diamante-negro.jpg',
      imageAlt: 'Copo de sorvete Diamante Negro com gotas de chocolate e morango, com tampa bolha',
      priceCents: 1200,
      keywords: ['copo', 'diamante negro', 'sorvete', 'chocolate'],
      action: direct,
    },
    {
      id: 'copao-400-ml',
      name: 'Copão 400 ml',
      description: 'Copão de sorvete 400 ml (Napolitano e sabores)',
      image: 'images/catalogo/copao-400ml.jpg',
      imageAlt: 'Dois copões de sorvete Qbombom, Trio e Napolitano',
      priceCents: 950,
      keywords: ['copao', '400ml', 'sorvete', 'napolitano'],
      action: flavor(['Napolitano', 'Chocolate', 'Morango', 'Flocos']),
    },
    {
      id: 'sundae',
      name: 'Sundae',
      description: 'Sorvete cremoso no copo com calda especial',
      image: 'images/catalogo/sundae.jpg',
      imageAlt: 'Sundae Qbombom no copo, com calda e farofa por cima',
      priceCents: 700,
      keywords: ['sundae', 'sorvete', 'calda', 'morango', 'chocolate'],
      action: flavor(['Morango', 'Chocolate', 'Caramelo']),
    },
    {
      id: 'cascao-duo',
      name: 'Cascão DUO',
      description: 'Cascão crocante recheado sabor baunilha com chocolate',
      image: 'images/catalogo/cascao-duo.jpg',
      imageAlt: 'Pacote de cascões DUO de baunilha e chocolate',
      priceCents: 700,
      keywords: ['cascao', 'duo', 'casquinha', 'baunilha', 'chocolate'],
      action: direct,
    },
    {
      id: 'cobertura-sterbom',
      name: 'Cobertura Sterbom (Frasco)',
      description: 'Frasco de cobertura para sorvete (sabores variados)',
      image: 'images/catalogo/cobertura-sterbom.jpg',
      imageAlt: 'Cinco frascos de cobertura Ster Bom',
      priceCents: 700,
      keywords: ['cobertura', 'sterbom', 'calda', 'sorvete'],
      action: flavor(['Chocolate', 'Morango', 'Caramelo', 'Leite Condensado', 'Uva']),
    },
    {
      id: 'moreninha',
      name: 'Moreninha',
      description: 'Casquinha com sorvete banhada na cobertura crocante de chocolate',
      image: 'images/catalogo/moreninha.jpg',
      imageAlt: 'Moreninha: casquinha com sorvete banhada em chocolate',
      priceCents: 350,
      keywords: ['moreninha', 'casquinha', 'sorvete', 'chocolate', 'cascao'],
      action: direct,
    },
    {
      id: 'picole-trufado',
      name: 'Picolé Trufado',
      description: 'Picolé cremoso recheado (Mousse de Maracujá e sabores)',
      image: 'images/catalogo/picole-trufado.jpg',
      imageAlt: 'Picolé trufado mordido, com recheio vermelho',
      priceCents: 300,
      keywords: ['picole', 'trufado', 'mousse', 'maracuja', 'recheado'],
      action: flavor(['Mousse de Maracujá', 'Chocolate', 'Morango', 'Ninho com Nutella']),
    },
    {
      id: 'picole-gourmet',
      name: 'Picolé Gourmet',
      description: 'Picolé artesanal super cremoso',
      image: 'images/catalogo/picole-gourmet.jpg',
      imageAlt: 'Tabela dos picolés gourmet, com os sabores',
      priceCents: 300,
      keywords: ['picole', 'gourmet', 'nutella', 'pacoca', 'iogurte'],
      action: flavor(['Nutella', 'Paçoca', 'Morango com Chocolate', 'Iogurte', 'Maracujá']),
    },
    {
      id: 'garrafinha',
      name: 'Garrafinha',
      description: 'Geladinho cremoso na garrafinha',
      image: 'images/catalogo/garrafinha.jpg',
      imageAlt: 'Duas garrafinhas de geladinho, uma azul e uma de chocolate',
      priceCents: 300,
      keywords: ['garrafinha', 'geladinho', 'dindin', 'sacole'],
      action: flavor(['Chocolate', 'Morango', 'Blue Ice', 'Coco']),
    },
    {
      id: 'roscao-mel',
      name: 'Roscão Mel',
      description: 'Sorvete no roscão / copinho',
      image: 'images/catalogo/roscao-mel.jpg',
      imageAlt: 'Sorvete branco com calda vermelha por cima',
      priceCents: 200,
      keywords: ['roscao', 'mel', 'sorvete'],
      action: direct,
    },
    {
      id: 'picole-comum',
      name: 'Picolé Comum',
      description: 'Picolé refrescante em sabores variados',
      image: 'images/catalogo/picole-comum.jpg',
      imageAlt: 'Picolé de coco da Welder ao lado da embalagem',
      priceCents: 150,
      keywords: ['picole', 'comum', 'fruta'],
      action: flavor(['Coco', 'Chocolate', 'Morango', 'Uva', 'Limão', 'Maracujá']),
    },
    {
      id: 'cremosinho',
      name: 'Cremosinho',
      description: 'Dindin / geladinho cremoso',
      image: 'images/catalogo/cremosinho.jpg',
      imageAlt: 'Pacotes de cremosinho Gostosinho de 80 g',
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
      image: 'images/catalogo/refrigerante-350ml.jpg',
      imageAlt: 'Latas de Fanta Uva, Fanta Laranja, Guaraná Antarctica Zero e Coca-Cola',
      priceCents: 500,
      keywords: ['refrigerante', 'refri', '350ml', 'lata', 'coca', 'guarana', 'fanta'],
      action: flavor(['Coca-Cola', 'Guaraná Antarctica', 'Fanta Laranja', 'Fanta Uva', 'Sprite']),
    },
    {
      id: 'agua-mineral-500-ml',
      name: 'Água Mineral 500 ml',
      description: 'Garrafa de água mineral sem gás 500 ml',
      image: 'images/catalogo/agua-mineral-500ml.jpg',
      imageAlt: 'Garrafa de água mineral Indaiá de 500 ml',
      priceCents: 200,
      keywords: ['agua', 'mineral', '500ml', 'indaia'],
      action: direct,
    },
  ]),

  ...inDrawer('doces-e-bomboniere', [
    {
      id: 'quadradinho-de-brownie',
      name: 'Quadradinho de Brownie',
      description: 'Brownie artesanal macio de chocolate',
      image: 'images/catalogo/quadradinho-brownie.jpg',
      imageAlt: 'Quadradinho de brownie embalado, com o adesivo da Açaí Doce Sabor',
      priceCents: 599,
      originalPriceCents: 600,
      keywords: ['brownie', 'quadradinho', 'chocolate', 'doce'],
      action: direct,
    },
    {
      id: 'pippos',
      name: "Pippo's",
      description: "Salgadinho Pippo's sabor Churrasco",
      image: 'images/catalogo/pippos.jpg',
      imageAlt: "Pacotes de salgadinho Pippo's Vitaminado",
      priceCents: 375,
      keywords: ['pippos', "pippo's", 'salgadinho', 'churrasco'],
      action: direct,
    },
    {
      id: 'trufas',
      name: 'Trufas',
      description: 'Trufa artesanal recheada',
      image: 'images/catalogo/trufas.jpg',
      imageAlt: 'Trufa de chocolate cortada, com recheio cremoso',
      priceCents: 250,
      originalPriceCents: 300,
      keywords: ['trufa', 'trufas', 'chocolate', 'beijinho', 'maracuja', 'coco'],
      action: flavor(['Chocolate 50%', 'Beijinho', 'Maracujá', 'Coco']),
    },
    {
      id: 'trident',
      name: 'Trident',
      description: 'Chiclete Trident sem açúcar',
      image: 'images/catalogo/trident.jpg',
      imageAlt: 'Pacotes de chiclete Trident',
      priceCents: 250,
      keywords: ['trident', 'chiclete', 'goma', 'menta'],
      action: flavor(['Menta', 'Hortelã', 'Melancia', 'Tutti-Frutti']),
    },
    {
      id: 'batom-ao-leite',
      name: 'Batom ao Leite',
      description: 'Chocolate Garoto Batom ao Leite',
      image: 'images/catalogo/batom-ao-leite.jpg',
      imageAlt: 'Caixa de chocolates Baton ao leite',
      priceCents: 200,
      keywords: ['batom', 'chocolate', 'ao leite'],
      action: direct,
    },
    {
      id: 'mentos',
      name: 'Mentos',
      description: 'Bala mastigável Mentos',
      image: 'images/catalogo/mentos.jpg',
      imageAlt: 'Rolos de bala Mentos Fruit',
      priceCents: 200,
      keywords: ['mentos', 'bala', 'fruit', 'menta'],
      action: flavor(['Fruit (Frutas)', 'Mint (Menta)', 'Rainbow']),
    },
    {
      id: 'halls',
      name: 'Halls',
      description: 'Bala refrescante Halls',
      image: 'images/catalogo/halls.jpg',
      imageAlt: 'Pacotes de bala Halls de morango',
      priceCents: 200,
      keywords: ['halls', 'bala', 'menta', 'cereja', 'morango'],
      action: flavor(['Extra Forte', 'Menta', 'Cereja', 'Morango', 'Melancia']),
    },
    {
      id: 'pipoca-kigarot-75g',
      name: 'Pipoca Kigarot 75g',
      description: 'Pipoca doce/salgada Kigarot pacote 75g — Sabor Manteiga',
      image: 'images/catalogo/pipoca-kigarot-75g.jpg',
      imageAlt: 'Pacote de pipoca Kigarot sabor manteiga de 75 g',
      priceCents: 200,
      keywords: ['pipoca', 'kigarot', '75g', 'manteiga'],
      action: direct,
    },
    {
      id: 'pipoca-kigarot-45g',
      name: 'Pipoca Kigarot 45g',
      description: 'Pipoca Kigarot pacote 45g — Sabor Manteiga',
      image: 'images/catalogo/pipoca-kigarot-45g.jpg',
      imageAlt: 'Pacotes de pipoca Kigarot sabor manteiga de 45 g',
      priceCents: 150,
      keywords: ['pipoca', 'kigarot', '45g', 'manteiga'],
      action: direct,
    },
    {
      id: 'fini-gelatinas',
      name: 'Fini Gelatinas',
      description: 'Pacotinho individual de balas de gelatina Fini',
      image: 'images/catalogo/fini-gelatinas.jpg',
      imageAlt: 'Pacotinhos de balas de gelatina Fini',
      priceCents: 150,
      keywords: ['fini', 'gelatina', 'bala', 'doce'],
      action: direct,
    },
    {
      id: 'docile-canudinho',
      name: 'Docile Canudinho',
      description: 'Canudinho doce Docile',
      image: 'images/catalogo/docile-canudinho.jpg',
      imageAlt: 'Canudinhos doces Docile',
      priceCents: 150,
      keywords: ['docile', 'canudinho', 'fini', 'doce'],
      action: direct,
    },
    {
      id: 'jujuba',
      name: 'Jujuba',
      description: 'Pacote de balas de goma / jujuba colorida',
      image: 'images/catalogo/jujuba.jpg',
      imageAlt: 'Rolos de balas de goma Gomets',
      priceCents: 100,
      keywords: ['jujuba', 'goma', 'bala', 'gomets'],
      action: direct,
    },
    {
      id: 'nucita',
      name: 'Nucita',
      description: 'Creme doce Napolitano Nucita',
      image: 'images/catalogo/nucita.jpg',
      imageAlt: 'Caixa do doce Ducrem Napolitano',
      priceCents: 50,
      keywords: ['nucita', 'creme', 'napolitano', 'doce'],
      action: direct,
    },
    {
      id: 'chocolate-recheado',
      name: 'Chocolate Recheado',
      description: 'Bombom / chocolate recheado individual',
      image: 'images/catalogo/chocolate-recheado.jpg',
      imageAlt: 'Bombons Bee recheados de vários sabores',
      priceCents: 50,
      keywords: ['chocolate', 'recheado', 'bombom', 'uva'],
      action: direct,
    },
  ]),
]

/**
 * Os itens como aparecem agora: a base com as mudanças do vendedor (`catalogStore.ts`). É uma
 * ligação viva: quem importa vê a troca feita por `setExtraItems`.
 */
export let EXTRA_ITEMS: readonly ExtraItem[] = BASE_EXTRA_ITEMS

/** As seções como aparecem agora (o vendedor pode renomear). Ligação viva. */
export let DRAWERS: readonly Drawer[] = BASE_DRAWERS
let drawersById = new Map(DRAWERS.map((drawer) => [drawer.id, drawer]))

/** Troca as seções (só `catalogStore.ts` chama). */
export function setDrawers(drawers: readonly Drawer[]): void {
  DRAWERS = drawers
  drawersById = new Map(drawers.map((drawer) => [drawer.id, drawer]))
}
let itemsById = new Map(EXTRA_ITEMS.map((item) => [item.id, item]))

/** Troca os itens (só `catalogStore.ts` chama). */
export function setExtraItems(items: readonly ExtraItem[]): void {
  EXTRA_ITEMS = items
  itemsById = new Map(items.map((item) => [item.id, item]))
}

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
  return item.action.type !== 'customizer' && item.available !== false
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
export function normalizeChoices(
  item: ExtraItem,
  raw: Readonly<Record<string, unknown>>,
  /** `ignoreStock`: reler um item que já estava no carrinho, mesmo esgotado (pedido de 2026-11-17). */
  options: { ignoreStock?: boolean } = {},
): Readonly<Record<string, string>> | null {
  if (item.action.type === 'customizer' || (!options.ignoreStock && item.available === false)) return null
  const choices: Record<string, string> = {}
  for (const group of choiceGroupsOf(item)) {
    const value = raw[group.id]
    if (typeof value !== 'string') return null
    if (group.options.includes(value)) {
      // Opção esgotada pelo vendedor (2026-11-17): não entra; a que já estava no carrinho fica.
      if (!options.ignoreStock && group.unavailable?.includes(value)) return null
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

/** O item tem opção que muda o preço (o tamanho do Açaí do Oca): o cartão mostra "a partir de". */
/**
 * Número do selo "N sabores" do cartão: as opções do primeiro grupo de escolha que não é de
 * tamanho (sem contar "Outro sabor", que não é uma opção da lista). 0 quando não há sabor a escolher.
 */
export function flavorCount(item: ExtraItem): number {
  const group = choiceGroupsOf(item).find((candidate) => !candidate.prices)
  return group?.options.length ?? 0
}

export function hasPricedChoices(item: ExtraItem): boolean {
  return choiceGroupsOf(item).some((group) => group.prices !== undefined)
}

/**
 * Preço de uma unidade do item com as escolhas feitas: o da opção escolhida, quando a opção tem
 * preço próprio; senão o do item. Sem escolha ainda, o do item (o menor).
 */
export function extraPriceCents(item: ExtraItem, choices: Readonly<Record<string, string>> = {}): number {
  for (const group of choiceGroupsOf(item)) {
    const price = group.prices?.[choices[group.id]]
    if (price !== undefined) return price
  }
  return item.priceCents
}

/**
 * Foto do item com as escolhas feitas: a do sabor escolhido, quando a loja mandou a foto daquele
 * sabor (o pote de cada sabor); senão a do item.
 */
export function extraPhoto(item: ExtraItem, choices: Readonly<Record<string, string>> = {}): { image: string; alt: string } {
  for (const group of choiceGroupsOf(item)) {
    const option = choices[group.id]
    const image = option === undefined ? undefined : group.photos?.[option]
    if (image) return { image, alt: `${group.photoAlt ?? item.name}, sabor ${option}` }
  }
  return { image: item.image, alt: item.imageAlt }
}
