/**
 * Prepara as fotos do site.
 *
 * Uso (na pasta do projeto):
 *   npm install --no-save sharp
 *   node scripts/fotos/preparar.mjs [loja | miniaturas | produtos | catalogo] [arquivos...]
 *
 * Com nomes de arquivo depois de `loja`, ou de produto depois de `produtos` (ex.: `milkshake`),
 * refaz só esses (os outros ficam como estão).
 *
 * - `loja`: as fotos de ingredientes e embalagens enviadas em 2026-11-14 (`assets/fotos-loja/`).
 *   Saem em `public/images/ingredientes/` com o mesmo nome, só limpas: tira o ícone do Google
 *   Lens que veio no canto de três delas e troca o fundo xadrez (falsa transparência) por branco.
 * - `miniaturas`: os ingredientes que ainda não têm foto enviada pela loja, a partir de fotos
 *   de banco com licença comercial (`fontes.json`), em `public/images/ingredientes/<id>.webp`.
 * - `produtos`: a foto fixa de cada produto, enviada pela loja (`assets/fotos-loja/produtos/`).
 *   Sai em `public/images/produtos/` só com a margem branca acertada: nada do produto é cortado.
 *
 * - `catalogo` (só quando pedido): as fotos dos 43 itens das gavetas, de bancos com licença
 *   comercial (`catalogo.json`), em `public/images/catalogo/`. Ver a seção "Fotos do cardápio".
 *
 * Os originais de banco são baixados uma vez para `scripts/fotos/.originais/` (fora do Git).
 * As imagens derivadas de fotos CC BY-SA seguem a mesma licença (ver `public/images/CREDITOS.md`).
 */
import { createHash } from 'node:crypto'
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
 * Tira o fundo branco de uma foto e devolve PNG com transparência de verdade (canal alfa).
 * O fundo é o branco ligado à borda da foto (enchimento a partir das bordas): o branco de dentro
 * do produto, como o da tampa, fica. Numa faixa fina em volta do fundo, a transparência cresce
 * com a distância do branco e a cor é separada do branco, para não sobrar contorno claro sobre
 * fundo escuro. `fill`: até onde é fundo (255 - menor canal); `edge`: onde já é produto;
 * `band`: largura da faixa, em pixels.
 *
 * `clearLid`: a tampa é de plástico transparente (através dela se vê o fundo branco). Da ponta de
 * cima até logo abaixo de onde o conteúdo do copo aparece, tudo o que está dentro do contorno da
 * tampa fica translúcido: quanto mais perto do branco, mais transparente, com um mínimo
 * (`lidFloor`) que mantém o brilho do plástico. Sobre fundo branco, volta a ser a foto original.
 */
async function removeWhiteBackground(
  file,
  { fill = 14, edge = 60, band = 6, clearLid = false, lidFloor = 0.18, lidLo = 8, lidHi = 90 } = {},
) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const N = W * H
  const dist = new Uint8Array(N)
  for (let p = 0; p < N; p++) dist[p] = 255 - Math.min(data[p * 3], data[p * 3 + 1], data[p * 3 + 2])

  const background = new Uint8Array(N)
  const stack = []
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x)
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1)
  while (stack.length) {
    const p = stack.pop()
    if (background[p] || dist[p] > fill) continue
    background[p] = 1
    const x = p % W
    if (x > 0) stack.push(p - 1)
    if (x < W - 1) stack.push(p + 1)
    if (p >= W) stack.push(p - W)
    if (p < N - W) stack.push(p + W)
  }

  // Distância (em pixels, 8 vizinhos) até o fundo, só até a largura da faixa.
  const near = new Uint8Array(N).fill(255)
  for (let p = 0; p < N; p++) if (background[p]) near[p] = 0
  for (let step = 1; step <= band; step++) {
    const next = near.slice()
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (near[p] !== 255) continue
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && near[ny * W + nx] === step - 1) next[p] = step
          }
        }
      }
    }
    near.set(next)
  }

  // Tampa transparente: do topo até um pouco abaixo de onde o conteúdo aparece no meio do copo.
  let lidBottom = 0
  if (clearLid) {
    let [x0, x1] = [W, -1]
    for (let p = 0; p < N; p++) {
      if (background[p]) continue
      x0 = Math.min(x0, p % W)
      x1 = Math.max(x1, p % W)
    }
    const center = Math.round((x0 + x1) / 2)
    let contentTop = 0
    while (contentTop < H && dist[contentTop * W + center] <= 150) contentTop++
    lidBottom = contentTop + Math.round(0.03 * H)
  }
  // Contorno da tampa em cada linha: do primeiro ao último pixel que não é fundo.
  const lidSpan = (y) => {
    let [left, right] = [-1, -1]
    for (let x = 0; x < W; x++) {
      if (dist[y * W + x] <= fill) continue
      if (left < 0) left = x
      right = x
    }
    return [left, right]
  }

  const out = Buffer.alloc(N * 4)
  let span = [-1, -1]
  for (let p = 0; p < N; p++) {
    const x = p % W
    const y = (p - x) / W
    let alpha
    if (y < lidBottom) {
      if (x === 0) span = lidSpan(y)
      const [left, right] = span
      const inside = left < 0 || x < left || x > right ? -1 : Math.min(x - left, right - x)
      alpha = inside < 0 ? 0 : Math.max(lidFloor * Math.min(1, inside / 3), smoothstep(lidLo, lidHi, dist[p]))
    } else {
      alpha = background[p] ? 0 : near[p] <= band ? smoothstep(fill, edge, dist[p]) : 1
    }
    for (let c = 0; c < 3; c++) {
      const value = data[p * 3 + c]
      out[p * 4 + c] = alpha > 0.02 ? Math.max(0, Math.min(255, Math.round((value - (1 - alpha) * 255) / alpha))) : 0
    }
    out[p * 4 + 3] = Math.round(alpha * 255)
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer()
}

/** Recorta uma imagem com transparência no menor retângulo que contém o que não é transparente. */
async function trimTransparent(input) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true })
  let [left, top, right, bottom] = [info.width, info.height, -1, -1]
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] === 0) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  return sharp(input).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).png().toBuffer()
}

/**
 * Foto fixa de cada produto, enviada pela loja em 2026-11-14. Tira a margem branca e devolve uma
 * borda igual nos quatro lados: o produto aparece inteiro e centralizado, sem recorte. A borda é
 * branca, ou transparente nas fotos com `transparent` (fundo removido, para aparecer recortada
 * sobre o roxo). Sai em PNG (o arquivo de referência, até 1200 px) e em WebP de 480 e 960 px de
 * largura, mais leves, que o navegador escolhe pelo tamanho da tela (o WebP também guarda a
 * transparência).
 */
const PRODUCT_PHOTOS = {
  'acai-oca': {},
  'acai-tradicional': {},
  'acai-batido': {},
  // Pedido de 2026-11-14: milk-shake com fundo transparente; a tampa bolha é de plástico
  // transparente (foto enviada na noite de 2026-11-14).
  milkshake: { transparent: true, clearLid: true },
}

/** Original de cada produto em `assets/fotos-loja/produtos/` (as fotos chegaram em JPG e WebP). */
function productSource(name) {
  for (const ext of ['jpg', 'webp', 'png']) {
    const file = join(STORE_PHOTOS, 'produtos', `${name}.${ext}`)
    if (existsSync(file)) return file
  }
  throw new Error(`Sem foto original para ${name} em assets/fotos-loja/produtos/`)
}

async function products(only = []) {
  for (const name of only) if (!(name in PRODUCT_PHOTOS)) throw new Error(`Produto desconhecido: ${name}`)
  const names = only.length ? only : Object.keys(PRODUCT_PHOTOS)
  for (const name of names) {
    const source = productSource(name)
    const { transparent, clearLid } = PRODUCT_PHOTOS[name]
    const trimmed = transparent
      ? await trimTransparent(await removeWhiteBackground(source, { clearLid }))
      : await sharp(source).trim({ background: '#ffffff', threshold: 12 }).toBuffer()
    const meta = await sharp(trimmed).metadata()
    const pad = Math.round(Math.max(meta.width, meta.height) * 0.04)
    const framed = await sharp(trimmed)
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : '#ffffff',
      })
      .toBuffer()
    const png = join(OUT, 'produtos', `${name}.png`)
    // Até 1200 px, sem ampliar uma foto menor (o PNG fica no tamanho real da foto enviada).
    await sharp(framed)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: false })
      .toFile(png)
    for (const width of [480, 960]) {
      await sharp(framed)
        .resize({ width })
        .webp({ quality: 82, alphaQuality: 100, effort: 6 })
        .toFile(join(OUT, 'produtos', `${name}-${width}.webp`))
    }
    const size = await sharp(png).metadata()
    console.log(`${name}.png: ${size.width}x${size.height}${size.hasAlpha ? ', com transparência' : ''}`)
  }
  console.log('produtos ok:', names.length)
}

/* ---------- Fotos do cardápio (os 43 itens das gavetas) ---------- */

/**
 * Pedido de 2026-11-15: uma foto de qualidade para cada item das gavetas, de bancos com licença
 * de uso comercial (fontes, autores e recortes em `catalogo.json`; créditos em /creditos). Saem em
 * `public/images/catalogo/`, sempre quadradas: o arquivo de referência com o nome do pedido (JPG
 * de até 1000 px; PNG de 800 px nas embalagens e nas composições) e as cópias leves
 * `<nome>-480.webp` e `<nome>-960.webp`, que o site usa.
 *
 * - `recorte`: foto de comida, recortada em quadrado (preenche o quadro).
 * - `inteira`: embalagem inteira sobre fundo branco, com margem (pode girar, nas balas em rolo).
 * - `composicao`: combos montados com fotos recortadas (pote, casquinhas e o frasco de cobertura
 *   que a loja enviou), vistos de cima sobre fundo de estúdio, com sombra suave.
 *
 * Só refaz o que pedir: `node scripts/fotos/preparar.mjs catalogo [arquivo...]`. Não mexe nas
 * fotos enviadas pela loja (só lê as das coberturas, para as composições).
 */
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'scripts/fotos/catalogo.json'), 'utf8'))
const CATALOG_OUT = join(OUT, 'catalogo')
const CATALOG_CACHE = join(CACHE, 'catalogo')
const MASTER_SIDE = { jpg: 1000, png: 800 }
const VARIANT_WIDTHS = [480, 960]

async function catalogOriginal(key, url) {
  mkdirSync(CATALOG_CACHE, { recursive: true })
  // O nome do arquivo guardado leva um resumo do endereço: trocar a fonte baixa a foto nova.
  const file = join(CATALOG_CACHE, `${key}-${createHash('sha1').update(url).digest('hex').slice(0, 10)}.img`)
  for (let attempt = 1; !existsSync(file); attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } })
    if (response.ok) {
      writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    } else if (response.status === 429 && attempt < 5) {
      // Muitos pedidos seguidos (Wikimedia): espera e tenta de novo.
      await new Promise((resolve) => setTimeout(resolve, attempt * 15000))
    } else {
      throw new Error(`${key}: download falhou (${response.status})`)
    }
  }
  // Gira conforme o EXIF (fotos de celular) antes de qualquer recorte.
  return sharp(file).rotate().toBuffer()
}

/** Quadrado de lado `s` (fração do menor lado) com centro em (cx, cy), frações da foto. */
async function squareOf(input, { cx, cy, s }) {
  const meta = await sharp(input).metadata()
  const side = Math.round(s * Math.min(meta.width, meta.height))
  const left = Math.max(0, Math.min(meta.width - side, Math.round(cx * meta.width - side / 2)))
  const top = Math.max(0, Math.min(meta.height - side, Math.round(cy * meta.height - side / 2)))
  return sharp(input).extract({ left, top, width: side, height: side }).toBuffer()
}

/**
 * Embalagem inteira, centralizada num quadrado branco (girada, se pedir). `margem`: fração do lado
 * que a embalagem pode ocupar (as balas em rolo, giradas, vão quase até a borda).
 */
async function wholeOnWhite(input, { girar = 0, margem = 0.84 }, side) {
  let piece = await sharp(input).flatten({ background: '#ffffff' }).trim({ background: '#ffffff', threshold: 18 }).toBuffer()
  if (girar) piece = await sharp(piece).rotate(girar, { background: '#ffffff' }).toBuffer()
  const inner = Math.round(side * margem)
  const fitted = await sharp(piece).resize(inner, inner, { fit: 'inside' }).toBuffer()
  const meta = await sharp(fitted).metadata()
  return sharp({ create: { width: side, height: side, channels: 3, background: '#ffffff' } })
    .composite([{ input: fitted, left: Math.round((side - meta.width) / 2), top: Math.round((side - meta.height) / 2) }])
    .png()
    .toBuffer()
}

/** Peça recortada do fundo claro ligado à borda (enchimento), com a borda suavizada. */
async function cutLightBackground(input, { fill = 18, edge = 60 } = {}) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const n = w * h
  const dist = new Uint8Array(n)
  for (let p = 0; p < n; p++) dist[p] = 255 - Math.min(data[p * 3], data[p * 3 + 1], data[p * 3 + 2])
  const background = new Uint8Array(n)
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const p = stack.pop()
    if (background[p] || dist[p] > fill) continue
    background[p] = 1
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < n - w) stack.push(p + w)
  }
  const touchesBackground = (p) => {
    const x = p % w
    return (x > 0 && background[p - 1]) || (x < w - 1 && background[p + 1]) || (p >= w && background[p - w]) || (p < n - w && background[p + w])
  }
  const out = Buffer.alloc(n * 4)
  for (let p = 0; p < n; p++) {
    const alpha = background[p] ? 0 : touchesBackground(p) ? smoothstep(fill, edge, dist[p]) : 1
    for (let c = 0; c < 3; c++) out[p * 4 + c] = data[p * 3 + c]
    out[p * 4 + 3] = Math.round(alpha * 255)
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim().png().toBuffer()
}

/** Recorte redondo (a pilha de casquinhas vista de cima). */
async function roundPiece(input, { cx, cy, r }) {
  const meta = await sharp(input).metadata()
  const side = Math.round(2 * r * Math.min(meta.width, meta.height))
  const crop = await sharp(input)
    .extract({ left: Math.round(cx * meta.width - side / 2), top: Math.round(cy * meta.height - side / 2), width: side, height: side })
    .toBuffer()
  const mask = Buffer.from(`<svg width="${side}" height="${side}"><circle cx="${side / 2}" cy="${side / 2}" r="${side / 2 - 2}" fill="#fff"/></svg>`)
  return sharp(crop).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

/** Sombra de estúdio: o contorno da peça, escurecido e desfocado. */
async function softShadow(piece, { blur, opacity }) {
  const meta = await sharp(piece).metadata()
  const alpha = await sharp(piece).extractChannel('alpha').raw().toBuffer()
  const rgba = Buffer.alloc(meta.width * meta.height * 4)
  for (let i = 0; i < meta.width * meta.height; i++) rgba[i * 4 + 3] = Math.round(alpha[i] * opacity)
  const pad = blur * 3
  return sharp(rgba, { raw: { width: meta.width, height: meta.height, channels: 4 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(blur)
    .png()
    .toBuffer()
}

/** Põe uma peça (centro x, y; largura w; giro) com a sombra embaixo, à direita (luz de cima à esquerda). */
async function placePiece(layers, piece, { x, y, w, rotate = 0 }) {
  let p = await sharp(piece).resize({ width: w }).png().toBuffer()
  if (rotate) p = await sharp(p).rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const meta = await sharp(p).metadata()
  const shadow = { dx: 12, dy: 15, blur: 16, opacity: 0.32 }
  const pad = shadow.blur * 3
  layers.push({
    input: await softShadow(p, shadow),
    left: Math.round(x - meta.width / 2 + shadow.dx - pad),
    top: Math.round(y - meta.height / 2 + shadow.dy - pad),
  })
  layers.push({ input: p, left: Math.round(x - meta.width / 2), top: Math.round(y - meta.height / 2) })
}

/** Fundo de estúdio claro, com a luz no centro. */
function studioBackground(side) {
  const svg = `<svg width="${side}" height="${side}"><defs><radialGradient id="g" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#fffdfa"/><stop offset="1" stop-color="#ece3d8"/></radialGradient></defs><rect width="${side}" height="${side}" fill="url(#g)"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Posição de cada peça nas composições (lado de 800 px). O pote sai pela borda de baixo. */
const COMPOSITIONS = {
  'kit-casquinha': [
    ['pote', { x: 235, y: 548, w: 360 }],
    ['casquinhas', { x: 585, y: 222, w: 340 }],
    ['cobertura', { x: 592, y: 612, w: 128, rotate: -62 }],
  ],
  'kit-completo': [
    ['casquinhas', { x: 215, y: 222, w: 340 }],
    ['pote', { x: 580, y: 548, w: 360 }],
    ['cobertura', { x: 196, y: 618, w: 124, rotate: 62 }],
  ],
  'combo-1-litro': [
    ['pote', { x: 250, y: 575, w: 320 }],
    ['casquinhas', { x: 575, y: 330, w: 360 }],
  ],
}

const catalogPieces = new Map()
async function catalogPiece(key) {
  if (catalogPieces.has(key)) return catalogPieces.get(key)
  const source = CATALOG._pecas[key]
  let piece
  if (key === 'pote') {
    // Forma preta do pote vista de cima, com a concha; corta a tigela de madeira do canto esquerdo.
    const image = await catalogOriginal(`peca-${key}`, source.download)
    const meta = await sharp(image).metadata()
    const crop = await sharp(image)
      .extract({ left: Math.round(0.16 * meta.width), top: 0, width: Math.round(0.84 * meta.width), height: meta.height })
      .toBuffer()
    piece = await cutLightBackground(crop, { fill: 22, edge: 70 })
  } else if (key === 'casquinhas') {
    piece = await roundPiece(await catalogOriginal(`peca-${key}`, source.download), { cx: 0.5, cy: 0.5, r: 0.48 })
  } else {
    piece = await cutLightBackground(join(ROOT, source.arquivoLoja), { fill: 10, edge: 50 })
  }
  catalogPieces.set(key, piece)
  return piece
}

async function composition(entry) {
  const side = MASTER_SIDE.png
  const layers = []
  for (const [role, spot] of COMPOSITIONS[entry.composicao]) {
    const key = role === 'cobertura' ? entry.pecas.find((piece) => piece.startsWith('cobertura')) : role
    await placePiece(layers, await catalogPiece(key), spot)
  }
  return sharp(await studioBackground(side)).composite(layers).png().toBuffer()
}

async function catalog(only = []) {
  mkdirSync(CATALOG_OUT, { recursive: true })
  const names = only.length ? only : Object.keys(CATALOG.fotos)
  for (const name of names) {
    const entry = CATALOG.fotos[name]
    if (!entry) throw new Error(`Foto desconhecida em catalogo.json: ${name}`)
    const ext = name.split('.').pop()
    const side = MASTER_SIDE[ext]
    let square
    if (entry.composicao) square = await composition(entry)
    else if (entry.inteira) square = await wholeOnWhite(await catalogOriginal(name, entry.download), entry.inteira, side)
    else square = await squareOf(await catalogOriginal(name, entry.download), entry.recorte)

    const base = name.replace(/\.(jpg|png)$/, '')
    const master = sharp(square).resize(side, side, { withoutEnlargement: true })
    if (ext === 'jpg') await master.flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toFile(join(CATALOG_OUT, name))
    else await master.png({ compressionLevel: 9, palette: false }).toFile(join(CATALOG_OUT, name))
    for (const width of VARIANT_WIDTHS) {
      await sharp(square)
        .resize(width, width)
        .flatten({ background: '#ffffff' })
        .webp({ quality: 82, effort: 6 })
        .toFile(join(CATALOG_OUT, `${base}-${width}.webp`))
    }
    const size = await sharp(join(CATALOG_OUT, name)).metadata()
    console.log(`${name}: ${size.width}x${size.height}`)
  }
  console.log('catálogo ok:', names.length)
}

/* ---------- Execução ---------- */

const only = process.argv[2]
if (!only || only === 'loja') await storePhotos(process.argv.slice(3))
if (!only || only === 'miniaturas') await thumbnails()
if (!only || only === 'produtos') await products(process.argv.slice(3))
// Só quando pedido: `catalogo` baixa as fotos de banco das gavetas (uma vez) e refaz as cópias.
if (only === 'catalogo') await catalog(process.argv.slice(3))
