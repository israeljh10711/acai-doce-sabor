// Gera os arquivos da logo usados pelo site, a partir do original recebido do proprietário.
//
// O original (`logo-original.jpg`, 1600 x 1600) é um JPG com o xadrez "de transparência"
// desenhado no fundo. Aqui a logo ganha transparência de verdade, de duas formas:
//
//   - com o disco roxo, recortado em círculo (serve em qualquer fundo);
//   - sem o disco: o roxo do fundo é removido e ficam só a tigela, as folhas e o nome.
//     Essa versão vai sobre o roxo do site e não deixa contorno nem halo.
//
// Saídas:
//   src/assets/brand/logo-<px>.webp          logo inteira, com o disco
//   src/assets/brand/logo-clean-<px>.webp    logo inteira, sem o disco
//   src/assets/brand/symbol-clean-<px>.webp  só a tigela com as folhas, sem o disco
//   public/favicon-32.png, favicon-192.png, favicon-512.png   tigela com as folhas, em círculo
//   public/apple-touch-icon.png              tigela com as folhas, em quadrado opaco
//   assets/brand/logo-recortada.png          cópia mestra com o disco
//   assets/brand/logo-sem-fundo.png          cópia mestra sem o disco
//
// Só precisa rodar de novo se a logo mudar. Usa a biblioteca `sharp`, que não é dependência
// do projeto. Para rodar, na pasta do projeto:
//   npm install --no-save sharp
//   node assets/brand/gerar-logo.mjs
//
// Se chegar um arquivo novo da logo, confira as medidas abaixo antes de rodar.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const projectDir = join(here, '..', '..')
const source = join(here, 'logo-original.jpg')

// Medidas tiradas do arquivo original, em pixels.
const DISC = { cx: 799.5, cy: 799.5, r: 637 } // círculo da logo, 3 px para dentro da borda
const ARTWORK = { cx: 800, cy: 812, half: 520 } // tigela, folhas e nome
const SYMBOL = { cx: 802, cy: 685, half: 330 } // tigela com as folhas, sem encostar no nome

/** Roxo do disco no arquivo original. Usado só para remover o fundo. */
const DISC_COLOR = [0x69, 0x05, 0x4f]

// Um pixel a menos de LOW da cor do disco vira transparente; a mais de HIGH fica opaco.
const LOW = 14
const HIGH = 44

const extract = ({ cx, cy, half }) =>
  sharp(source)
    .extract({ left: Math.round(cx - half), top: Math.round(cy - half), width: half * 2, height: half * 2 })
    .ensureAlpha()

/** Recorte em círculo, com o disco roxo. */
async function withDisc({ cx, cy, r }) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  )
  return extract({ cx, cy, half: r }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

/** Recorte sem o disco: remove o roxo do fundo e tudo o que está fora do círculo da logo. */
async function withoutDisc(area) {
  const size = area.half * 2
  const { data } = await extract(area).raw().toBuffer({ resolveWithObject: true })
  const left = Math.round(area.cx - area.half)
  const top = Math.round(area.cy - area.half)
  const limit = DISC.r - 8

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      let alpha = 0

      if (Math.hypot(left + x + 0.5 - DISC.cx, top + y + 0.5 - DISC.cy) <= limit) {
        const distance = Math.max(
          Math.abs(data[i] - DISC_COLOR[0]),
          Math.abs(data[i + 1] - DISC_COLOR[1]),
          Math.abs(data[i + 2] - DISC_COLOR[2]),
        )
        const t = Math.min(1, Math.max(0, (distance - LOW) / (HIGH - LOW)))
        alpha = t * t * (3 - 2 * t)
      }

      // Nas bordas, devolve a cor do desenho sem a parte de roxo que estava misturada nela.
      if (alpha > 0 && alpha < 1) {
        for (let c = 0; c < 3; c++) {
          const front = (data[i + c] - (1 - alpha) * DISC_COLOR[c]) / alpha
          data[i + c] = Math.max(0, Math.min(255, Math.round(front)))
        }
      }
      data[i + 3] = Math.round(alpha * 255)
    }
  }

  return sharp(data, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
}

const logoDisc = await withDisc(DISC)
const symbolDisc = await withDisc({ cx: SYMBOL.cx, cy: SYMBOL.cy, r: SYMBOL.half })
const logoClean = await withoutDisc(ARTWORK)
const symbolClean = await withoutDisc(SYMBOL)
const symbolSquare = await extract(SYMBOL).png().toBuffer()

const brandDir = join(projectDir, 'src', 'assets', 'brand')
const publicDir = join(projectDir, 'public')
mkdirSync(brandDir, { recursive: true })
for (const old of readdirSync(brandDir)) rmSync(join(brandDir, old))

const report = (file) =>
  console.log(
    `${file.replace(projectDir, '').replaceAll('\\', '/')}  ${(statSync(file).size / 1024).toFixed(1)} KB`,
  )

const webp = async (input, name, sizes) => {
  for (const px of sizes) {
    const file = join(brandDir, `${name}-${px}.webp`)
    await sharp(input).resize(px, px).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(file)
    report(file)
  }
}

await webp(logoDisc, 'logo', [96, 192, 384])
await webp(logoClean, 'logo-clean', [384, 768])
await webp(symbolClean, 'symbol-clean', [96, 192])

const png = async (input, file, px) => {
  await sharp(input).resize(px, px).png({ compressionLevel: 9 }).toFile(file)
  report(file)
}

for (const old of ['favicon.svg']) rmSync(join(publicDir, old), { force: true })
await png(symbolDisc, join(publicDir, 'favicon-32.png'), 32)
await png(symbolDisc, join(publicDir, 'favicon-192.png'), 192)
await png(symbolDisc, join(publicDir, 'favicon-512.png'), 512)
await png(symbolSquare, join(publicDir, 'apple-touch-icon.png'), 180)

await png(logoDisc, join(here, 'logo-recortada.png'), DISC.r * 2)
await png(logoClean, join(here, 'logo-sem-fundo.png'), ARTWORK.half * 2)
