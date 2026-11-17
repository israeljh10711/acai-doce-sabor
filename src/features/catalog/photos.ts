/**
 * Fotos reais do site: a de cada ingrediente (cartões do personalizador), a foto fixa de cada
 * produto (personalizador, cardápio, página inicial e carrinho) e as fotos dos itens das gavetas.
 *
 * - Ingredientes: `public/images/ingredientes/`. As embalagens (Ninho, Farinha Láctea, Italac e
 *   as coberturas Du Porto) aparecem inteiras (`contain`); as fotos de textura preenchem o
 *   quadro (`cover`). Origem de cada uma em `assets/fotos-loja/LEIA-ME.md` e em `/creditos`.
 * - Produtos: `public/images/produtos/`, a foto que a loja enviou para cada produto, uma só,
 *   que não muda com os ingredientes nem com o recipiente. Aparece inteira (`contain`). A do
 *   milk-shake tem o fundo removido (PNG transparente): recortada sobre o roxo na página inicial,
 *   igual às outras nos quadros brancos. Originais em `assets/fotos-loja/produtos/`.
 * - Itens das gavetas: `public/images/catalogo/`. Desde 2026-11-16, as fotos da loja recortadas do
 *   catálogo do WhatsApp (originais em `assets/fotos-loja/whatsapp/`); o tamanho de cada cópia está
 *   em `catalogPhotos.json`.
 */
import catalogPhotos from './catalogPhotos.json'
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

export function ingredientPhoto(topping: Pick<Topping, 'id' | 'look' | 'image'>): IngredientPhoto | undefined {
  // Foto enviada pelo vendedor no lugar da foto do ingrediente.
  if (topping.image) return { src: topping.image, fit: 'cover' }
  const entry = INGREDIENT_FILES[lookOf(topping)]
  return entry && { src: `${base}ingredientes/${entry[0]}`, fit: entry[1] }
}

/**
 * Arquivo da foto ampliada do ingrediente: as de banco (WebP de 256 px) têm a cópia
 * `<id>-grande.webp`; as enviadas pela loja já são o arquivo inteiro.
 */
export function ingredientZoomFile(topping: Pick<Topping, 'id' | 'look'>): string | undefined {
  const file = ingredientFile(topping)
  return file?.endsWith('.webp') ? file.replace(/\.webp$/, '-grande.webp') : file
}

export const ingredientZoomSrc = (topping: Pick<Topping, 'id' | 'look' | 'image'>) => {
  if (topping.image) return topping.image
  const file = ingredientZoomFile(topping)
  return file && `${base}ingredientes/${file}`
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

/**
 * Tamanho real das cópias de cada foto do cardápio e o enquadramento no cartão. Feito pelos
 * scripts de fotos (`tamanhos-catalogo.mjs`). As fotos da loja tiradas do WhatsApp são pequenas:
 * as duas cópias ficam no tamanho da foto, sem ampliar.
 */
type CatalogPhotoInfo = { 480: [number, number]; 960: [number, number]; fit: PhotoFit; loja: boolean }
const CATALOG_PHOTOS = catalogPhotos as unknown as Readonly<Record<string, CatalogPhotoInfo>>

const catalogInfo = (image: string): CatalogPhotoInfo | undefined => CATALOG_PHOTOS[image.split('/').pop() ?? '']

/**
 * Foto de um item das gavetas (`image`, ex.: `images/catalogo/sundae.jpg`): a cópia WebP de até
 * 480 ou 960 px de largura que fica ao lado do arquivo de referência (`sundae-480.webp`).
 */
export const catalogPhotoSrc = (image: string, width: 480 | 960) =>
  isUploadedPhoto(image) ? image : `${import.meta.env.BASE_URL}${image.replace(/\.(jpg|png)$/, `-${width}.webp`)}`

/** Foto enviada pelo vendedor (modo vendedor, 2026-11-16): um endereço pronto, sem cópias de tamanho. */
export const isUploadedPhoto = (image: string): boolean => /^(https?:|blob:|data:)/.test(image)

/** As cópias com a largura de verdade, para o navegador escolher pelo tamanho em que a foto aparece. */
export function catalogPhotoSrcSet(image: string): string | undefined {
  const info = catalogInfo(image)
  if (!info) return undefined
  if (info[480][0] === info[960][0]) return `${catalogPhotoSrc(image, 960)} ${info[960][0]}w`
  return `${catalogPhotoSrc(image, 480)} ${info[480][0]}w, ${catalogPhotoSrc(image, 960)} ${info[960][0]}w`
}

/** Largura e altura da maior cópia (a da foto ampliada). */
export function catalogPhotoSize(image: string): { width: number; height: number } | undefined {
  const info = catalogInfo(image)
  return info && { width: info[960][0], height: info[960][1] }
}

/** Enquadramento no cartão: a foto preenche o quadro, ou aparece inteira (tabela de sabores). */
export const catalogPhotoFit = (image: string): PhotoFit => catalogInfo(image)?.fit ?? 'cover'

/** A foto é da loja (catálogo do WhatsApp), não de banco. */
export const isStorePhoto = (image: string): boolean => catalogInfo(image)?.loja ?? false
