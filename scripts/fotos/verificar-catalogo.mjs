/**
 * Confere as fotos do site (pedido de 2026-11-15): `npm run check:images`.
 *
 * - Cada um dos 43 itens das gavetas tem `image` com um caminho local em `public/images/catalogo/`.
 * - Cada arquivo de `public/images/catalogo/` existe, começa com o cabeçalho de JPEG, PNG ou WebP e
 *   decodifica por inteiro (o sharp lê todos os pixels): nada de página de erro salva como foto.
 * - As fotos de referência (as baixadas ou montadas, uma por item) têm mais de 15 KB, são
 *   quadradas e têm pelo menos 600 px. As cópias leves têm exatamente 480 ou 960 px.
 * - As outras pastas de fotos (ingredientes, produtos e logo) também decodificam por inteiro.
 *
 * As cópias WebP de fotos com muito fundo branco (picolé, água) ficam com menos de 15 KB: são
 * válidas (decodificam e têm o tamanho certo), só leves. A lista delas sai no fim, para conferência.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { EXTRA_ITEMS } from '../../src/features/catalog/extras.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PUBLIC = join(ROOT, 'public')
const CATALOG = join(PUBLIC, 'images', 'catalogo')
const MIN_BYTES = 15 * 1024

const failures = []
const fail = (message) => failures.push(message)

function headerFormat(data) {
  if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG') return 'png'
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpeg'
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

/** Lê o arquivo inteiro com o sharp; devolve formato, largura e altura, ou registra a falha. */
async function decode(file) {
  const data = readFileSync(file)
  const format = headerFormat(data)
  if (!format) {
    fail(`${file}: não começa como JPEG, PNG nem WebP`)
    return null
  }
  try {
    const { info } = await sharp(data).raw().toBuffer({ resolveWithObject: true })
    return { format, width: info.width, height: info.height, bytes: data.length }
  } catch (error) {
    fail(`${file}: não decodifica (${error.message})`)
    return null
  }
}

// 1. Cada item tem foto local e as duas cópias.
const expected = new Set()
for (const item of EXTRA_ITEMS) {
  if (typeof item.image !== 'string' || !item.image.startsWith('images/catalogo/')) {
    fail(`${item.id}: image fora de images/catalogo (${item.image})`)
    continue
  }
  const name = item.image.slice('images/catalogo/'.length)
  const base = name.replace(/\.(jpg|png)$/, '')
  for (const file of [name, `${base}-480.webp`, `${base}-960.webp`]) {
    expected.add(file)
    if (!existsSync(join(CATALOG, file))) fail(`${item.id}: falta ${file}`)
  }
}

// 2. Cada arquivo da pasta do cardápio.
const light = []
let masters = 0
const files = readdirSync(CATALOG).sort()
for (const file of files) {
  if (!expected.has(file)) fail(`${file}: sobrando (nenhum item usa)`)
  const info = await decode(join(CATALOG, file))
  if (!info) continue
  const variant = file.match(/-(480|960)\.webp$/)
  if (variant) {
    const width = Number(variant[1])
    if (info.format !== 'webp' || info.width !== width || info.height !== width) fail(`${file}: esperado WebP ${width}x${width}, veio ${info.format} ${info.width}x${info.height}`)
    if (info.bytes < MIN_BYTES) light.push(`${file} (${(info.bytes / 1024).toFixed(1)} KB)`)
  } else {
    masters++
    const wanted = file.endsWith('.png') ? 'png' : 'jpeg'
    if (info.format !== wanted) fail(`${file}: extensão de ${wanted}, conteúdo ${info.format}`)
    if (info.width !== info.height) fail(`${file}: não é quadrada (${info.width}x${info.height})`)
    if (info.width < 600) fail(`${file}: só ${info.width} px`)
    if (info.bytes <= MIN_BYTES) fail(`${file}: ${info.bytes} bytes (mínimo 15 KB)`)
  }
}

// 3. As outras fotos do site.
let others = 0
for (const folder of ['ingredientes', 'produtos', 'branding']) {
  for (const file of readdirSync(join(PUBLIC, 'images', folder))) {
    const path = join(PUBLIC, 'images', folder, file)
    if (!statSync(path).isFile()) continue
    if (await decode(path)) others++
  }
}

console.log(`Itens das gavetas: ${EXTRA_ITEMS.length}, todos com foto local: ${EXTRA_ITEMS.every((item) => item.image?.startsWith('images/catalogo/'))}`)
console.log(`Cardápio: ${files.length} arquivos (${masters} fotos de referência + ${files.length - masters} cópias), todos decodificados por inteiro`)
console.log(`Ingredientes, produtos e logo: ${others} arquivos decodificados`)
if (light.length) console.log(`Cópias WebP válidas com menos de 15 KB (fundo branco): ${light.join(', ')}`)
if (failures.length) {
  console.log(`\nFALHAS (${failures.length}):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('\nRESULTADO: todas as fotos passaram (0 quebradas, 0 sem foto).')
