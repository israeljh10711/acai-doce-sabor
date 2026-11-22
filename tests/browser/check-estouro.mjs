// Confere no navegador que nenhum texto passa da caixa em volta dele (fundo, borda, anel ou
// recorte) nem da tela, em celular estreito (pedido de 2026-11-22, depois do "R$ 10,00" vazando da
// caixinha "A partir de" do Açaí Oca no celular). Num segundo site na porta 5185, sem o Supabase.
// - a loja, o cardápio, cada personalizador e o carrinho, como cliente e no Modo Vendedor, em 320,
//   360 e 390 px; o corte com reticências ("…") de propósito não conta;
// - as 3 caixinhas do destaque do Açaí Oca de 320 a 1440 px, com o preço de verdade e com
//   "R$ 100,00": o texto inteiro dentro da caixinha, sem cortar.
//
// Uso: node tests/browser/check-estouro.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5185
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'estouro')
mkdirSync(outDir, { recursive: true })
const failures = []
let checks = 0

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

// Sem o Supabase: as variáveis do processo valem mais que o .env.local.
process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_ANON_KEY = ''
process.env.VITE_SELLER_EMAIL = ''
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-estouro'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

/**
 * Cada pedaço de texto visível contra a caixa mais próxima em volta dele e contra a tela. Fica de
 * fora: texto só para leitores de tela (1 px), o que está dentro de uma faixa que rola de lado
 * (as categorias) e o corte com reticências feito de propósito.
 */
function scan() {
  const isBox = (el) => {
    const s = getComputedStyle(el)
    const background = s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent'
    const border = parseFloat(s.borderLeftWidth) > 0 || parseFloat(s.borderRightWidth) > 0
    return background || border || s.boxShadow !== 'none' || s.overflowX !== 'visible'
  }
  const scrolls = (el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)
  const hidden = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const s = getComputedStyle(node)
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return true
      const r = node.getBoundingClientRect()
      if (s.overflow === 'hidden' && r.width <= 1 && r.height <= 1) return true
    }
    return false
  }
  const name = (node) => node.tagName.toLowerCase() + [...node.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 2).map((a) => `[${a.name}]`).join('')
  const found = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const label = text.textContent.trim()
    const el = text.parentElement
    if (!label || !el || el.closest('script,style,svg,noscript,template') || hidden(el)) continue
    const range = document.createRange()
    range.selectNodeContents(text)
    const t = range.getBoundingClientRect()
    if (t.width === 0) continue
    // Corte com reticências de propósito: o próprio elemento recorta e mostra "…".
    const ellipsis = (node) => getComputedStyle(node).textOverflow === 'ellipsis' && getComputedStyle(node).overflowX !== 'visible'
    if (ellipsis(el)) continue
    let box = el
    let inScroller = false
    while (box && box !== document.body && !isBox(box)) box = box.parentElement
    for (let node = el; node && node !== document.body; node = node.parentElement) if (scrolls(node)) inScroller = true
    if (inScroller) continue
    const where = `${name(el)} "${label.slice(0, 32)}"`
    if (t.right > innerWidth + 0.5 || t.left < -0.5) found.push(`${where} sai da tela ${Math.round(Math.max(t.right - innerWidth, -t.left))}px`)
    if (!box || box === document.body) continue
    const b = box.getBoundingClientRect()
    const by = Math.max(t.right - b.right, b.left - t.left)
    if (by > 0.5) found.push(`${where} passa ${Math.round(by)}px de ${name(box)}`)
  }
  const page = document.documentElement.scrollWidth - innerWidth
  if (page > 0) found.push(`rolagem lateral de ${page}px`)
  return found
}

/** As 3 caixinhas do destaque do Açaí Oca: quanto sobra de cada lado do texto (negativo: vaza). */
function featuredFacts() {
  const dl = document.querySelector('#acai-oca-titulo')?.closest('article')?.querySelector('dl')
  if (!dl) return null
  const boxes = [...dl.querySelectorAll(':scope > div, :scope > * > div')].filter((box) => box.querySelector('dt'))
  const parts = boxes.map((box) => {
    const b = box.getBoundingClientRect()
    return [...box.querySelectorAll('dt, dd')].map((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const t = range.getBoundingClientRect()
      return { text: el.textContent, room: Math.round(Math.min(t.left - b.left, b.right - t.right)), centered: Math.abs(t.left - b.left - (b.right - t.right)) <= 1.5 }
    })
  })
  // A arrumação: as três numa linha, ou o preço numa linha inteira e as outras duas embaixo.
  const [price, sizes, kinds] = boxes.map((box) => box.getBoundingClientRect())
  const list = dl.getBoundingClientRect()
  const same = (a, b) => Math.abs(a - b) <= 1
  const layout =
    boxes.length !== 3 ? `${boxes.length} caixinhas`
    : same(price.top, sizes.top) && same(sizes.top, kinds.top) ? 'três numa linha'
    : same(price.width, list.width) && price.bottom <= sizes.top && same(sizes.top, kinds.top) ? 'preço em cima, duas embaixo'
    : 'outra'
  return { parts, layout }
}

const browser = await openBrowser(join(outDir, 'edge-profile'), 9385)
try {
  // --- Os personalizadores, pelos links do cardápio ---
  await browser.goto(`${baseUrl}/monte-seu-pedido`, { width: 1280, height: 900 })
  const slugs = await browser.evaluate(`[...new Set([...document.querySelectorAll('a[href^="/monte-seu-pedido/"]')].map((a) => a.getAttribute('href').split('/')[2]).filter(Boolean))]`)
  check('o cardápio leva aos personalizadores (Açaí Oca, Barca e Batido entre eles)', ['acai-oca', 'barca-de-acai', 'acai-batido'].every((slug) => slugs.includes(slug)), true)
  const routes = ['/', '/monte-seu-pedido', ...slugs.map((slug) => `/monte-seu-pedido/${slug}`), '/carrinho']

  // --- Varredura em celular estreito, como cliente e no Modo Vendedor ---
  const cart = JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'e1', itemId: 'jujuba', choices: [], quantity: 2 }] })
  for (const seller of [false, true]) {
    await browser.goto(`${baseUrl}/`, { width: 390, height: 844 })
    await browser.evaluate(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cart)}); sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); ${seller ? "localStorage.setItem('acai_doce_sabor_seller_session_v1', '1');" : ''} true`)
    for (const width of [320, 360, 390]) {
      const problems = []
      for (const route of routes) {
        await browser.goto(`${baseUrl}${route}`, { width, height: 844 })
        // Rola até o fim (fotos e seções que carregam ao aparecer) e mede de volta no topo.
        await browser.evaluate(`(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } scrollTo(0, 0); return true })()`)
        await sleep(250)
        for (const problem of await browser.evaluate(`(${scan.toString()})()`)) problems.push(`${route}: ${problem}`)
      }
      check(`${seller ? 'Modo Vendedor' : 'cliente'}, ${width}px: nenhum texto passa da caixa nem da tela (${routes.length} páginas)`, problems, [])
      if (width === 320) writeFileSync(join(outDir, `${seller ? 'vendedor' : 'cliente'}-320-cardapio.png`), await browser.screenshot())
    }
  }

  // --- O destaque do Açaí Oca, de 320 a 1440 px, com o preço de verdade e com R$ 100,00 ---
  await browser.evaluate(`localStorage.removeItem('acai_doce_sabor_seller_session_v1'); true`)
  for (const width of [320, 360, 375, 390, 414, 430, 640, 768, 1024, 1280, 1440]) {
    await browser.goto(`${baseUrl}/monte-seu-pedido`, { width, height: 900 })
    for (const price of [null, 'R$ 100,00']) {
      if (price) await browser.evaluate(`(() => { const dd = document.querySelector('#acai-oca-titulo').closest('article').querySelector('dl dd'); dd.textContent = ${JSON.stringify(price)}; dd.style.setProperty('--chars', ${price.length}); return true })()`)
      const facts = await browser.evaluate(`(${featuredFacts.toString()})()`)
      const bad = (facts?.parts ?? []).flat().filter((part) => part.room < 2 || !part.centered).map((part) => `"${part.text}" sobra ${part.room}px${part.centered ? '' : ', fora do centro'}`)
      check(`destaque do Açaí Oca, ${width}px${price ? ` com ${price}` : ''}: as 3 caixinhas com o texto inteiro dentro, centralizado`, facts ? bad : 'cartão não encontrado', [])
      // Celular: o preço numa linha inteira; a partir de 640 px (tablet e computador), três numa linha.
      if (!price) check(`destaque do Açaí Oca, ${width}px: arrumação das caixinhas`, facts?.layout, width < 640 ? 'preço em cima, duas embaixo' : 'três numa linha')
    }
    if (width === 360) writeFileSync(join(outDir, 'destaque-360.png'), await browser.screenshot())
  }
  const problems = browser.consoleProblems()
  check('sem erros no console', problems, [])
} finally {
  browser.close()
  await site.close()
}

console.log(`${checks - failures.length}/${checks} conferências passaram. Fotos em ${outDir}`)
if (failures.length) {
  console.log(failures.map((failure) => `FALHA ${failure}`).join('\n'))
  process.exit(1)
}
