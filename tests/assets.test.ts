/**
 * As fotos que o site usa existem de verdade em public/images: nenhum cartão fica com imagem
 * quebrada. Também confere que as fotos enviadas pela loja estão todas em uso e que não sobra
 * foto sem uso (como a do Biscoito, que saiu do cardápio).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXTRA_ITEMS, choiceGroupsOf } from '../src/features/catalog/extras.ts'
import { TOPPINGS } from '../src/features/catalog/menu.ts'
import { ALL_PRODUCT_PHOTOS, catalogPhotoSrc, ingredientFile, ingredientZoomFile } from '../src/features/catalog/photos.ts'
import { FEATURED_OFFER_NOTIFICATIONS } from '../src/features/offers/offerNotifications.ts'
import catalogPhotos from '../src/features/catalog/catalogPhotos.json'
import catalog from '../scripts/fotos/catalogo.json'
import whatsapp from '../scripts/fotos/whatsapp.json'
import { imageInfo } from './imageHeader.ts'

const ROOT = join(import.meta.dirname, '..')
const IMAGES = join(ROOT, 'public', 'images')
const CATALOG = join(IMAGES, 'catalogo')

/** Licenças que permitem uso comercial e recorte (sem NC nem ND). */
const COMMERCIAL_LICENSES = ['Licença Pexels', 'CC0', 'Domínio público', 'CC BY 2.0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0']

type CatalogSource = { item: string; autor?: string; licenca?: string; pagina?: string; download?: string }
const SOURCES = catalog.fotos as unknown as Record<string, CatalogSource>

type StoreSource = { captura: string; item: string; sabor?: string; principal?: boolean; pedido: boolean; fit?: string }
const STORE = whatsapp.fotos as unknown as Record<string, StoreSource>
const WHATSAPP = whatsapp as unknown as { naoUsadas: Record<string, string> }
const PHOTO_INFO = catalogPhotos as unknown as Record<string, { 480: [number, number]; 960: [number, number]; fit: string; loja: boolean }>

/** Arquivos do cardápio em uso: a foto de cada item e as fotos dos sabores. */
const USED_CATALOG_FILES = new Set(
  EXTRA_ITEMS.flatMap((item) => [item.image, ...choiceGroupsOf(item).flatMap((group) => Object.values(group.photos ?? {}))]).map(
    (image) => image.split('/').pop()!,
  ),
)

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

  it('não sobra foto de ingrediente sem uso (contando as cópias grandes da foto ampliada)', () => {
    const used = [...new Set(TOPPINGS.flatMap((topping) => [ingredientFile(topping), ingredientZoomFile(topping)]))].sort()
    expect(readdirSync(join(IMAGES, 'ingredientes')).sort()).toEqual(used)
  })

  it('a foto ampliada de cada ingrediente existe; as de banco têm a cópia grande, maior que a miniatura', () => {
    for (const topping of TOPPINGS) {
      const file = ingredientZoomFile(topping)!
      const info = imageInfo(readFileSync(join(IMAGES, 'ingredientes', file)))
      expect(info, `${topping.id}: ${file}`).not.toBeNull()
      if (file.endsWith('-grande.webp')) expect(info!.width, file).toBeGreaterThan(256)
    }
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

  it('fotos do cardápio: a de cada item e de cada sabor, e as duas cópias, existem e são imagens válidas', () => {
    expect(EXTRA_ITEMS).toHaveLength(44)
    for (const file of USED_CATALOG_FILES) {
      const master = join(CATALOG, file)
      expect(existsSync(master), file).toBe(true)
      const info = imageInfo(readFileSync(master))
      expect(info?.format, file).toBe(file.endsWith('.png') ? 'png' : 'jpeg')
      // Pedido: arquivo maior que 15 KB (foto de verdade, não página de erro nem imagem vazia).
      expect(statSync(master).size, `${file}: tamanho`).toBeGreaterThan(15 * 1024)
      if (STORE[file]) {
        // Foto da loja (WhatsApp): o recorte da captura, até 900 px de largura, nunca ampliado.
        expect(info!.width, `${file}: largura`).toBeLessThanOrEqual(900)
        expect(Math.min(info!.width, info!.height), `${file}: resolução`).toBeGreaterThanOrEqual(280)
      } else {
        // Foto de banco: quadrada, de pelo menos 600 px.
        expect(info!.width, `${file}: quadrada`).toBe(info!.height)
        expect(info!.width, `${file}: resolução`).toBeGreaterThanOrEqual(600)
      }
      // As cópias têm o tamanho que o site pensa que têm (catalogPhotos.json).
      for (const width of [480, 960] as const) {
        const copy = publicFile(catalogPhotoSrc(`images/catalogo/${file}`, width))
        expect(existsSync(copy), copy).toBe(true)
        const size = imageInfo(readFileSync(copy))
        expect([size?.format, size?.width, size?.height], `${file} ${width}`).toEqual(['webp', ...PHOTO_INFO[file][width]])
        if (STORE[file]) expect(size!.width, `${file} ${width}`).toBe(Math.min(width, info!.width))
        else expect(size!.width, `${file} ${width}`).toBe(width)
      }
    }
  })

  it('catalogPhotos.json descreve exatamente as fotos em uso, com o enquadramento e a origem certos', () => {
    expect(Object.keys(PHOTO_INFO).sort()).toEqual([...USED_CATALOG_FILES].sort())
    for (const [file, info] of Object.entries(PHOTO_INFO)) {
      expect(info.loja, file).toBe(Boolean(STORE[file]))
      expect(info.fit, file).toBe(STORE[file]?.fit ?? 'cover')
    }
  })

  it('fotos inteiras nos cartões quadrados: as artes com texto e as embalagens que o corte tiraria (2026-11-16)', () => {
    expect(
      Object.entries(PHOTO_INFO)
        .filter(([, info]) => info.fit === 'contain')
        .map(([file]) => file)
        .sort(),
    ).toEqual([
      'combo-1-litro.jpg',
      'combo-de-sorvete.jpg',
      'fini-gelatinas.jpg',
      'kit-completo-casquinha-duo.jpg',
      'picole-gourmet.jpg',
      'refrigerante-350ml.jpg',
    ])
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
    const expected = [...USED_CATALOG_FILES].flatMap((name) => {
      const base = name.replace(/\.(jpg|png)$/, '')
      return [name, `${base}-480.webp`, `${base}-960.webp`]
    })
    expect(readdirSync(CATALOG).sort()).toEqual(expected.sort())
  })

  it('fotos do cardápio da loja: cada uma vem de uma captura guardada em assets/fotos-loja/whatsapp', () => {
    const captures = readdirSync(join(ROOT, 'assets', 'fotos-loja', 'whatsapp'))
    // As 73 capturas do pedido de 2026-11-16, todas guardadas no projeto.
    expect(captures.filter((file) => file.startsWith('Captura de tela 2026-11-16'))).toHaveLength(73)
    const used = new Set<string>()
    for (const [file, entry] of Object.entries(STORE)) {
      expect(USED_CATALOG_FILES.has(file), `${file} sem uso`).toBe(true)
      expect(captures.some((name) => name.includes(` ${entry.captura}.`)), `${file}: captura ${entry.captura}`).toBe(true)
      expect(used.has(entry.captura), `captura ${entry.captura} usada duas vezes`).toBe(false)
      used.add(entry.captura)
      const item = EXTRA_ITEMS.find((candidate) => candidate.id === entry.item)
      expect(item, `${file}: item ${entry.item}`).toBeDefined()
      const image = `images/catalogo/${file}`
      if (entry.sabor) {
        const group = choiceGroupsOf(item!).find((candidate) => candidate.photos?.[entry.sabor!] === image)
        expect(group, `${file}: foto do sabor ${entry.sabor}`).toBeDefined()
        if (entry.principal) expect(item!.image, file).toBe(image)
      } else {
        expect(item!.image, file).toBe(image)
      }
    }
    // As que ficaram de fora estão anotadas, com o motivo: 60 em uso + 13 de fora = 73.
    expect(used.size + Object.keys(WHATSAPP.naoUsadas).length).toBe(73)
  })

  it('fotos de banco que sobraram: fonte, autor e licença de uso comercial (créditos em /creditos)', () => {
    const bank = [...USED_CATALOG_FILES].filter((file) => !STORE[file]).sort()
    expect(Object.keys(SOURCES).sort()).toEqual(bank)
    for (const [file, source] of Object.entries(SOURCES)) {
      expect(EXTRA_ITEMS.find((item) => item.id === source.item)?.image, file).toBe(`images/catalogo/${file}`)
      expect(source.autor?.trim(), `${file}: autor`).toBeTruthy()
      expect(COMMERCIAL_LICENSES, `${file}: ${source.licenca}`).toContain(source.licenca)
      expect(source.pagina, `${file}: página`).toMatch(/^https:\/\//)
      expect(source.download, `${file}: download`).toMatch(/^https:\/\//)
    }
  })

  it('as fotos de banco que saíram ficaram guardadas em assets/catalogo-banco-anteriores', () => {
    const archived = readdirSync(join(ROOT, 'assets', 'catalogo-banco-anteriores'))
    for (const file of Object.keys(catalog._anteriores)) expect(archived, file).toContain(file)
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
