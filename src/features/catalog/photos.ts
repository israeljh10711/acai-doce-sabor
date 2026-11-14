/**
 * Fotos reais do site: a de cada ingrediente (cartões do personalizador) e a foto fixa de cada
 * produto (personalizador, cardápio, página inicial e carrinho).
 *
 * - Ingredientes: `public/images/ingredientes/`. As embalagens (Ninho, Farinha Láctea, Italac e
 *   as coberturas Du Porto) aparecem inteiras (`contain`); as fotos de textura preenchem o
 *   quadro (`cover`). Origem de cada uma em `assets/fotos-loja/LEIA-ME.md` e em `/creditos`.
 * - Produtos: `public/images/produtos/`, a foto que a loja enviou para cada produto, uma só,
 *   que não muda com os ingredientes nem com o recipiente. Aparece inteira (`contain`). A do
 *   milk-shake tem o fundo removido (PNG transparente): recortada sobre o roxo na página inicial,
 *   igual às outras nos quadros brancos. Originais em `assets/fotos-loja/produtos/`.
 */
import type { CategorySlug } from './categories.ts'
import type { Topping } from './menu.ts'

const base = `${import.meta.env.BASE_URL}images/`

export type PhotoFit = 'contain' | 'cover'
export type IngredientPhoto = { src: string; fit: PhotoFit }

/** Arquivo e enquadramento da foto de cada ingrediente, pelo nome da foto (`look` ou `id`). */
const INGREDIENT_FILES: Readonly<Record<string, [file: string, fit: PhotoFit]>> = {
  // Fotos enviadas em 2026-11-14.
  'leite-condensado': ['leite-condensado.png', 'contain'],
  'leite-em-po': ['leite-em-po.png', 'contain'],
  'farinha-lactea': ['farinha-lactea.png', 'contain'],
  marshmallow: ['marshmallow.png', 'cover'],
  amendoim: ['amendoim.png', 'cover'],
  chocoball: ['chocoball.png', 'cover'],
  pacoca: ['pacoca.png', 'cover'],
  disquete: ['disquete-confete.png', 'cover'],
  banana: ['banana.png', 'cover'],
  'creme-de-ninho': ['creme-ninho.png', 'cover'],
  'creme-de-avela': ['creme-avela.png', 'cover'],
  'calda-frutas-vermelhas': ['cobertura-frutas-vermelhas.png', 'contain'],
  'calda-doce-de-leite': ['cobertura-doce-de-leite.png', 'contain'],
  'calda-acai': ['cobertura-acai.png', 'contain'],
  'calda-banana-caramelizada': ['cobertura-banana-caramelada.png', 'contain'],
  'calda-chocolate': ['cobertura-chocolate.png', 'contain'],
  'calda-morango': ['cobertura-morango.png', 'contain'],
  // Enviadas depois, também em 2026-11-14: adicionais do Açaí Batido.
  'creme-de-cookies': ['creme-cookies.png', 'cover'],
  'creme-de-morango': ['creme-morango.png', 'cover'],
  ovomaltine: ['ovomaltine.png', 'cover'],
  // Fotos de banco com licença comercial, até a loja enviar as suas.
  granola: ['granola.webp', 'cover'],
  'gotas-de-chocolate': ['gotas-de-chocolate.webp', 'cover'],
  canudinho: ['canudinho.webp', 'cover'],
  bis: ['bis.webp', 'cover'],
  sucrilhos: ['sucrilhos.webp', 'cover'],
  kiwi: ['kiwi.webp', 'cover'],
  morango: ['morango.webp', 'cover'],
  cereja: ['cereja.webp', 'cover'],
  'kit-kat': ['kit-kat.webp', 'cover'],
}

/** Nome da foto de um ingrediente: os do batido usam as fotos de mesmo nome. */
export const lookOf = (topping: Pick<Topping, 'id' | 'look'>) => topping.look ?? topping.id

/** Arquivo da foto de um ingrediente, sem o caminho (para os testes conferirem que existe). */
export function ingredientFile(topping: Pick<Topping, 'id' | 'look'>): string | undefined {
  return INGREDIENT_FILES[lookOf(topping)]?.[0]
}

export function ingredientPhoto(topping: Pick<Topping, 'id' | 'look'>): IngredientPhoto | undefined {
  const entry = INGREDIENT_FILES[lookOf(topping)]
  return entry && { src: `${base}ingredientes/${entry[0]}`, fit: entry[1] }
}

export type ProductPhotoData = {
  /** Nome do arquivo: `produtos/<name>.png` e as cópias leves `<name>-480.webp` e `-960.webp`. */
  name: string
  /** O que a foto mostra, para leitores de tela. */
  alt: string
  /** Tamanho do PNG, em pixels: reserva o espaço certo antes de a foto carregar. */
  width: number
  height: number
  /** Fundo removido (PNG com transparência), para aparecer recortada sobre fundo de cor. */
  transparent?: boolean
}

/** Foto de cada produto, enviada pela loja em 2026-11-14. */
const PRODUCT_PHOTOS: Readonly<Record<CategorySlug, ProductPhotoData>> = {
  'acai-oca': {
    name: 'acai-oca',
    alt: 'Pote de Açaí Oca em camadas, com sucrilhos, morango, granola e amendoim por cima',
    width: 1056,
    height: 1200,
  },
  'acai-tradicional': {
    name: 'acai-tradicional',
    alt: 'Açaí na tigela de isopor com morango, gotas de chocolate, confete, banana, amendoim e chocoball',
    width: 1200,
    height: 982,
  },
  'acai-batido': {
    name: 'acai-batido',
    alt: 'Duas garrafas de açaí batido com creme, com o rótulo da Açaí Doce Sabor',
    width: 638,
    height: 1200,
  },
  'milk-shake': {
    name: 'milkshake',
    alt: 'Milk-shake de chocolate no copo com tampa bolha transparente, com calda de chocolate por dentro',
    width: 627,
    height: 999,
    // Pedido de 2026-11-14: fundo transparente; a tampa bolha fica translúcida.
    transparent: true,
  },
}

/** Foto fixa do produto: a mesma em todo o site, seja qual for o recipiente ou os ingredientes. */
export const productPhoto = (slug: CategorySlug): ProductPhotoData => PRODUCT_PHOTOS[slug]

/** Todas as fotos de produto (para os testes). */
export const ALL_PRODUCT_PHOTOS: readonly ProductPhotoData[] = Object.values(PRODUCT_PHOTOS)

/** O PNG enviado (sem largura) ou a cópia WebP de 480 ou 960 px de largura. */
export const productPhotoSrc = (name: string, width?: 480 | 960) =>
  width ? `${base}produtos/${name}-${width}.webp` : `${base}produtos/${name}.png`
