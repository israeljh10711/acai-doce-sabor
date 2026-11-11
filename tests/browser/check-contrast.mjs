// Mede o contraste de todo texto visível de cada página, contra o fundo real atrás
// dele, e compara com o nível AA da WCAG: 4,5:1, ou 3:1 para texto grande.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-contrast.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'

const routes = [
  '/',
  '/monte-seu-pedido',
  '/monte-seu-pedido/acai-oca',
  '/monte-seu-pedido/milk-shake',
  '/nao-existe',
]
const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]

// Roda dentro da página.
const measure = `(() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  // Converte qualquer cor CSS (rgb, oklab, color-mix...) em r, g, b, a.
  const toRgba = (color) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return { r, g, b, a: a / 255 }
  }
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  const channel = (value) => {
    const s = value / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  // Fundo efetivo: empilha os fundos dos ancestrais até achar um opaco.
  const backgroundOf = (element) => {
    const layers = []
    for (let node = element; node; node = node.parentElement) {
      const bg = toRgba(getComputedStyle(node).backgroundColor)
      if (bg.a > 0) layers.push(bg)
      if (bg.a >= 0.999) break
    }
    let result = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of layers.reverse()) result = over(layer, result)
    return result
  }

  const results = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim()
    const element = node.parentElement
    if (!text || !element || seen.has(element)) continue
    seen.add(element)

    const style = getComputedStyle(element)
    const box = element.getBoundingClientRect()
    if (style.visibility === 'hidden' || style.display === 'none') continue
    if (box.width <= 1 || box.height <= 1) continue // texto só para leitor de tela

    let opacity = 1
    for (let n = element; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity)

    const background = backgroundOf(element)
    const color = toRgba(style.color)
    const effective = over({ ...color, a: color.a * opacity }, background)
    const size = parseFloat(style.fontSize)
    const weight = Number(style.fontWeight) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)

    results.push({
      text: text.slice(0, 40),
      ratio: Math.round(ratio(effective, background) * 100) / 100,
      needed: large ? 3 : 4.5,
      size: Math.round(size),
    })
  }
  return JSON.stringify(results)
})()`

const browser = await openBrowser(
  join(tmpdir(), 'acai-doce-sabor-conferencia', 'edge-profile-contraste'),
  9336,
)
let failures = 0
let measured = 0
let lowest = { ratio: Infinity }

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      await browser.goto(baseUrl + route, viewport)
      const items = JSON.parse(await browser.evaluate(measure))
      const bad = items.filter((item) => item.ratio < item.needed)
      const min = items.reduce((a, b) => (b.ratio < a.ratio ? b : a))

      measured += items.length
      failures += bad.length
      if (min.ratio < lowest.ratio) lowest = { ...min, route, width: viewport.width }

      console.log(
        `${viewport.width}px ${route} -> ${items.length} textos, menor contraste ${min.ratio}:1 ("${min.text}", ${min.size}px)` +
          (bad.length
            ? ` | ABAIXO DO AA: ${bad.map((b) => `"${b.text}" ${b.ratio}:1 (pede ${b.needed}:1)`).join('; ')}`
            : ''),
      )
    }
  }
} catch (error) {
  console.error('ERRO NA MEDIÇÃO:', error)
  failures++
} finally {
  browser.close()
}

console.log(`TOTAL: ${measured} textos medidos, ${failures} abaixo do AA`)
if (measured) {
  console.log(
    `MENOR CONTRASTE: ${lowest.ratio}:1 em "${lowest.text}" (${lowest.route}, ${lowest.width}px)`,
  )
}
process.exit(failures === 0 ? 0 : 1)
