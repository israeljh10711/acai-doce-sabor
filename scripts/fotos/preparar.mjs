/**
 * Prepara as fotos do site a partir das fontes licenciadas listadas em `fontes.json`.
 *
 * Uso (na pasta do projeto):
 *   npm install --no-save sharp
 *   node scripts/fotos/preparar.mjs
 *
 * O que faz:
 * - baixa cada original uma vez para `scripts/fotos/.originais/` (fora do Git);
 * - recorta as miniaturas dos ingredientes (`public/images/ingredients/`);
 * - monta texturas sem emenda para os setores do compositor (`toppings/`, `creams/`);
 * - recorta peças com fundo transparente (banana, chocoball, Kit Kat...) em `toppings/`;
 * - recorta o isopor (`containers/`) e prepara as superfícies de açaí, batido e milk-shake
 *   (`backgrounds/`);
 * - grava `src/features/photo-composer/sprites.json` com as peças e as proporções.
 *
 * As imagens derivadas mantêm a licença do original (ver `public/images/CREDITOS.md`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOURCES = JSON.parse(readFileSync(join(ROOT, 'scripts/fotos/fontes.json'), 'utf8'))
const CACHE = join(ROOT, 'scripts/fotos/.originais')
const OUT = join(ROOT, 'public/images')
const UA = 'acai-site-dev/0.1 (image licensing research)'

for (const dir of ['ingredients', 'toppings', 'creams', 'containers', 'backgrounds', 'products', 'branding']) {
  mkdirSync(join(OUT, dir), { recursive: true })
}
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

/** Gerador pseudoaleatório com semente: o resultado é sempre o mesmo. */
function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

async function regionOf(key, { x, y, w, h }) {
  const file = await original(key)
  const meta = await sharp(file).metadata()
  const left = Math.round(x * meta.width)
  const top = Math.round(y * meta.height)
  const width = Math.min(meta.width - left, Math.round(w * meta.width))
  const height = Math.min(meta.height - top, Math.round(h * meta.height))
  return sharp(file).extract({ left, top, width, height }).toBuffer()
}

/** Recorte quadrado: centro (cx, cy) e lado s, em frações do menor lado da foto. */
async function squareOf(key, { cx, cy, s }) {
  const file = await original(key)
  const meta = await sharp(file).metadata()
  const side = Math.round(s * Math.min(meta.width, meta.height))
  const left = Math.max(0, Math.min(meta.width - side, Math.round(cx * meta.width - side / 2)))
  const top = Math.max(0, Math.min(meta.height - side, Math.round(cy * meta.height - side / 2)))
  return sharp(file).extract({ left, top, width: side, height: side }).toBuffer()
}

async function webp(input, file, { size, quality = 80, alpha = false } = {}) {
  let pipeline = sharp(input)
  if (size) pipeline = pipeline.resize(size, size, { fit: alpha ? 'inside' : 'cover' })
  await pipeline.webp({ quality, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(join(OUT, file))
}

const featherMask = (size, inner = 0.45) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><defs><radialGradient id="g"><stop offset="${inner}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#g)"/></svg>`,
  )

/**
 * Textura sem emenda a partir de uma região da foto: retalhos com borda suave, espalhados ao
 * acaso (com semente) e repetidos nas bordas, para a textura poder se repetir sem linha.
 */
async function quilt(key, region, { size = 512, patch = 0.42, scale = 0.34, count = 90, seed = 7, keyBackground, from = 30, to = 80 } = {}) {
  let source = await regionOf(key, region)
  let background
  if (keyBackground) {
    // Fundo liso (ex.: o branco entre as gotas de chocolate) vira transparente: o açaí aparece.
    const keyed = await keyOut(source, { background: keyBackground, from, to })
    source = await sharp(keyed.buffer, { raw: { width: keyed.width, height: keyed.height, channels: 4 } }).png().toBuffer()
    background = { r: 0, g: 0, b: 0, alpha: 0 }
  } else {
    const { channels } = await sharp(source).stats()
    background = { r: channels[0].mean, g: channels[1].mean, b: channels[2].mean }
  }
  const meta = await sharp(source).metadata()
  const rand = random(seed)
  const sourcePatch = Math.round(Math.min(meta.width, meta.height) * patch)
  const outPatch = Math.round(size * scale)
  const mask = featherMask(outPatch)
  const composites = []
  for (let i = 0; i < count; i++) {
    const left = Math.floor(rand() * (meta.width - sourcePatch))
    const top = Math.floor(rand() * (meta.height - sourcePatch))
    const angle = [0, 90, 180, 270][Math.floor(rand() * 4)]
    const piece = await sharp(source)
      .extract({ left, top, width: sourcePatch, height: sourcePatch })
      .resize(outPatch, outPatch)
      .rotate(angle)
      .ensureAlpha()
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer()
    const x = Math.round(rand() * size - outPatch / 2)
    const y = Math.round(rand() * size - outPatch / 2)
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const px = x + dx
        const py = y + dy
        if (px > -outPatch && px < size && py > -outPatch && py < size) {
          composites.push({ input: piece, left: px, top: py })
        }
      }
    }
  }
  // O sharp não aceita peças fora da tela: recorta numa tela maior e depois tira a margem.
  const margin = outPatch
  const shifted = composites.map((c) => ({ ...c, left: c.left + margin, top: c.top + margin }))
  const big = await sharp({ create: { width: size + 2 * margin, height: size + 2 * margin, channels: keyBackground ? 4 : 3, background } })
    .composite(shifted)
    .png()
    .toBuffer()
  return sharp(big).extract({ left: margin, top: margin, width: size, height: size }).toBuffer()
}

/** Mapa de gradiente: a luminosidade vira cor (sombra, meio-tom, brilho), preservando a textura. */
async function gradientMap(input, stops, { low = 0.02, high = 0.98 } = {}) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const lum = new Float32Array(info.width * info.height)
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2]
  }
  const sorted = Float32Array.from(lum).sort()
  const lo = sorted[Math.floor(sorted.length * low)]
  const hi = sorted[Math.floor(sorted.length * high)]
  const out = Buffer.alloc(info.width * info.height * 3)
  for (let i = 0; i < lum.length; i++) {
    const t = Math.min(1, Math.max(0, (lum[i] - lo) / (hi - lo)))
    let k = 0
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++
    const [t0, c0] = stops[k]
    const [t1, c1] = stops[k + 1]
    const f = (t - t0) / (t1 - t0)
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(c0[c] + (c1[c] - c0[c]) * Math.min(1, Math.max(0, f)))
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer()
}

/**
 * Tira o fundo de cor lisa (branco, azul...). A transparência cresce com a distância da cor do
 * fundo; a cor da borda é "descontaminada" para não ficar com halo do fundo.
 */
async function keyOut(input, { background, from = 40, to = 90 }) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const out = Buffer.alloc(info.width * info.height * 4)
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3]
    const g = data[i * 3 + 1]
    const b = data[i * 3 + 2]
    const distance = Math.hypot(r - background[0], g - background[1], b - background[2])
    const alpha = smoothstep(from, to, distance)
    const pure = (value, bg) => (alpha > 0.02 ? Math.min(255, Math.max(0, (value - (1 - alpha) * bg) / alpha)) : 0)
    out[i * 4] = pure(r, background[0])
    out[i * 4 + 1] = pure(g, background[1])
    out[i * 4 + 2] = pure(b, background[2])
    out[i * 4 + 3] = Math.round(alpha * 255)
  }
  return { buffer: out, width: info.width, height: info.height }
}

/** Manchas separadas (peças) numa imagem com transparência: caixas de cada uma. */
function blobs({ buffer, width, height }, { minArea = 400, edgeMargin = 2 } = {}) {
  const seen = new Uint8Array(width * height)
  const boxes = []
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || buffer[start * 4 + 3] < 128) continue
    const stack = [start]
    seen[start] = 1
    let minX = width, minY = height, maxX = 0, maxY = 0, area = 0
    while (stack.length) {
      const p = stack.pop()
      const x = p % width
      const y = (p - x) / width
      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const q of [p - 1, p + 1, p - width, p + width]) {
        if (q < 0 || q >= width * height || seen[q]) continue
        if (Math.abs((q % width) - x) > 1) continue
        if (buffer[q * 4 + 3] < 128) continue
        seen[q] = 1
        stack.push(q)
      }
    }
    const touchesEdge = minX < edgeMargin || minY < edgeMargin || maxX > width - 1 - edgeMargin || maxY > height - 1 - edgeMargin
    if (area >= minArea && !touchesEdge) boxes.push({ minX, minY, maxX, maxY, area })
  }
  return boxes.sort((a, b) => b.area - a.area)
}

async function cutBlob(keyed, box, pad = 6) {
  const left = Math.max(0, box.minX - pad)
  const top = Math.max(0, box.minY - pad)
  const width = Math.min(keyed.width - left, box.maxX - box.minX + 1 + 2 * pad)
  const height = Math.min(keyed.height - top, box.maxY - box.minY + 1 + 2 * pad)
  return sharp(keyed.buffer, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
    .extract({ left, top, width, height })
    .png()
    .toBuffer()
}

/** Cor média das bordas da foto: o fundo a tirar. */
async function edgeColor(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const sum = [0, 0, 0]
  let count = 0
  for (let x = 0; x < info.width; x += 4) {
    for (const y of [2, info.height - 3]) {
      for (let c = 0; c < 3; c++) sum[c] += data[(y * info.width + x) * 3 + c]
      count++
    }
  }
  return sum.map((value) => value / count)
}

const sprites = {}

/** Peças recortadas de uma foto com fundo liso. */
async function spritesFrom(key, look, { region, from, to, max = 8, minArea, size = 256, background, edgeMargin } = {}) {
  const input = region ? await regionOf(key, region) : await original(key)
  const bg = background ?? (await edgeColor(input))
  const keyed = await keyOut(input, { background: bg, from, to })
  const boxes = blobs(keyed, { minArea, edgeMargin }).slice(0, max)
  sprites[look] = []
  for (const [index, box] of boxes.entries()) {
    const piece = await cutBlob(keyed, box)
    const meta = await sharp(piece).metadata()
    const name = `toppings/${look}-${index + 1}.webp`
    await webp(piece, name, { size, alpha: true, quality: 82 })
    sprites[look].push({ src: `/images/${name}`, aspect: +(meta.width / meta.height).toFixed(3) })
  }
  if (sprites[look].length === 0) throw new Error(`${look}: nenhuma peça encontrada`)
  return sprites[look]
}

/** Peça cilíndrica (rolo) recortada por geometria: gira a foto até o rolo ficar em pé. */
async function rollSprite(key, { top, bottom, width }) {
  const file = await original(key)
  const meta = await sharp(file).metadata()
  const [x1, y1] = [top[0] * meta.width, top[1] * meta.height]
  const [x2, y2] = [bottom[0] * meta.width, bottom[1] * meta.height]
  const angle = (Math.atan2(-(x2 - x1), y2 - y1) * 180) / Math.PI
  const rotated = await sharp(file).rotate(angle, { background: '#000' }).toBuffer()
  const rmeta = await sharp(rotated).metadata()
  const rad = (angle * Math.PI) / 180
  const [cx, cy] = [(x1 + x2) / 2 - meta.width / 2, (y1 + y2) / 2 - meta.height / 2]
  const px = cx * Math.cos(rad) - cy * Math.sin(rad) + rmeta.width / 2
  const py = cx * Math.sin(rad) + cy * Math.cos(rad) + rmeta.height / 2
  const length = Math.hypot(x2 - x1, y2 - y1)
  const w = Math.round(width * meta.width)
  const h = Math.round(length)
  const piece = await sharp(rotated)
    .extract({ left: Math.round(px - w / 2), top: Math.round(py - h / 2), width: w, height: h })
    .toBuffer()
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><defs><filter id="f"><feGaussianBlur stdDeviation="1.2"/></filter></defs><rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${(w - 4) / 2}" fill="#fff" filter="url(#f)"/></svg>`,
  )
  const cut = await sharp(piece).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  const name = `toppings/${key}-1.webp`
  await webp(cut, name, { size: 320, alpha: true, quality: 84 })
  return { src: `/images/${name}`, aspect: +(w / h).toFixed(3) }
}

/** Miniatura de peça recortada sobre fundo claro, para o cartão do ingrediente. */
async function thumbFromSprites(look, file, { count = 3, background = '#f6f1f5' } = {}) {
  const size = 256
  const pieces = sprites[look].slice(0, count)
  const composites = []
  const rand = random(look.length * 31)
  for (const [i, piece] of pieces.entries()) {
    const target = Math.round(size * (count === 1 ? 0.78 : 0.52))
    const buffer = await sharp(join(OUT, piece.src.replace('/images/', ''))).resize(target, target, { fit: 'inside' }).toBuffer()
    const meta = await sharp(buffer).metadata()
    const cx = count === 1 ? 0.5 : [0.36, 0.64, 0.5][i] ?? rand()
    const cy = count === 1 ? 0.5 : [0.4, 0.42, 0.66][i] ?? rand()
    composites.push({ input: buffer, left: Math.round(cx * size - meta.width / 2), top: Math.round(cy * size - meta.height / 2) })
  }
  const image = await sharp({ create: { width: size, height: size, channels: 3, background } }).composite(composites).png().toBuffer()
  await webp(image, file, { quality: 82 })
}

/* ---------- Configuração de cada imagem ---------- */

const ACAI_STOPS = [
  [0, [16, 2, 12]],
  [0.35, [44, 8, 33]],
  [0.65, [74, 18, 56]],
  [0.9, [128, 62, 104]],
  [1, [214, 170, 200]],
]
const BATIDO_STOPS = [
  [0, [40, 8, 30]],
  [0.4, [84, 26, 66]],
  [0.75, [124, 56, 100]],
  [1, [226, 196, 214]],
]

/** Miniaturas recortadas de fotos (lado em fração do menor lado da foto). */
const THUMBS = {
  granola: ['granola', { cx: 0.49, cy: 0.53, s: 0.5 }],
  'leite-em-po': ['leite-em-po', { cx: 0.22, cy: 0.5, s: 0.62 }],
  biscoito: ['biscoito', { cx: 0.5, cy: 0.58, s: 0.62 }],
  pacoca: ['pacoca', { cx: 0.56, cy: 0.42, s: 0.62 }],
  amendoim: ['amendoim', { cx: 0.5, cy: 0.44, s: 0.4 }],
  'gotas-de-chocolate': ['gotas-de-chocolate', { cx: 0.66, cy: 0.46, s: 0.62 }],
  canudinho: ['canudinho', { cx: 0.42, cy: 0.42, s: 0.72 }],
  sucrilhos: ['sucrilhos', { cx: 0.5, cy: 0.5, s: 0.7 }],
  marshmallow: ['marshmallow', { cx: 0.5, cy: 0.45, s: 0.85 }],
  kiwi: ['kiwi', { cx: 0.42, cy: 0.52, s: 0.62 }],
  morango: ['morango', { cx: 0.42, cy: 0.5, s: 0.7 }],
  'calda-leite-condensado': ['calda-leite-condensado', { cx: 0.5, cy: 0.42, s: 0.55 }],
  'calda-morango': ['calda-morango', { cx: 0.73, cy: 0.72, s: 0.36 }],
  'calda-chocolate': ['calda-chocolate', { cx: 0.5, cy: 0.42, s: 0.55 }],
  'calda-banana-caramelizada': ['calda-banana-caramelizada', { cx: 0.52, cy: 0.5, s: 0.45 }],
  'calda-doce-de-leite': ['calda-doce-de-leite', { cx: 0.5, cy: 0.5, s: 0.8 }],
  'calda-frutas-vermelhas': ['calda-frutas-vermelhas', { cx: 0.46, cy: 0.32, s: 0.42 }],
  'creme-de-avela': ['creme-de-avela', { cx: 0.6, cy: 0.33, s: 0.46 }],
  'creme-de-ninho': ['creme-de-ninho', { cx: 0.5, cy: 0.33, s: 0.5 }],
  cereja: ['cereja', { cx: 0.5, cy: 0.45, s: 0.78 }],
  'creme-de-morango': ['creme-de-morango', { cx: 0.5, cy: 0.46, s: 0.42 }],
  'creme-de-cookies': ['creme-de-cookies', { cx: 0.5, cy: 0.5, s: 0.8 }],
  ovomaltine: ['ovomaltine', { cx: 0.48, cy: 0.52, s: 0.8 }],
}

/** Texturas dos setores: região densa da foto e o tamanho aparente dos pedaços. */
const TEXTURES = {
  granola: ['granola', { x: 0.3, y: 0.36, w: 0.38, h: 0.34 }, { patch: 0.5, scale: 0.36 }],
  'leite-em-po': ['leite-em-po', { x: 0.02, y: 0.05, w: 0.4, h: 0.85 }, { patch: 0.4, scale: 0.42 }],
  biscoito: ['biscoito-farelo', { x: 0.1, y: 0.12, w: 0.8, h: 0.6 }, { patch: 0.5, scale: 0.42 }],
  pacoca: ['pacoca', { x: 0.57, y: 0.44, w: 0.24, h: 0.17 }, { patch: 0.8, scale: 0.36, keyBackground: [70, 42, 30], from: 70, to: 120 }],
  amendoim: ['amendoim', { x: 0.12, y: 0.44, w: 0.76, h: 0.12 }, { patch: 0.9, scale: 0.3, keyBackground: [8, 6, 4], from: 60, to: 130 }],
  'gotas-de-chocolate': ['gotas-de-chocolate', { x: 0.42, y: 0.06, w: 0.56, h: 0.82 }, { patch: 0.45, scale: 0.4, keyBackground: [250, 250, 250], from: 40, to: 110 }],
  sucrilhos: ['sucrilhos', { x: 0, y: 0, w: 1, h: 1 }, { patch: 0.4, scale: 0.45 }],
  marshmallow: ['marshmallow', { x: 0, y: 0, w: 1, h: 0.85 }, { patch: 0.5, scale: 0.62, count: 40 }],
  kiwi: ['kiwi', { x: 0.02, y: 0.12, w: 0.96, h: 0.74 }, { patch: 0.6, scale: 0.55 }],
  morango: ['morango', { x: 0, y: 0, w: 1, h: 1 }, { patch: 0.5, scale: 0.5 }],
  ovomaltine: ['ovomaltine', { x: 0.25, y: 0.42, w: 0.5, h: 0.3 }, { patch: 0.7, scale: 0.36 }],
}

const CREAMS = {
  'creme-de-avela': ['creme-de-avela', { x: 0.18, y: 0.14, w: 0.62, h: 0.34 }],
  'creme-de-ninho': ['creme-de-ninho', { x: 0.24, y: 0.16, w: 0.52, h: 0.38 }],
  'creme-de-morango': ['creme-de-morango', { x: 0.3, y: 0.3, w: 0.4, h: 0.3 }],
  'creme-de-cookies': ['creme-de-cookies', { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }],
}


/* ---------- Execução ---------- */

const only = process.argv[2]
const want = (group) => !only || only === group

if (want('thumbs')) {
  for (const [look, [key, crop]] of Object.entries(THUMBS)) {
    await webp(await squareOf(key, crop), `ingredients/${look}.webp`, { size: 256, quality: 82 })
  }
  // Farinha láctea: o pó do leite em pó com o tom creme da farinha (derivada, ajuste de cor).
  const milk = await squareOf('leite-em-po', THUMBS['leite-em-po'][1])
  await webp(await sharp(milk).modulate({ saturation: 1.6, hue: 8 }).tint('#ead2a4').toBuffer(), 'ingredients/farinha-lactea.webp', { size: 256 })
  // Calda de açaí: a superfície do açaí, mais brilhante.
  const acai = await squareOf('acai-superficie', { cx: 0.44, cy: 0.6, s: 0.32 })
  await webp(await gradientMap(acai, [[0, [20, 3, 14]], [0.6, [70, 14, 52]], [0.88, [140, 60, 112]], [1, [240, 200, 226]]]), 'ingredients/calda-acai.webp', { size: 256 })
  console.log('miniaturas ok')
}

if (want('textures')) {
  for (const [look, [key, region, options]] of Object.entries(TEXTURES)) {
    let texture = await quilt(key, region, { ...options, seed: look.length * 17 })
    if (look === 'marshmallow') texture = await sharp(texture).modulate({ brightness: 1.18, saturation: 0.45 }).toBuffer()
    await webp(texture, `toppings/${look}.webp`, { quality: 80 })
  }
  const milk = await quilt('leite-em-po', TEXTURES['leite-em-po'][1], { ...TEXTURES['leite-em-po'][2], seed: 99 })
  await webp(await sharp(milk).modulate({ saturation: 1.6, hue: 8 }).tint('#ead2a4').toBuffer(), 'toppings/farinha-lactea.webp')
  for (const [look, [key, region]] of Object.entries(CREAMS)) {
    await webp(await quilt(key, region, { size: 384, patch: 0.6, scale: 0.5, count: 60, seed: look.length * 13 }), `creams/${look}.webp`, { quality: 82 })
  }
  console.log('texturas ok')
}

if (want('sprites')) {
  await spritesFrom('banana', 'banana', { from: 70, to: 120, max: 9, minArea: 2000, size: 200 })
  await spritesFrom('chocoball', 'chocoball', { region: { x: 0, y: 0, w: 0.5, h: 1 }, from: 25, to: 70, max: 1, minArea: 5000 })
  await spritesFrom('kit-kat', 'kit-kat', { region: { x: 0.55, y: 0, w: 0.45, h: 1 }, from: 22, to: 60, max: 1, minArea: 5000 })
  await spritesFrom('bis', 'bis', { region: { x: 0, y: 0, w: 0.5, h: 1 }, from: 22, to: 60, max: 1, minArea: 5000 })
  // O cabinho da cereja encosta na borda da foto: aceita peça na borda.
  await spritesFrom('cereja-unidade', 'cereja', { from: 35, to: 80, max: 1, minArea: 8000, edgeMargin: -1 })
  // Canudinho: o prato tem desenho azul, então a peça sai por geometria. O rolo do meio vai de
  // (66,5%; 10,4%) a (58,1%; 58,8%) da foto: gira para ficar em pé e recorta com cantos redondos.
  sprites.canudinho = [await rollSprite('canudinho', { top: [0.665, 0.104], bottom: [0.581, 0.588], width: 0.062 })]
  await thumbFromSprites('banana', 'ingredients/banana.webp')
  await thumbFromSprites('chocoball', 'ingredients/chocoball.webp', { count: 1 })
  await thumbFromSprites('kit-kat', 'ingredients/kit-kat.webp', { count: 1 })
  await thumbFromSprites('bis', 'ingredients/bis.webp', { count: 1 })
  writeFileSync(join(ROOT, 'src/features/photo-composer/sprites.json'), `${JSON.stringify(sprites, null, 2)}\n`)
  console.log('peças ok', Object.fromEntries(Object.entries(sprites).map(([k, v]) => [k, v.length])))
}

if (want('surfaces')) {
  // Açaí: região lisa da tigela, em textura sem emenda, no roxo do açaí.
  const acai = await quilt('acai-superficie', { x: 0.16, y: 0.46, w: 0.54, h: 0.32 }, { size: 768, patch: 0.7, scale: 0.42, count: 120, seed: 3 })
  await webp(await gradientMap(acai, ACAI_STOPS), 'backgrounds/acai.webp', { quality: 82 })
  // Batido: mais claro e liso.
  const batido = await quilt('acai-superficie', { x: 0.16, y: 0.46, w: 0.54, h: 0.32 }, { size: 768, patch: 0.7, scale: 0.5, count: 120, seed: 11 })
  await webp(await gradientMap(await sharp(batido).blur(1.4).toBuffer(), BATIDO_STOPS), 'backgrounds/batido.webp', { quality: 82 })
  // Milk-shake: creme branco em tons de cinza; a cor do sabor é aplicada no site.
  const shake = await quilt('creme-de-ninho', CREAMS['creme-de-ninho'][1], { size: 768, patch: 0.55, scale: 0.42, count: 120, seed: 5 })
  await webp(await sharp(shake).grayscale().linear(1.15, -10).toBuffer(), 'backgrounds/milkshake.webp', { quality: 82 })
  console.log('superfícies ok')
}

if (want('containers')) {
  // Isopor visto de cima: acha o aro pelo branco do isopor nas linhas do centro e recorta em círculo.
  const file = await original('isopor')
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const foam = (x, y) => {
    const i = (y * info.width + x) * 3
    const max = Math.max(data[i], data[i + 1], data[i + 2])
    const min = Math.min(data[i], data[i + 1], data[i + 2])
    return max > 140 && max - min < 45
  }
  const cy0 = Math.round(info.height * 0.515)
  const cx0 = Math.round(info.width * 0.513)
  const scan = (from, step, fixed, horizontal) => {
    let last = from
    for (let p = from; p >= 0 && p < (horizontal ? info.width : info.height); p += step) {
      if (horizontal ? foam(p, fixed) : foam(fixed, p)) last = p
      else if (Math.abs(p - last) > 12) break
    }
    return last
  }
  const left = scan(cx0, -1, cy0, true)
  const right = scan(cx0, 1, cy0, true)
  const top = scan(cy0, -1, cx0, false)
  const bottom = scan(cy0, 1, cx0, false)
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const rx = (right - left) / 2
  const ry = (bottom - top) / 2
  const half = Math.round(Math.max(rx, ry) * 1.04)
  const side = half * 2
  // Em dois passos: o sharp recorta antes de estender quando os dois estão na mesma cadeia.
  const padded = await sharp(file).extend({ top: half, bottom: half, left: half, right: half, background: '#000' }).toBuffer()
  const cropped = await sharp(padded)
    .extract({ left: Math.round(cx), top: Math.round(cy), width: side, height: side })
    .toBuffer()
  const mask = Buffer.from(
    `<svg width="${side}" height="${side}"><ellipse cx="${half}" cy="${half}" rx="${rx - 1.5}" ry="${ry - 1.5}" fill="#fff"/></svg>`,
  )
  const cut = await sharp(cropped).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
  await webp(cut, 'containers/isopor.webp', { size: 1024, alpha: true, quality: 84 })
  console.log('isopor ok', { left, right, top, bottom, rx, ry, side, raio: +(Math.max(rx, ry) / side).toFixed(4) })
}
