/**
 * Fotos reais do site: a de cada ingrediente (cartões do personalizador) e a foto fixa de cada
 * produto (personalizador, cardápio, página inicial e carrinho).
 *
 * - Ingredientes: `public/images/ingredientes/`. As embalagens (Ninho, Farinha Láctea, Italac e
 *   as coberturas Du Porto) aparecem inteiras (`contain`); as fotos de textura preenchem o
 *   quadro (`cover`). Origem de cada uma em `assets/fotos-loja/LEIA-ME.md` e em `/creditos`.
 * - Produtos: `public/images/products/`, uma foto por produto, que não muda com os ingredientes.
 *   Só o isopor tem foto própria, para não mostrar copo quando o recipiente é a tigela.
 */
import type { CategorySlug } from './categories.ts'
import type { ContainerKind, Topping } from './menu.ts'

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
  // Fotos de banco com licença comercial, até a loja enviar as suas.
  granola: ['granola.webp', 'cover'],
  biscoito: ['biscoito.webp', 'cover'],
  'gotas-de-chocolate': ['gotas-de-chocolate.webp', 'cover'],
  canudinho: ['canudinho.webp', 'cover'],
  bis: ['bis.webp', 'cover'],
  sucrilhos: ['sucrilhos.webp', 'cover'],
  kiwi: ['kiwi.webp', 'cover'],
  morango: ['morango.webp', 'cover'],
  cereja: ['cereja.webp', 'cover'],
  'kit-kat': ['kit-kat.webp', 'cover'],
  'creme-de-morango': ['creme-de-morango.webp', 'cover'],
  'creme-de-cookies': ['creme-de-cookies.webp', 'cover'],
  ovomaltine: ['ovomaltine.webp', 'cover'],
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
  /** Nome do arquivo, sem o tamanho: `products/<name>-400.webp` e `-800.webp`. */
  name: string
  /** O que a foto mostra, para leitores de tela. */
  alt: string
}

const PRODUCT_PHOTOS: Readonly<Record<CategorySlug, ProductPhotoData>> = {
  'acai-oca': { name: 'acai-oca', alt: 'Açaí no copo transparente com granola, morango e banana' },
  'acai-tradicional': { name: 'acai-tradicional', alt: 'Açaí no copo com rodelas de banana por cima' },
  'acai-batido': { name: 'acai-batido', alt: 'Açaí cremoso na xícara, com um morango por cima' },
  'milk-shake': { name: 'milk-shake', alt: 'Milk-shake na taça, com chantilly e calda de caramelo' },
}

const ISOPOR_PHOTO: ProductPhotoData = {
  name: 'acai-isopor',
  alt: 'Açaí na tigela com kiwi, morango, banana e canudinho',
}

/** Foto fixa do produto. No isopor, a foto da tigela. */
export function productPhoto(slug: CategorySlug, container?: ContainerKind): ProductPhotoData {
  return container === 'isopor' ? ISOPOR_PHOTO : PRODUCT_PHOTOS[slug]
}

/** Todas as fotos de produto (para os testes). */
export const ALL_PRODUCT_PHOTOS: readonly ProductPhotoData[] = [...Object.values(PRODUCT_PHOTOS), ISOPOR_PHOTO]

export const productPhotoSrc = (name: string, size: 400 | 800) => `${base}products/${name}-${size}.webp`
