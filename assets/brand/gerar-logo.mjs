// Gera os arquivos da logo usados pelo site, a partir do original recebido do proprietário.
//
// O original (`logo-original.jpg`, 1600 x 1600) é um JPG com o xadrez "de transparência"
// desenhado no fundo. Aqui o círculo da logo é recortado e ganha transparência de verdade.
//
// Saídas:
//   src/assets/brand/logo-<px>.webp          logo inteira, disco de borda nítida (qualquer fundo)
//   src/assets/brand/logo-soft-<px>.webp     logo inteira, borda esfumada (fundo roxo da marca)
//   src/assets/brand/symbol-soft-<px>.webp   só a tigela com as folhas, borda esfumada (cabeçalho)
//   public/favicon-32.png                    tigela com as folhas, disco nítido
//   public/favicon-192.png                   logo inteira
//   public/apple-touch-icon.png              logo inteira sobre quadrado na cor da marca
//   assets/brand/logo-recortada.png          cópia mestra recortada
//
// Só precisa rodar de novo se a logo mudar. Usa a biblioteca `sharp`, que não é dependência
// do projeto. Para rodar, na pasta do projeto:
//   npm install --no-save sharp
//   node assets/brand/gerar-logo.mjs
//
// Se chegar um arquivo novo da logo, confira as medidas em FULL e SYMBOL antes de rodar.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const projectDir = join(here, '..', '..')
const source = join(here, 'logo-original.jpg')

/** Roxo do fundo da logo, medido no arquivo original. */
const BRAND = '#69054f'

// Medidas tiradas do arquivo original, em pixels.
const FULL = { cx: 799.5, cy: 799.5, r: 637 } // círculo da logo, 3 px para dentro da borda
const SYMBOL = { cx: 802, cy: 685, r: 330 } // tigela com as folhas, sem encostar no texto

const hardMask = (r) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  )

// Opaco até "start" do raio e transparente na borda: some no fundo roxo sem deixar contorno.
const softMask = (r, start) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r * 2}" height="${r * 2}"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="${start}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  )

const cut = ({ cx, cy, r }, mask) =>
  sharp(source)
    .extract({ left: Math.round(cx - r), top: Math.round(cy - r), width: r * 2, height: r * 2 })
    .ensureAlpha()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()

const fullHard = await cut(FULL, hardMask(FULL.r))
const fullSoft = await cut(FULL, softMask(FULL.r, 0.9))
const symbolHard = await cut(SYMBOL, hardMask(SYMBOL.r))
const symbolSoft = await cut(SYMBOL, softMask(SYMBOL.r, 0.88))

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

await webp(fullHard, 'logo', [96, 192, 384])
await webp(fullSoft, 'logo-soft', [384, 768])
await webp(symbolSoft, 'symbol-soft', [96, 192])

const png = async (input, file, px) => {
  await sharp(input).resize(px, px).png({ compressionLevel: 9 }).toFile(file)
  report(file)
}
await png(symbolHard, join(publicDir, 'favicon-32.png'), 32)
await png(fullHard, join(publicDir, 'favicon-192.png'), 192)

// Ícone de tela inicial do iPhone: quadrado opaco, na cor da marca, com a logo dentro.
const touch = join(publicDir, 'apple-touch-icon.png')
await sharp({ create: { width: 180, height: 180, channels: 4, background: BRAND } })
  .composite([{ input: await sharp(fullHard).resize(164, 164).toBuffer(), gravity: 'centre' }])
  .png({ compressionLevel: 9 })
  .toFile(touch)
report(touch)

await png(fullHard, join(here, 'logo-recortada.png'), FULL.r * 2)
