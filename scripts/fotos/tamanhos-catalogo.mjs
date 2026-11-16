/**
 * Escreve `src/features/catalog/catalogPhotos.json`: o tamanho real das cópias de cada foto do
 * cardápio (`-480.webp` e `-960.webp`) e o enquadramento no cartão. O site usa isso para o
 * `srcset` (larguras de verdade) e para a foto ampliada não passar do tamanho real.
 *
 * As fotos de banco são quadradas (480 e 960 px). As fotos da loja tiradas do WhatsApp são
 * menores e em pé: as duas cópias ficam no tamanho que a foto tem (nunca ampliadas).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

export async function writeCatalogPhotoInfo(root) {
  const dir = join(root, 'public', 'images', 'catalogo')
  const whatsapp = JSON.parse(readFileSync(join(root, 'scripts', 'fotos', 'whatsapp.json'), 'utf8')).fotos
  const masters = readdirSync(dir).filter((file) => /\.(jpg|png)$/.test(file)).sort()
  const info = {}
  for (const file of masters) {
    const base = file.replace(/\.(jpg|png)$/, '')
    const size = async (width) => {
      const meta = await sharp(join(dir, `${base}-${width}.webp`)).metadata()
      return [meta.width, meta.height]
    }
    info[file] = {
      480: await size(480),
      960: await size(960),
      fit: whatsapp[file]?.fit ?? 'cover',
      loja: Boolean(whatsapp[file]),
    }
  }
  // Uma linha por foto: fácil de ler e de comparar no Git.
  const lines = Object.entries(info).map(([file, value]) => `  ${JSON.stringify(file)}: ${JSON.stringify(value)}`)
  writeFileSync(join(root, 'src', 'features', 'catalog', 'catalogPhotos.json'), `{\n${lines.join(',\n')}\n}\n`)
  console.log('catalogPhotos.json:', masters.length, 'fotos')
}
