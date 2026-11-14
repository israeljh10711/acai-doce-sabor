/**
 * As fotos que o site usa existem de verdade em public/images: nenhum cartão fica com imagem
 * quebrada. Também confere que as fotos enviadas pela loja estão todas em uso.
 */
import { existsSync, readdirSync } from 'node:fs'
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

  it('as 17 fotos enviadas pela loja estão em public/images/ingredientes e todas em uso', () => {
    const sent = readdirSync(join(ROOT, 'assets', 'fotos-loja')).filter((file) => file.endsWith('.png'))
    const used = new Set(TOPPINGS.map((topping) => ingredientFile(topping)))
    expect(sent).toHaveLength(17)
    for (const file of sent) {
      expect(existsSync(join(IMAGES, 'ingredientes', file)), file).toBe(true)
      expect(used.has(file), `${file} sem uso`).toBe(true)
    }
  })

  it('a foto de cada produto existe nos dois tamanhos', () => {
    for (const photo of ALL_PRODUCT_PHOTOS) {
      for (const size of [400, 800]) {
        expect(existsSync(join(IMAGES, 'products', `${photo.name}-${size}.webp`)), `${photo.name}-${size}`).toBe(true)
      }
    }
  })
})
