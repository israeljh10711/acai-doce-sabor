// Converte os renders da vitrine (assets/blender/vitrine/*.png) nas imagens leves do site
// (src/assets/showcase/<categoria>-<largura>.webp), com fundo transparente.
//
// Usa a biblioteca `sharp`, que não é dependência do projeto. Na pasta do projeto:
//   npm install --no-save sharp
//   node assets/blender/scripts/vitrine-webp.mjs
import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const project = join(here, '..', '..', '..')
const input = join(project, 'assets', 'blender', 'vitrine')
const output = join(project, 'src', 'assets', 'showcase')
mkdirSync(output, { recursive: true })

for (const slug of ['acai-oca', 'acai-tradicional', 'milk-shake']) {
  for (const width of [480, 960]) {
    const file = join(output, `${slug}-${width}.webp`)
    await sharp(join(input, `${slug}.png`))
      .resize({ width })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(file)
    console.log(`${slug}-${width}.webp  ${(statSync(file).size / 1024).toFixed(1)} KB`)
  }
}
