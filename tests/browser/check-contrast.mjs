// Mede o contraste de todo texto visível de cada página, contra o fundo real atrás
// dele, e compara com o nível AA da WCAG: 4,5:1, ou 3:1 para texto grande.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-contrast.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'

// Funções usadas pelos estados preparados abaixo (rodam dentro da página).
const prepare = `
  window.__wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.__clickText = (selector, text) => [...document.querySelectorAll(selector)].find((el) => el.textContent.includes(text)).click();
  window.__type = (selector, text) => {
    const el = document.querySelector(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  window.__build = async () => {
    document.querySelector('input[value="pote-200"]').click();
    await __wait(150);
    document.querySelector('[aria-label="Adicionar Granola"]').click();
    await __wait(150);
    __clickText('button', 'Adicionar ao carrinho');
    await __wait(500);
  };
  window.__toCart = async () => {
    await __build();
    __clickText('dialog button', 'ir para o carrinho');
    await __wait(600);
  };
  window.__pay = async (method) => {
    document.querySelector('input[value="' + method + '"]').click();
    await __wait(400);
  };
  // Cardápio completo (2026-11-15): abre todas as gavetas fechadas.
  window.__openDrawers = async () => {
    for (const button of document.querySelectorAll('[data-drawer] > :first-child button[aria-expanded="false"]')) {
      button.click();
      await __wait(80);
    }
    await __wait(600);
  };
  true;
`

// Páginas, e estados que só aparecem depois de clicar (`setup` roda antes de medir).
const routes = [
  '/',
  '/monte-seu-pedido',
  '/monte-seu-pedido/acai-oca',
  '/monte-seu-pedido/milk-shake',
  '/nao-existe',
  { path: '/monte-seu-pedido/acai-tradicional', label: 'janela de confirmação do item', setup: `__build()` },
  {
    path: '/monte-seu-pedido/acai-tradicional',
    label: 'carrinho: dinheiro com valor menor que o total',
    setup: `(async () => { await __toCart(); await __pay('dinheiro'); __type('#troco-para', '5'); await __wait(300) })()`,
  },
  {
    path: '/carrinho',
    label: 'carrinho: troco calculado e WhatsApp aberto',
    setup: `(async () => { window.open = () => ({}); await __pay('dinheiro'); __type('#troco-para', '100'); await __wait(300); __clickText('button', 'Confirmar e Enviar Pedido'); await __wait(400) })()`,
  },
  {
    path: '/carrinho',
    label: 'carrinho: Pix e aviso de forma de pagamento',
    setup: `(async () => { __clickText('button', 'Confirmar e Enviar Pedido'); await __wait(300); await __pay('pix') })()`,
  },
  {
    path: '/carrinho',
    label: 'carrinho: sem forma de pagamento escolhida',
    setup: `(async () => { __clickText('button', 'Confirmar e Enviar Pedido'); await __wait(400) })()`,
  },
  // Cardápio completo: gavetas, busca, escolha de sabor, aviso e os produtos das gavetas.
  { path: '/monte-seu-pedido', label: 'todas as gavetas abertas', setup: `__openDrawers()` },
  {
    path: '/monte-seu-pedido',
    label: 'busca com resultado',
    setup: `(async () => { __type('#busca-cardapio', 'chocolate'); await __wait(600) })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'busca sem resultado',
    setup: `(async () => { __type('#busca-cardapio', 'xyz'); await __wait(500) })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'escolha de sabor com aviso de erro',
    setup: `(async () => { document.querySelector('[data-item="kit-completo-casquinha"] button').click(); await __wait(600); __clickText('dialog[open] button', 'Continuar'); await __wait(400) })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'aviso de item adicionado',
    setup: `(async () => { document.querySelector('[data-item="combo-de-sorvete"] button').click(); await __wait(600); __clickText('dialog[open] button', 'continuar comprando'); await __wait(600) })()`,
  },
  { path: '/carrinho', label: 'carrinho com item das gavetas', setup: `__wait(300)` },
  '/monte-seu-pedido/pote-de-acai-1-litro',
  '/monte-seu-pedido/barca-de-acai',
  // Notificação flutuante de oferta (aparece 4 s depois de abrir a página).
  {
    path: '/monte-seu-pedido',
    label: 'notificação de oferta',
    setup: `(async () => { for (let i = 0; i < 100 && !document.querySelector('aside[aria-label="Oferta"]'); i++) await __wait(100); await __wait(500); return !!document.querySelector('aside[aria-label="Oferta"]') })()`,
  },
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
  let skippedDisabled = 0
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
    // A WCAG dispensa de contraste os controles inativos (desabilitados).
    if (element.closest('button:disabled, input:disabled, fieldset:disabled, [aria-disabled="true"]')) {
      skippedDisabled++
      continue
    }
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
  return JSON.stringify({ results, skippedDisabled })
})()`

const browser = await openBrowser(
  join(tmpdir(), 'acai-doce-sabor-conferencia', 'edge-profile-contraste'),
  9336,
)
let failures = 0
let measured = 0
let skipped = 0
let lowest = { ratio: Infinity }

try {
  for (const viewport of viewports) {
    // Carrinho vazio no começo de cada largura: os estados acima põem um item.
    await browser.goto(baseUrl + '/', viewport)
    await browser.evaluate(`localStorage.clear(); true`)
    for (const entry of routes) {
      const { path, label, setup } = typeof entry === 'string' ? { path: entry } : entry
      const route = label ? `${path} (${label})` : path
      await browser.goto(baseUrl + path, viewport)
      if (setup) {
        await browser.evaluate(prepare)
        await browser.evaluate(setup)
      }
      const { results: items, skippedDisabled } = JSON.parse(await browser.evaluate(measure))
      skipped += skippedDisabled
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

console.log(
  `TOTAL: ${measured} textos medidos, ${failures} abaixo do AA (${skipped} em controles desabilitados, dispensados pela WCAG)`,
)
if (measured) {
  console.log(
    `MENOR CONTRASTE: ${lowest.ratio}:1 em "${lowest.text}" (${lowest.route}, ${lowest.width}px)`,
  )
}
process.exit(failures === 0 ? 0 : 1)
