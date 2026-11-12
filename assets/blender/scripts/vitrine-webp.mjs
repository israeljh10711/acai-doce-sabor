// Converte os renders da vitrine (assets/blender/vitrine/*.png) nas imagens leves do site
// (src/assets/showcase/<nome>-<largura>.webp), com fundo transparente:
//   - um por cartão (acai-oca, acai-tradicional, milk-shake), em 480 e 960 px;
//   - o destaque da página inicial, em 800 e 1600 px.
// Converte só os renders que existirem.
//
// Usa a biblioteca `sharp`, que não é dependência do projeto. Na pasta do projeto:
//   npm install --no-save sharp
//   node assets/blender/scripts/vitrine-webp.mjs
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const project = join(here, '..', '..', '..')
const input = join(project, 'assets', 'blender', 'vitrine')
const output = join(project, 'src', 'assets', 'showcase')
mkdirSync(output, { recursive: true })

const jobs = [
  ...['acai-oca', 'acai-tradicional', 'milk-shake'].map((name) => ({ name, widths: [480, 960] })),
  // o destaque perde as bordas transparentes: os produtos ficam maiores no mesmo espaço
  { name: 'destaque', widths: [800, 1386], trim: true },
]

for (const { name, widths, trim } of jobs) {
  const source = join(input, `${name}.png`)
  if (!existsSync(source)) {
    console.log(`${name}: sem render, pulado`)
    continue
  }
  const image = trim ? await cropToVisible(source) : source
  if (trim) {
    const { width, height } = await sharp(image).metadata()
    console.log(`${name}: recortado para ${width} x ${height}`)
  }
  for (const width of widths) {
    const file = join(output, `${name}-${width}.webp`)
    await sharp(image)
      .resize({ width })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(file)
    console.log(`${name}-${width}.webp  ${(statSync(file).size / 1024).toFixed(1)} KB`)
  }
}

/**
 * Corta a imagem na área visível de verdade (opacidade acima de 10%), com uma folga de 3%.
 * A sombra no chão se espalha pela imagem inteira com opacidade quase zero, por isso o corte
 * automático do sharp (trim) não serve aqui.
 */
async function cropToVisible(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let left = info.width
  let top = info.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 25) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.03)
  const region = {
    left: Math.max(0, left - pad),
    top: Math.max(0, top - pad),
    width: Math.min(info.width, right + pad + 1) - Math.max(0, left - pad),
    height: Math.min(info.height, bottom + pad + 1) - Math.max(0, top - pad),
  }
  return sharp(source).extract(region).toBuffer()
}
