/**
 * As fotos que o site usa existem de verdade em public/images: nenhum cartão fica com imagem
 * quebrada. Também confere que as fotos enviadas pela loja estão todas em uso e que não sobra
 * foto sem uso (como a do Biscoito, que saiu do cardápio).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXTRA_ITEMS } from '../src/features/catalog/extras.ts'
import { TOPPINGS } from '../src/features/catalog/menu.ts'
import { ALL_PRODUCT_PHOTOS, catalogPhotoSrc, ingredientFile } from '../src/features/catalog/photos.ts'
import { FEATURED_OFFER_NOTIFICATIONS } from '../src/features/offers/offerNotifications.ts'
import catalog from '../scripts/fotos/catalogo.json'
import { imageInfo } from './imageHeader.ts'

const ROOT = join(import.meta.dirname, '..')
const IMAGES = join(ROOT, 'public', 'images')
const CATALOG = join(IMAGES, 'catalogo')

/** Licenças que permitem uso comercial e recorte (sem NC nem ND). */
const COMMERCIAL_LICENSES = ['Licença Pexels', 'CC0', 'Domínio público', 'CC BY 2.0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0']

type CatalogSource = { item: string; autor?: string; licenca?: string; pagina?: string; download?: string; pecas?: string[] }
const SOURCES = catalog.fotos as unknown as Record<string, CatalogSource>
const PIECES = catalog._pecas as unknown as Record<string, { autor: string; licenca: string; pagina?: string; arquivoLoja?: string }>

/** Arquivo em public/ de um endereço do site ("/images/catalogo/x-480.webp"). */
const publicFile = (src: string) => join(ROOT, 'public', src.replace(/^\//, ''))

describe('arquivos de imagem', () => {
  it('a foto de cada ingrediente existe em public/images/ingredientes', () => {
    for (const topping of TOPPINGS) {
      const file = ingredientFile(topping)!
      expect(existsSync(join(IMAGES, 'ingredientes', file)), `${topping.id}: ${file}`).toBe(true)
    }
  })

  it('as 20 fotos de ingrediente enviadas pela loja estão em public/images/ingredientes e todas em uso', () => {
    const sent = readdirSync(join(ROOT, 'assets', 'fotos-loja')).filter((file) => file.endsWith('.png'))
    const used = new Set(TOPPINGS.map((topping) => ingredientFile(topping)))
    expect(sent).toHaveLength(20)
    for (const file of sent) {
      expect(existsSync(join(IMAGES, 'ingredientes', file)), file).toBe(true)
      expect(used.has(file), `${file} sem uso`).toBe(true)
    }
  })

  it('não sobra foto de ingrediente sem uso', () => {
    const used = [...new Set(TOPPINGS.map((topping) => ingredientFile(topping)))].sort()
    expect(readdirSync(join(IMAGES, 'ingredientes')).sort()).toEqual(used)
  })

  it('a foto de cada produto existe: o PNG enviado, com o tamanho do código, e as cópias de 480 e 960 px', () => {
    for (const photo of ALL_PRODUCT_PHOTOS) {
      const png = join(IMAGES, 'produtos', `${photo.name}.png`)
      expect(existsSync(png), png).toBe(true)
      // Largura e altura ficam no cabeçalho do PNG (bloco IHDR, a partir do byte 16).
      const header = readFileSync(png)
      expect([header.readUInt32BE(16), header.readUInt32BE(20)], photo.name).toEqual([photo.width, photo.height])
      // Tipo de cor do PNG (byte 25): 6 = com canal alfa (fundo transparente), 2 = sem.
      expect(header[25], `${photo.name}: tipo de cor`).toBe(photo.transparent ? 6 : 2)
      for (const width of [480, 960]) {
        expect(existsSync(join(IMAGES, 'produtos', `${photo.name}-${width}.webp`)), `${photo.name}-${width}`).toBe(true)
      }
    }
  })

  it('fotos do cardápio: a de cada item e as cópias de 480 e 960 px existem, são imagens válidas e quadradas', () => {
    expect(EXTRA_ITEMS).toHaveLength(43)
    for (const item of EXTRA_ITEMS) {
      const master = join(ROOT, 'public', item.image)
      expect(existsSync(master), item.image).toBe(true)
      const info = imageInfo(readFileSync(master))
      expect(info?.format, item.image).toBe(item.image.endsWith('.png') ? 'png' : 'jpeg')
      expect(info!.width, `${item.image}: quadrada`).toBe(info!.height)
      expect(info!.width, `${item.image}: resolução`).toBeGreaterThanOrEqual(600)
      // Pedido: arquivo maior que 15 KB (foto de verdade, não página de erro nem imagem vazia).
      expect(statSync(master).size, `${item.image}: tamanho`).toBeGreaterThan(15 * 1024)
      for (const width of [480, 960] as const) {
        const file = publicFile(catalogPhotoSrc(item.image, width))
        expect(existsSync(file), file).toBe(true)
        expect(imageInfo(readFileSync(file)), file).toEqual({ format: 'webp', width, height: width })
      }
    }
  })

  it('a miniatura de cada uma das 12 notificações de oferta existe e é uma imagem válida', () => {
    expect(FEATURED_OFFER_NOTIFICATIONS).toHaveLength(12)
    for (const offer of FEATURED_OFFER_NOTIFICATIONS) {
      const file = publicFile(offer.photo.src)
      expect(existsSync(file), `${offer.id}: ${file}`).toBe(true)
      expect(imageInfo(readFileSync(file))?.format, offer.id).toBe('webp')
    }
  })

  it('fotos do cardápio: não sobra arquivo sem uso em public/images/catalogo', () => {
    const expected = EXTRA_ITEMS.flatMap((item) => {
      const name = item.image.split('/').pop()!
      const base = name.replace(/\.(jpg|png)$/, '')
      return [name, `${base}-480.webp`, `${base}-960.webp`]
    }).sort()
    expect(readdirSync(CATALOG).sort()).toEqual(expected)
  })

  it('fotos do cardápio: cada uma tem fonte, autor e licença de uso comercial (créditos em /creditos)', () => {
    const files = EXTRA_ITEMS.map((item) => item.image.split('/').pop()).sort()
    expect(Object.keys(SOURCES).sort()).toEqual(files)
    for (const [file, source] of Object.entries(SOURCES)) {
      expect(EXTRA_ITEMS.find((item) => item.id === source.item)?.image, file).toBe(`images/catalogo/${file}`)
      if (source.pecas) {
        for (const key of source.pecas) {
          const piece = PIECES[key]
          expect(piece, `${file}: peça ${key}`).toBeDefined()
          if (piece.arquivoLoja) expect(existsSync(join(ROOT, piece.arquivoLoja)), piece.arquivoLoja).toBe(true)
          else expect([piece.autor, piece.pagina?.startsWith('https://'), COMMERCIAL_LICENSES.includes(piece.licenca)], `${file}: ${key}`).toEqual([piece.autor, true, true])
        }
        continue
      }
      expect(source.autor?.trim(), `${file}: autor`).toBeTruthy()
      expect(COMMERCIAL_LICENSES, `${file}: ${source.licenca}`).toContain(source.licenca)
      expect(source.pagina, `${file}: página`).toMatch(/^https:\/\//)
      expect(source.download, `${file}: download`).toMatch(/^https:\/\//)
    }
  })

  it('as 4 fotos de produto enviadas pela loja estão em uso, e só elas', () => {
    // Originais em JPG ou WebP; as fotos substituídas ficam em `produtos/anteriores/`.
    const sent = readdirSync(join(ROOT, 'assets', 'fotos-loja', 'produtos')).filter((file) => /\.(jpg|webp|png)$/.test(file))
    const names = ALL_PRODUCT_PHOTOS.map((photo) => photo.name).sort()
    expect(sent.map((file) => file.replace(/\.(jpg|webp|png)$/, '')).sort()).toEqual(names)
    const published = names.flatMap((name) => [`${name}.png`, `${name}-480.webp`, `${name}-960.webp`]).sort()
    expect(readdirSync(join(IMAGES, 'produtos')).sort()).toEqual(published)
  })
})
