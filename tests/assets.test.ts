/**
 * As fotos que o site usa existem de verdade em public/images: nenhum cartão fica com imagem
 * quebrada. Também confere que as fotos enviadas pela loja estão todas em uso e que não sobra
 * foto sem uso (como a do Biscoito, que saiu do cardápio).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOPPINGS } from '../src/features/catalog/menu.ts'
import { ALL_PRODUCT_PHOTOS, ingredientFile } from '../src/features/catalog/photos.ts'

const ROOT = join(import.meta.dirname, '..')
const IMAGES = join(ROOT, 'public', 'images')

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
      for (const width of [480, 960]) {
        expect(existsSync(join(IMAGES, 'produtos', `${photo.name}-${width}.webp`)), `${photo.name}-${width}`).toBe(true)
      }
    }
  })

  it('as 4 fotos de produto enviadas pela loja estão em uso, e só elas', () => {
    const sent = readdirSync(join(ROOT, 'assets', 'fotos-loja', 'produtos')).filter((file) => file.endsWith('.jpg'))
    const names = ALL_PRODUCT_PHOTOS.map((photo) => photo.name).sort()
    expect(sent.map((file) => file.replace(/\.jpg$/, '')).sort()).toEqual(names)
    const published = names.flatMap((name) => [`${name}.png`, `${name}-480.webp`, `${name}-960.webp`]).sort()
    expect(readdirSync(join(IMAGES, 'produtos')).sort()).toEqual(published)
  })
})
