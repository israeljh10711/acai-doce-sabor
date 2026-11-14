/**
 * Prepara as fotos do site.
 *
 * Uso (na pasta do projeto):
 *   npm install --no-save sharp
 *   node scripts/fotos/preparar.mjs [loja | miniaturas | produtos] [arquivos...]
 *
 * Com nomes de arquivo depois de `loja`, refaz só essas fotos (as outras ficam como estão).
 *
 * - `loja`: as fotos de ingredientes e embalagens enviadas em 2026-11-14 (`assets/fotos-loja/`).
 *   Saem em `public/images/ingredientes/` com o mesmo nome, só limpas: tira o ícone do Google
 *   Lens que veio no canto de três delas e troca o fundo xadrez (falsa transparência) por branco.
 * - `miniaturas`: os ingredientes que ainda não têm foto enviada pela loja, a partir de fotos
 *   de banco com licença comercial (`fontes.json`), em `public/images/ingredientes/<id>.webp`.
 * - `produtos`: a foto fixa de cada produto, enviada pela loja (`assets/fotos-loja/produtos/`).
 *   Sai em `public/images/produtos/` só com a margem branca acertada: nada do produto é cortado.
 *
 * Os originais de banco são baixados uma vez para `scripts/fotos/.originais/` (fora do Git).
 * As imagens derivadas de fotos CC BY-SA seguem a mesma licença (ver `public/images/CREDITOS.md`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCES = JSON.parse(readFileSync(join(ROOT, 'scripts/fotos/fontes.json'), 'utf8'))
const CACHE = join(ROOT, 'scripts/fotos/.originais')
const STORE_PHOTOS = join(ROOT, 'assets/fotos-loja')
const OUT = join(ROOT, 'public/images')
const UA = 'acai-site-dev/0.1 (image licensing research)'

for (const dir of ['ingredientes', 'produtos']) mkdirSync(join(OUT, dir), { recursive: true })
mkdirSync(CACHE, { recursive: true })

/* ---------- Utilidades ---------- */

async function original(key) {
  const file = join(CACHE, `${key}.jpg`)
  if (!existsSync(file)) {
    const source = SOURCES[key]
    if (!source) throw new Error(`Fonte desconhecida: ${key}`)
    const response = await fetch(source.download, { headers: { 'User-Agent': UA } })
    if (!response.ok) throw new Error(`${key}: download falhou (${response.status})`)
    writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  }
  return file
}

/** Recorte quadrado: centro (cx, cy) e lado s, em frações do menor lado da foto. */
async function square(file, { cx, cy, s }) {
  const meta = await sharp(file).metadata()
  const side = Math.round(s * Math.min(meta.width, meta.height))
  const left = Math.max(0, Math.min(meta.width - side, Math.round(cx * meta.width - side / 2)))
  const top = Math.max(0, Math.min(meta.height - side, Math.round(cy * meta.height - side / 2)))
  return sharp(file).extract({ left, top, width: side, height: side }).toBuffer()
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Troca o fundo xadrez (cinzas claros neutros que imitam transparência) por branco. Pinta só o
 * que está ligado à borda da foto, para não clarear partes brancas do próprio produto.
 */
async function whitenCheckerboard(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const isBackground = (p) => {
    const r = data[p * 3]
    const g = data[p * 3 + 1]
    const b = data[p * 3 + 2]
    return Math.min(r, g, b) >= 228 && Math.max(r, g, b) - Math.min(r, g, b) <= 8
  }
  const seen = new Uint8Array(width * height)
  const stack = []
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x)
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1)
  while (stack.length) {
    const p = stack.pop()
    if (seen[p] || !isBackground(p)) continue
    seen[p] = 1
    data[p * 3] = data[p * 3 + 1] = data[p * 3 + 2] = 255
    const x = p % width
    if (x > 0) stack.push(p - 1)
    if (x < width - 1) stack.push(p + 1)
    if (p >= width) stack.push(p - width)
    if (p < width * (height - 1)) stack.push(p + width)
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

/** Tira um fundo de cor lisa (branco) de uma peça recortada e devolve a peça com transparência. */
async function cutPiece(input, { background, from, to, region }) {
  const meta = await sharp(input).metadata()
  const extract = {
    left: Math.round(region.x * meta.width),
    top: Math.round(region.y * meta.height),
    width: Math.round(region.w * meta.width),
    height: Math.round(region.h * meta.height),
  }
  const { data, info } = await sharp(input).extract(extract).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i++) {
    const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]]
    const alpha = smoothstep(from, to, Math.hypot(r - background[0], g - background[1], b - background[2]))
    const pure = (value, bg) => (alpha > 0.02 ? Math.min(255, Math.max(0, (value - (1 - alpha) * bg) / alpha)) : 0)
    out[i * 4] = pure(r, background[0])
    out[i * 4 + 1] = pure(g, background[1])
    out[i * 4 + 2] = pure(b, background[2])
    out[i * 4 + 3] = Math.round(alpha * 255)
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png().toBuffer()
}

/* ---------- Fotos enviadas pela loja ---------- */

/**
 * Limpeza de cada foto: recorte (frações), fundo xadrez e margem branca. As embalagens perdem a
 * margem branca em volta (`trim`), para aparecerem maiores no quadro do cartão.
 */
const STORE_FIXES = {
  // Ícone do Google Lens no canto inferior esquerdo: corta a faixa de baixo.
  'leite-em-po.png': { crop: { x: 0, y: 0, w: 1, h: 0.87 }, trim: true },
  'farinha-lactea.png': { crop: { x: 0, y: 0, w: 1, h: 0.87 }, checkerboard: true, trim: true },
  'amendoim.png': { crop: { x: 0.24, y: 0, w: 0.76, h: 1 } },
  'leite-condensado.png': { trim: true },
  'cobertura-banana-caramelada.png': { checkerboard: true, trim: true },
  'cobertura-frutas-vermelhas.png': { trim: true },
  'cobertura-doce-de-leite.png': { trim: true },
  'cobertura-acai.png': { trim: true },
  'cobertura-chocolate.png': { trim: true },
  'cobertura-morango.png': { trim: true },
}

async function storePhotos(only = []) {
  const listed = readFileSync(join(STORE_PHOTOS, 'LEIA-ME.md'), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\| `([\w-]+\.png)` \|/)?.[1])
    .filter(Boolean)
  for (const file of only) if (!listed.includes(file)) throw new Error(`${file} não está na tabela do LEIA-ME`)
  const files = only.length ? only : listed
  for (const file of files) {
    const fix = STORE_FIXES[file] ?? {}
    let image = await sharp(join(STORE_PHOTOS, file)).removeAlpha().png().toBuffer()
    if (fix.crop) {
      const meta = await sharp(image).metadata()
      image = await sharp(image)
        .extract({
          left: Math.round(fix.crop.x * meta.width),
          top: Math.round(fix.crop.y * meta.height),
          width: Math.round(fix.crop.w * meta.width),
          height: Math.round(fix.crop.h * meta.height),
        })
        .toBuffer()
    }
    if (fix.checkerboard) image = await whitenCheckerboard(image)
    if (fix.trim) {
      // Tira a margem branca e devolve uma borda fina, igual nos quatro lados.
      image = await sharp(image).trim({ background: '#ffffff', threshold: 12 }).toBuffer()
      const meta = await sharp(image).metadata()
      const pad = Math.round(Math.max(meta.width, meta.height) * 0.03)
      image = await sharp(image).extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' }).toBuffer()
    }
    // Cores completas: `effort` no PNG liga a paleta de 256 cores do sharp e estraga a foto.
    await sharp(image).png({ compressionLevel: 9, palette: false }).toFile(join(OUT, 'ingredientes', file))
  }
  console.log('fotos da loja ok:', files.length)
}

/* ---------- Ingredientes sem foto da loja ---------- */

/** Recorte quadrado de cada foto de banco (lado em fração do menor lado da foto). */
const THUMBS = {
  granola: { cx: 0.49, cy: 0.53, s: 0.5 },
  'gotas-de-chocolate': { cx: 0.66, cy: 0.46, s: 0.62 },
  canudinho: { cx: 0.42, cy: 0.42, s: 0.72 },
  sucrilhos: { cx: 0.5, cy: 0.5, s: 0.7 },
  kiwi: { cx: 0.42, cy: 0.52, s: 0.62 },
  morango: { cx: 0.42, cy: 0.5, s: 0.7 },
  cereja: { cx: 0.5, cy: 0.45, s: 0.78 },
}

/** Barras em fundo branco (BIS e Kit Kat): a peça vai para o centro de um quadrado claro. */
const BARS = {
  bis: { region: { x: 0, y: 0, w: 0.5, h: 1 } },
  'kit-kat': { region: { x: 0.55, y: 0, w: 0.45, h: 1 } },
}

async function thumbnails() {
  for (const [key, crop] of Object.entries(THUMBS)) {
    await sharp(await square(await original(key), crop))
      .resize(256, 256)
      .webp({ quality: 82, effort: 6 })
      .toFile(join(OUT, 'ingredientes', `${key}.webp`))
  }
  for (const [key, { region }] of Object.entries(BARS)) {
    const piece = await cutPiece(await original(key), { background: [255, 255, 255], from: 22, to: 60, region })
    const fitted = await sharp(piece).resize(200, 200, { fit: 'inside' }).toBuffer()
    const meta = await sharp(fitted).metadata()
    await sharp({ create: { width: 256, height: 256, channels: 3, background: '#f6f1f5' } })
      .composite([{ input: fitted, left: Math.round((256 - meta.width) / 2), top: Math.round((256 - meta.height) / 2) }])
      .webp({ quality: 82, effort: 6 })
      .toFile(join(OUT, 'ingredientes', `${key}.webp`))
  }
  console.log('miniaturas ok:', Object.keys(THUMBS).length + Object.keys(BARS).length)
}

/* ---------- Fotos dos produtos ---------- */

/**
 * Foto fixa de cada produto, enviada pela loja em 2026-11-14. Tira a margem branca e devolve uma
 * borda branca igual nos quatro lados: o produto aparece inteiro e centralizado, sem recorte.
 * Sai em PNG (o arquivo de referência, até 1200 px) e em WebP de 480 e 960 px de largura, mais
 * leves, que o navegador escolhe pelo tamanho da tela.
 */
const PRODUCT_PHOTOS = ['acai-oca', 'acai-tradicional', 'acai-batido', 'milkshake']

async function products() {
  for (const name of PRODUCT_PHOTOS) {
    const trimmed = await sharp(join(STORE_PHOTOS, 'produtos', `${name}.jpg`))
      .trim({ background: '#ffffff', threshold: 12 })
      .toBuffer()
    const meta = await sharp(trimmed).metadata()
    const pad = Math.round(Math.max(meta.width, meta.height) * 0.04)
    const framed = await sharp(trimmed)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
      .toBuffer()
    const png = join(OUT, 'produtos', `${name}.png`)
    await sharp(framed).resize(1200, 1200, { fit: 'inside' }).png({ compressionLevel: 9, palette: false }).toFile(png)
    for (const width of [480, 960]) {
      await sharp(framed).resize({ width }).webp({ quality: 82, effort: 6 }).toFile(join(OUT, 'produtos', `${name}-${width}.webp`))
    }
    const size = await sharp(png).metadata()
    console.log(`${name}.png: ${size.width}x${size.height}`)
  }
  console.log('produtos ok:', PRODUCT_PHOTOS.length)
}

/* ---------- Execução ---------- */

const only = process.argv[2]
if (!only || only === 'loja') await storePhotos(process.argv.slice(3))
if (!only || only === 'miniaturas') await thumbnails()
if (!only || only === 'produtos') await products()
