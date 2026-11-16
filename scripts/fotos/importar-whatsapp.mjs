/**
 * Importa as fotos do catálogo do WhatsApp da loja (pedido de 2026-11-16).
 *
 * Uso (na pasta do projeto): node scripts/fotos/importar-whatsapp.mjs [pasta] [--saida <pasta>] [--so <arquivo>...]
 *
 * 1. Acha a pasta "fotos produtos", na ordem do pedido: a raiz do projeto, a Área de Trabalho
 *    (também a do OneDrive), Downloads, Documentos e Imagens (também os do OneDrive) e, se não
 *    achar, uma busca na pasta do usuário (sem AppData, node_modules, .git nem pastas ocultas). O
 *    nome é comparado sem maiúsculas e sem espaços repetidos ("fotos  produtos" também vale).
 *    Sem a pasta, usa a cópia guardada em `assets/fotos-loja/whatsapp/`.
 * 2. Mostra o caminho e quantos dos arquivos vinculados em `whatsapp.json` estão lá.
 * 3. Copia as capturas para `assets/fotos-loja/whatsapp/` (o original fica guardado no projeto).
 * 4. Em cada foto vinculada: recorta a foto da captura (`recorte-whatsapp.mjs`: tira o bloco de
 *    texto de baixo, as bordas e o pedaço da foto vizinha do carrossel), dá um ajuste leve de luz,
 *    cor, contraste e nitidez (menos nas artes com texto) e salva em `public/images/catalogo/`:
 *    JPEG qualidade 90, até 900 px de largura, e as cópias `-480.webp` e `-960.webp` que o site
 *    usa (nunca maiores que a foto).
 * 5. Atualiza `src/features/catalog/catalogPhotos.json` (tamanhos e enquadramento).
 *
 * `--saida <pasta>`: grava numa pasta de conferência, sem mexer no site. `--so`: só esses arquivos.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { detectPhotoBox } from './recorte-whatsapp.mjs'
import { writeCatalogPhotoInfo } from './tamanhos-catalogo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'scripts', 'fotos', 'whatsapp.json'), 'utf8'))
const COPY = join(ROOT, CONFIG.copia)
const MAX_WIDTH = 900

const args = process.argv.slice(2)
const option = (name) => {
  const index = args.indexOf(name)
  return index === -1 ? null : args[index + 1]
}
const outDir = option('--saida') ?? join(ROOT, 'public', 'images', 'catalogo')
const onlyIndex = args.indexOf('--so')
const only = onlyIndex === -1 ? [] : args.slice(onlyIndex + 1).filter((arg) => !arg.startsWith('--'))
const explicitFolder = args[0] && !args[0].startsWith('--') ? args[0] : null

/* ---------- 1. Achar a pasta ---------- */

const normalize = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim()
const WANTED = normalize(CONFIG.pasta)
const SKIP = new Set(['appdata', 'node_modules', '.git', '$recycle.bin'])

function childNamed(dir) {
  if (!existsSync(dir)) return null
  try {
    const match = readdirSync(dir, { withFileTypes: true }).find((entry) => entry.isDirectory() && normalize(entry.name) === WANTED)
    return match ? join(dir, match.name) : null
  } catch {
    return null
  }
}

/** Pasta de verdade ou atalho de pasta (a pasta do OneDrive dentro do usuário é um atalho). */
function isFolder(dir, entry) {
  if (entry.isDirectory()) return true
  if (!entry.isSymbolicLink()) return false
  try {
    return statSync(join(dir, entry.name)).isDirectory()
  } catch {
    return false
  }
}

function searchUnder(start, maxDepth = 7) {
  const queue = [[start, 0]]
  const seen = new Set()
  while (queue.length) {
    const [dir, depth] = queue.shift()
    let real
    try {
      real = realpathSync(dir)
    } catch {
      continue
    }
    if (seen.has(real)) continue
    seen.add(real)
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP.has(entry.name.toLowerCase()) || !isFolder(dir, entry)) continue
      const path = join(dir, entry.name)
      if (normalize(entry.name) === WANTED) return path
      if (depth < maxDepth) queue.push([path, depth + 1])
    }
  }
  return null
}

function findFolder() {
  if (explicitFolder) return explicitFolder
  const home = process.env.USERPROFILE ?? homedir()
  const bases = [
    ROOT,
    join(home, 'Desktop'),
    join(home, 'OneDrive', 'Desktop'),
    join(home, 'OneDrive', 'Área de Trabalho'),
    join(home, 'Downloads'),
    join(home, 'Documents'),
    join(home, 'OneDrive', 'Documentos'),
    join(home, 'OneDrive', 'Documents'),
    join(home, 'Pictures'),
    join(home, 'OneDrive', 'Imagens'),
    join(home, 'OneDrive', 'Pictures'),
  ]
  for (const base of bases) {
    const found = childNamed(base)
    if (found) return found
  }
  return searchUnder(home)
}

const folder = findFolder()
const captureFile = (dir, stem) =>
  existsSync(dir) ? readdirSync(dir).find((file) => file.startsWith('Captura de tela') && file.includes(` ${stem}.`)) : undefined

const entries = Object.entries(CONFIG.fotos).filter(([file]) => only.length === 0 || only.includes(file))
const stems = [...new Set(Object.values(CONFIG.fotos).map((entry) => entry.captura))]
if (folder) {
  const all = readdirSync(folder).filter((file) => /^Captura de tela .*\.(png|jpe?g)$/i.test(file))
  const found = stems.filter((stem) => captureFile(folder, stem))
  console.log(`Pasta encontrada: ${folder}`)
  console.log(`Capturas na pasta: ${all.length}. Vinculadas em whatsapp.json: ${stems.length}; encontradas: ${found.length}.`)
  const missing = stems.filter((stem) => !found.includes(stem))
  if (missing.length) console.log(`Não encontradas: ${missing.join(', ')}`)

  /* ---------- 3. Guardar as capturas no projeto ---------- */
  mkdirSync(COPY, { recursive: true })
  let copied = 0
  for (const file of all) {
    const target = join(COPY, file)
    if (!existsSync(target) || statSync(target).size !== statSync(join(folder, file)).size) {
      copyFileSync(join(folder, file), target)
      copied++
    }
  }
  console.log(`Copiadas para ${CONFIG.copia}: ${copied} (já estavam: ${all.length - copied}).`)
} else {
  console.log(`Pasta "${CONFIG.pasta}" não encontrada; usando a cópia em ${CONFIG.copia}.`)
}

/* ---------- 4. Recortar, ajustar e salvar ---------- */

mkdirSync(outDir, { recursive: true })
for (const [file, entry] of entries) {
  const name = captureFile(COPY, entry.captura)
  if (!name) throw new Error(`${file}: captura ${entry.captura} não está em ${CONFIG.copia}`)
  const source = join(COPY, name)
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const box = detectPhotoBox(data, info.width, info.height)
  const trim = { esquerda: 0, direita: 0, topo: 0, base: 0, ...entry.ajuste }
  const region = {
    left: box.left + trim.esquerda,
    top: box.top + trim.topo,
    width: box.width - trim.esquerda - trim.direita,
    height: box.height - trim.topo - trim.base,
  }

  let image = sharp(source).removeAlpha().extract(region)
  if (entry.ajuste_cor !== false) {
    // Ajuste leve, para a foto do balcão ficar viva sem mudar a cor do produto.
    image = image
      .modulate({ brightness: 1.03, saturation: 1.07 })
      .linear(1.05, -6)
      .sharpen({ sigma: 0.6 })
  }
  const photo = await image.resize({ width: MAX_WIDTH, withoutEnlargement: true }).toBuffer()
  // Cor sem subamostragem (4:4:4): nas fotos pequenas, letras e bordas vermelhas ficam nítidas.
  await sharp(photo).jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' }).toFile(join(outDir, file))
  const base = file.replace(/\.jpg$/, '')
  for (const width of [480, 960]) {
    await sharp(photo)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 86, effort: 6 })
      .toFile(join(outDir, `${base}-${width}.webp`))
  }
  console.log(`${file}: captura ${entry.captura}, foto ${region.width}x${region.height}, texto tirado ${box.caption} px`)
}

if (!option('--saida')) await writeCatalogPhotoInfo(ROOT)
console.log('fotos do WhatsApp ok:', entries.length)
