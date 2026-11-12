// Converte as miniaturas dos ingredientes (assets/blender/miniaturas/*.png, de miniaturas.py)
// nas imagens do site: src/assets/ingredientes/<id>.webp, com 192 px e fundo transparente.
// Elas aparecem com 56 a 64 px; 192 px cobre telas de alta densidade.
//
// Usa a biblioteca `sharp`, que não é dependência do projeto. Na pasta do projeto:
//   npm install --no-save sharp
//   node assets/blender/scripts/miniaturas-webp.mjs
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const project = join(here, '..', '..', '..')
const input = join(project, 'assets', 'blender', 'miniaturas')
const output = join(project, 'src', 'assets', 'ingredientes')
mkdirSync(output, { recursive: true })

let total = 0
for (const name of readdirSync(input).filter((file) => file.endsWith('.png'))) {
  const file = join(output, `${basename(name, '.png')}.webp`)
  await sharp(join(input, name)).resize({ width: 192 }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(file)
  total += statSync(file).size
}
console.log(`${readdirSync(output).length} miniaturas, ${(total / 1024).toFixed(1)} KB no total`)
