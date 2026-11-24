// Mede o contraste de todo texto visível de cada página, contra o fundo real atrás
// dele, e compara com o nível AA da WCAG: 4,5:1, ou 3:1 para texto grande.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-contrast.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openBrowser } from './lib.mjs'

// Cardápio dinâmico (2026-11-21): o esgotado fica nos registros do cardápio no aparelho.
const { baseCatalogRecords } = await import(pathToFileURL(join(process.cwd(), 'src', 'features', 'catalog', 'baseRecords.ts')).href)
const { recordsToDatabase, LOCAL_CATALOG_KEY } = await import(pathToFileURL(join(process.cwd(), 'src', 'services', 'catalogRepository.ts')).href)
/** Grava no aparelho o cardápio da semente com estes produtos e complementos esgotados. */
const soldOut = ({ products = [], options = [] }) => {
  const records = baseCatalogRecords()
  const data = recordsToDatabase({
    ...records,
    products: records.products.map((product) => (products.includes(product.id) ? { ...product, available: false } : product)),
    options: records.options.map((option) => (options.includes(option.id) ? { ...option, available: false } : option)),
  })
  return `localStorage.setItem(${JSON.stringify(LOCAL_CATALOG_KEY)}, ${JSON.stringify(JSON.stringify(data))});`
}

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
    // O personalizador carrega sob demanda: espera o primeiro campo (até 8 s) antes de clicar.
    for (let i = 0; i < 80 && !document.querySelector('input[value="pote-200"]'); i++) await __wait(100);
    document.querySelector('input[value="pote-200"]').click();
    await __wait(150);
    document.querySelector('[aria-label="Granola"]').click();
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
  // Cardápio completo (2026-11-16): as seções começam abertas; abre alguma que esteja recolhida.
  window.__openDrawers = async () => {
    for (const button of document.querySelectorAll('[data-section] [data-toggle][aria-expanded="false"]')) {
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
    label: 'carrinho: troco calculado',
    setup: `(async () => { __type('input[autocomplete="name"]', 'Cliente Teste'); document.querySelector('input[value="retirada"]').click(); await __wait(300); await __pay('dinheiro'); __type('#troco-para', '100'); await __wait(400) })()`,
  },
  {
    path: '/carrinho',
    label: 'carrinho: Pix e aviso de forma de pagamento',
    setup: `(async () => { __clickText('button', 'Finalizar pedido'); await __wait(300); await __pay('pix') })()`,
  },
  {
    path: '/carrinho',
    label: 'carrinho: sem forma de pagamento escolhida',
    setup: `(async () => { __clickText('button', 'Finalizar pedido'); await __wait(400) })()`,
  },
  // Pedido 100% no site (2026-11-20): o acompanhamento, a faixa do pedido e o modo de adição.
  {
    path: '/carrinho',
    label: 'pedido recebido: acompanhamento (demonstração)',
    setup: `(async () => { __type('input[autocomplete="name"]', 'Cliente Teste'); document.querySelector('input[value="retirada"]').click(); await __wait(300); await __pay('pix'); document.querySelector('[data-finalize]').click(); await __wait(1500) })()`,
  },
  { path: '/acompanhar', label: 'meus pedidos' },
  {
    path: '/carrinho',
    label: 'carrinho: frete a combinar (telefone obrigatório) e lembrar meus dados',
    before: `localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'c1', itemId: 'jujuba', choices: [], quantity: 1 }] })); true`,
    setup: `(async () => { document.querySelector('input[value="entrega"]').click(); await __wait(400); document.querySelector('[data-remember-me]').click(); await __wait(200); document.querySelector('[data-finalize]').click(); await __wait(400) })()`,
  },
  { path: '/', label: 'faixa do pedido em andamento' },
  {
    path: '/carrinho',
    label: 'modo de adição: faixa e confirmação',
    before: `(() => { const order = JSON.parse(localStorage.getItem('acai_doce_sabor_meus_pedidos_v1'))[0]; localStorage.setItem('acai_doce_sabor_adicionar_v1', JSON.stringify({ orderId: order.id, code: order.code, startedAt: Date.now() })); localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'z1', itemId: 'jujuba', choices: [], quantity: 2 }] })); return true })()`,
    setup: `(async () => { await __wait(800); document.querySelector('[data-add-panel] details')?.setAttribute('open', ''); await __wait(300) })()`,
  },
  {
    path: '/',
    label: 'modo de adição: fim (cancelar)',
    setup: `(async () => { document.querySelector('[data-add-mode-cancel]')?.click(); await __wait(1200) })()`,
  },
  // Cardápio completo: seções, navegação, busca, escolha de sabor, aviso e os produtos do catálogo.
  { path: '/monte-seu-pedido', label: 'as 5 seções abertas', setup: `__openDrawers()` },
  {
    path: '/monte-seu-pedido',
    label: 'seção marcada na navegação e o contorno orquídea',
    setup: `(async () => { const link = [...document.querySelectorAll('a[data-nav="secao-bebidas"], a[data-target="secao-bebidas"]')].find((a) => a.getBoundingClientRect().width > 0); link.click(); await __wait(700); return true })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'menu das categorias aberto (celular) ou barra lateral (computador)',
    setup: `(async () => { const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Categorias'); if (button && button.getBoundingClientRect().width > 0) { button.click(); await __wait(600) } return true })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'busca com resultado: contagens e seções sem resultado apagadas na navegação',
    setup: `(async () => { __type('#busca-cardapio', 'refri'); await __wait(600); return true })()`,
  },
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
    setup: `(async () => { document.querySelector('[data-item="kit-completo-casquinha"] button:not([data-zoom])').click(); await __wait(600); __clickText('dialog[open] button', 'Continuar'); await __wait(400) })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'aviso de item adicionado',
    setup: `(async () => { document.querySelector('[data-item="pote-de-acai-2-litros"] button:not([data-zoom])').click(); await __wait(600); __clickText('dialog[open] button', 'continuar comprando'); await __wait(600) })()`,
  },
  { path: '/carrinho', label: 'carrinho com item do catálogo', setup: `__wait(300)` },
  // Foto ampliada (pedido de 2026-11-16): nome, preço, botão e descrição sobre o fundo escuro.
  {
    path: '/monte-seu-pedido',
    label: 'foto ampliada',
    setup: `(async () => { document.querySelector('[data-item="pote-de-acai-1-litro"] [data-zoom]').click(); await __wait(800); return document.querySelector('dialog[aria-labelledby="foto-ampliada-titulo"]').open })()`,
  },
  '/monte-seu-pedido/pote-de-acai-1-litro',
  '/monte-seu-pedido/barca-de-acai',
  // Notificação flutuante de oferta (aparece 4 s depois de abrir a página).
  {
    path: '/monte-seu-pedido',
    label: 'notificação de oferta',
    setup: `(async () => { for (let i = 0; i < 100 && !document.querySelector('aside[aria-label="Oferta"]'); i++) await __wait(100); await __wait(500); return !!document.querySelector('aside[aria-label="Oferta"]') })()`,
  },
  // Operação do vendedor (pedido de 2026-11-17). Ficam no fim: gravam estado no aparelho (a próxima
  // largura começa com o aparelho limpo).
  {
    path: '/',
    label: 'loja fechada pelo vendedor: selo e aviso',
    before: `localStorage.setItem('acai_doce_sabor_seller_catalog_v1', JSON.stringify({ settings: { loja: { override: { state: 'closed', until: Date.now() + 36e5 }, delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] } } } })); true`,
  },
  {
    path: '/carrinho',
    label: 'carrinho: entrega por bairro, loja fechada e item esgotado',
    before: `localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'c1', itemId: 'jujuba', choices: [], quantity: 1 }, { kind: 'extra', id: 'c2', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 }] })); localStorage.setItem('acai_doce_sabor_seller_catalog_v1', JSON.stringify({ settings: { loja: { override: { state: 'closed', until: Date.now() + 36e5 }, delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] } } } })); ${soldOut({ products: ['jujuba'] })} true`,
    setup: `(async () => { document.querySelector('input[value="entrega"]').click(); await __wait(400); __clickText('button', 'Finalizar pedido'); await __wait(400); document.querySelector('[data-note-add]').click(); await __wait(300) })()`,
  },
  {
    path: '/monte-seu-pedido',
    label: 'modo vendedor: aba Painel, Disponível / Esgotado e Duplicar',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); ${soldOut({ products: ['jujuba'] })} true`,
  },
  {
    path: '/monte-seu-pedido/acai-tradicional',
    label: 'modo vendedor: complementos com Disponível / Esgotado',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); ${soldOut({ options: ['granola'] })} true`,
  },
  // Painel do Modo Vendedor (2026-11-23): os três blocos.
  {
    path: '/painel',
    label: 'painel do vendedor: Operação, Loja e cardápio, Segurança e sessão',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `__wait(600)`,
  },
  // Painel do vendedor (cardápio dinâmico, 2026-11-21).
  {
    path: '/vendedor',
    label: 'painel do vendedor: catálogo',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `__wait(600)`,
  },
  {
    path: '/vendedor?aba=categorias',
    label: 'painel do vendedor: categorias e editor',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `(async () => { await __wait(500); document.querySelector('[data-category="bebidas"] [data-edit-category]').click(); await __wait(700) })()`,
  },
  {
    path: '/vendedor?aba=produtos',
    label: 'painel do vendedor: produtos (oculto e esgotado)',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); ${soldOut({ products: ['jujuba'] })} true`,
    setup: `__wait(700)`,
  },
  {
    path: '/vendedor?aba=produtos',
    label: 'painel do vendedor: editor de produto montável com erro',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `(async () => { await __wait(500); document.querySelector('[data-product="acai-oca"] [data-edit-product]').click(); await __wait(900); const input = document.querySelector('#produto-nome'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); await __wait(200); document.querySelector('dialog[open] [data-save]').click(); await __wait(500) })()`,
  },
  {
    path: '/vendedor?aba=complementos',
    label: 'painel do vendedor: complementos',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); ${soldOut({ options: ['granola'] })} true`,
    setup: `__wait(700)`,
  },
  {
    path: '/vendedor?aba=ofertas',
    label: 'painel do vendedor: ofertas e editor',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `(async () => { await __wait(500); document.querySelector('[data-offer] [data-toggle-offer]').click(); await __wait(500); document.querySelector('[data-edit-offer]').click(); await __wait(700) })()`,
  },
  {
    path: '/vendedor?aba=loja',
    label: 'painel do vendedor: Configurações da loja (taxa por bairro, horário por dia)',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `(async () => { await __wait(600); document.querySelector('input[name="loja-frete"][value="taxas"]').click(); await __wait(300); document.querySelector('[data-add-zone]').click(); await __wait(300); [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Mesmo horário todos os dias')).querySelector('input').click(); await __wait(400) })()`,
  },
  {
    path: '/painel',
    label: 'painel do vendedor: Tempo de entrega',
    before: `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`,
    setup: `(async () => { document.querySelector('[data-delivery-time]').click(); await __wait(600) })()`,
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
  let skippedDecorative = 0
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
    // A WCAG (1.4.3, "texto incidental") também dispensa o texto que é pura decoração. Só vale o
    // marcado de propósito: escondido dos leitores de tela E com data-decorative (2026-11-22: a
    // palavra "Açaí" gigante e quase transparente do rodapé). Contado à parte no total.
    if (element.closest('[aria-hidden="true"][data-decorative]')) {
      skippedDecorative++
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
  return JSON.stringify({ results, skippedDisabled, skippedDecorative })
})()`

const browser = await openBrowser(
  join(tmpdir(), 'acai-doce-sabor-conferencia', 'edge-profile-contraste'),
  9336,
)
let failures = 0
let measured = 0
let skipped = 0
let decorative = 0
let lowest = { ratio: Infinity }

try {
  for (const viewport of viewports) {
    // Carrinho vazio no começo de cada largura: os estados acima põem um item.
    await browser.goto(baseUrl + '/', viewport)
    await browser.evaluate(`localStorage.clear(); true`)
    for (const entry of routes) {
      const { path, label, setup, before } = typeof entry === 'string' ? { path: entry } : entry
      const route = label ? `${path} (${label})` : path
      // `before`: grava um estado no aparelho (modo vendedor, loja fechada...) e abre de novo.
      if (before) {
        await browser.goto(baseUrl + path, viewport)
        await browser.evaluate(before)
      }
      await browser.goto(baseUrl + path, viewport)
      if (setup) {
        await browser.evaluate(prepare)
        await browser.evaluate(setup)
      }
      const { results: items, skippedDisabled, skippedDecorative } = JSON.parse(await browser.evaluate(measure))
      skipped += skippedDisabled
      decorative += skippedDecorative
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
  `TOTAL: ${measured} textos medidos, ${failures} abaixo do AA (${skipped} em controles desabilitados e ${decorative} decorativos marcados, dispensados pela WCAG)`,
)
if (measured) {
  console.log(
    `MENOR CONTRASTE: ${lowest.ratio}:1 em "${lowest.text}" (${lowest.route}, ${lowest.width}px)`,
  )
}
process.exit(failures === 0 ? 0 : 1)
