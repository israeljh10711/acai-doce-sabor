// Confere no navegador a foto ampliada (pedido de 2026-11-16), no celular (390 px) e no computador
// (1280 px): abre em cada lugar com foto, sem disparar o que o cartão faz (abrir o personalizador,
// marcar o adicional, escolher a cobertura, aceitar a oferta, pôr no carrinho); mostra nome, preço,
// descrição e a foto carregada; amplia e reduz (botão e toque duplo); fecha no X, no Esc e no fundo
// escuro; o foco volta para quem abriu.
//
// Uso (com o site rodando, por exemplo em `npm run dev`): node tests/browser/check-lightbox.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'foto-ampliada')
const failures = []
let checks = 0

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__box = () => __q('dialog[aria-labelledby="foto-ampliada-titulo"]');
  window.__isOpen = () => !!__box()?.open;
  window.__img = () => __box()?.querySelector('img');
  window.__info = async () => {
    const box = __box();
    if (!box?.open) return null;
    const img = __img();
    await img.decode().catch(() => null);
    for (let i = 0; i < 30 && img.classList.contains('opacity-0'); i++) await new Promise((r) => setTimeout(r, 100));
    return {
      id: box.dataset.lightbox,
      title: box.querySelector('h2').textContent,
      price: box.querySelector('h2 + span')?.textContent ?? null,
      loaded: img.naturalWidth > 0,
      fit: getComputedStyle(img).objectFit,
      alt: img.alt.length > 0,
    };
  };
  window.__size = () => { const r = __img().getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] };
  window.__zoomBtn = () => [...__box().querySelectorAll('button')].find((b) => /Ampliar|Reduzir/.test(b.textContent));
  window.__zoomOf = (root) => __q(root + ' [data-zoom]');
  window.__cartCount = () => Number((__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0]);
  window.__type = (selector, text) => {
    const el = __q(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  true;
`

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const browser = await openBrowser(join(outDir, 'edge-profile'), 9363)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const waitFor = async (condition, timeout = 8000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`)) return true
    await sleep(100)
  }
  return false
}
const page = async (path, viewport, setup = '') => {
  await browser.goto(baseUrl + path, viewport)
  await waitFor(`document.querySelector('h1')`)
  if (setup) {
    await run(setup)
    await browser.goto(baseUrl + path, viewport)
    await waitFor(`document.querySelector('h1')`)
  }
  await run(`window.scrollTo(0, 0); true`)
}
const click = async (expression, pause = 500) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
// Clique de verdade (mouse) no centro do elemento: confere que o que está por cima é a lupa.
const realClick = async (expression, count = 1) => {
  const point = await run(`(() => { const el = ${expression}; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
  await sleep(250)
  for (let n = 1; n <= count; n++) {
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: n })
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: n })
  }
  await sleep(600)
}
const key = async (keyName) => {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: 27 })
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: 27 })
  await sleep(500)
}
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); localStorage.clear(); true`

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    await page('/monte-seu-pedido', viewport, quiet)
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true })

    // --- Vitrine: os 4 produtos principais ---
    for (const [slug, title, price] of [
      ['acai-oca', 'Açaí Oca', 'A partir de R$ 10,00'],
      ['acai-tradicional', 'Açaí Tradicional', 'A partir de R$ 6,00'],
      ['acai-batido', 'Açaí Batido', 'A partir de R$ 10,00'],
      ['milk-shake', 'Milk-shake', 'A partir de R$ 10,00'],
    ]) {
      await realClick(`__zoomOf('#${slug}')`)
      check(
        `${at} vitrine ${slug}: abre a foto da loja, sem sair do cardápio`,
        [await run(`__info()`), await run(`location.pathname`)],
        [{ id: `produto:${slug}`, title, price, loaded: true, fit: 'contain', alt: true }, '/monte-seu-pedido'],
      )
      await click(`__box().querySelector('button[aria-label="Fechar imagem"]')`)
      check(`${at} vitrine ${slug}: o X fecha e o foco volta para a lupa`, await run(`[__isOpen(), document.activeElement?.dataset.zoom]`), [false, `produto:${slug}`])
    }

    // --- Gavetas: 43 lupas, uma por item; abrir não escolhe sabor nem põe no carrinho ---
    for (const id of ['barcas-e-potes', 'picoles-e-sorvetes', 'bebidas', 'doces-e-bomboniere']) await click(`__q('#${id}-gaveta')`, 400)
    check(`${at} uma lupa em cada um dos 43 itens das gavetas`, await run(`document.querySelectorAll('[data-item] [data-zoom]').length`), 43)
    await realClick(`__zoomOf('[data-item="kit-completo-casquinha"]')`)
    check(
      `${at} kit: foto, nome e preço, sem abrir a escolha de sabor`,
      [await run(`__info()`), await run(`!!__q('dialog[aria-labelledby="opcoes-item-titulo"]')?.open`), await run(`__cartCount()`)],
      [{ id: 'item:kit-completo-casquinha', title: 'Kit Completo Casquinha', price: 'R$ 41,00', loaded: true, fit: 'contain', alt: true }, false, 0],
    )
    check(`${at} kit: descrição e aviso de imagem ilustrativa`, await run(`['Pote de sorvete 2 litros + 1 cobertura + 10 casquinhas', 'Imagens meramente ilustrativas'].map((t) => __box().textContent.includes(t))`), [true, true])
    // Ampliar e reduzir: botão e toque duplo.
    const fit = await run(`__size()`)
    await click(`__zoomBtn()`)
    const big = await run(`__size()`)
    check(`${at} "Ampliar": a foto dobra de tamanho e o botão vira "Reduzir"`, [big[0] === fit[0] * 2, big[1] === fit[1] * 2, (await run(`__zoomBtn().textContent`)).trim()], [true, true, 'Reduzir'])
    check(`${at} ampliada: dá para rolar pela foto`, await run(`(() => { const v = __box().querySelector('[data-lightbox-view]'); return v.scrollWidth > v.clientWidth && v.scrollHeight > v.clientHeight })()`), true)
    await realClick(`__img()`, 2)
    check(`${at} toque duplo reduz de volta`, [await run(`__size()`), (await run(`__zoomBtn().textContent`)).trim()], [fit, 'Ampliar'])
    await realClick(`__img()`, 2)
    check(`${at} toque duplo amplia`, (await run(`__size()`))[0] === fit[0] * 2, true)
    await key('Escape')
    check(`${at} Esc fecha (e o próximo abre em 1x)`, await run(`__isOpen()`), false)
    // Toque no fundo escuro fecha.
    await realClick(`__zoomOf('[data-item="trident"]')`)
    check(`${at} Trident abre`, (await run(`__info()`))?.id, 'item:trident')
    await run(`(() => { const r = __box().getBoundingClientRect(); return true })()`)
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 6, y: viewport.height - 6, button: 'left', clickCount: 1 })
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 6, y: viewport.height - 6, button: 'left', clickCount: 1 })
    await sleep(500)
    check(`${at} toque no fundo escuro fecha`, await run(`__isOpen()`), false)
    // Tocar no resto do cartão continua funcionando.
    await click(`__q('[data-item="combo-de-sorvete"] button:not([data-zoom])')`)
    check(`${at} o botão do cartão continua abrindo a confirmação`, await waitFor(`__q('dialog[role="alertdialog"]')?.open`, 3000), true)
    // Foto dentro da confirmação: abre por cima; o Esc fecha só a foto.
    await realClick(`__q('dialog[role="alertdialog"] [data-zoom]')`)
    check(`${at} confirmação: a foto abre por cima da janela`, [await run(`__isOpen()`), await run(`__q('dialog[role="alertdialog"]').open`)], [true, true])
    await key('Escape')
    check(`${at} confirmação: o Esc fecha só a foto; nada no carrinho`, [await run(`__isOpen()`), await run(`__q('dialog[role="alertdialog"]').open`), await run(`__cartCount()`)], [false, true, 0])
    await click(`[...__q('dialog[role="alertdialog"]').querySelectorAll('button')].find((b) => b.textContent.includes('continuar comprando'))`, 900)

    // --- Personalizador: foto do produto, adicionais, frutas e caldas ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    await realClick(`__q('[aria-label="Prévia do pedido"] [data-zoom]')`)
    check(`${at} personalizador: a foto do produto amplia`, (await run(`__info()`))?.id, 'produto:acai-tradicional')
    await key('Escape')
    if (viewport.width < 1024) {
      await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Ver foto'))`)
      check(`${at} "Ver foto" abre a mesma foto ampliada`, (await run(`__info()`))?.id, 'produto:acai-tradicional')
      await key('Escape')
      check(`${at} "Ver foto": o foco volta para o botão`, await run(`document.activeElement?.textContent.trim().startsWith('Ver foto')`), true)
    }
    await realClick(`__q('[role="group"][aria-label="Granola: 0"]').parentElement.querySelector('[data-zoom]')`)
    check(
      `${at} adicional (Granola): abre a foto grande e não adiciona`,
      [(await run(`__info()`))?.title, (await run(`__info()`))?.price, await run(`!!__q('[role="group"][aria-label="Granola: 0"]')`)],
      ['Granola', 'Grátis', true],
    )
    check(`${at} Granola: a cópia grande, maior que a miniatura`, await run(`__img().naturalWidth > 256 && __img().currentSrc.endsWith('granola-grande.webp')`), true)
    await key('Escape')
    await realClick(`__q('[aria-label="Banana"]').parentElement.querySelector('[data-zoom]')`)
    check(`${at} fruta (Banana): abre a foto e não marca`, [(await run(`__info()`))?.title, await run(`__q('[aria-label="Banana"]').getAttribute('aria-pressed')`)], ['Banana', 'false'])
    await key('Escape')
    await realClick(`__q('[aria-label="Banana"]').parentElement.querySelector('span.font-semibold')`)
    check(`${at} fruta: tocar no nome do cartão ainda marca`, await run(`__q('[aria-label="Banana"]').getAttribute('aria-pressed')`), 'true')
    await realClick(`__q('[aria-label="Creme de ninho"]').parentElement.querySelector('[data-zoom]')`)
    check(`${at} creme (Creme de ninho): preço e grupo`, [(await run(`__info()`))?.price, await run(`__box().textContent.includes('Caldas e cremes')`), await run(`__q('[aria-label="Creme de ninho"]').getAttribute('aria-pressed')`)], ['+ R$ 3,00', true, 'false'])
    await key('Escape')
    check(`${at} uma lupa em cada foto de ingrediente do Tradicional`, await run(`document.querySelectorAll('img[data-fit]').length === document.querySelectorAll('img[data-fit] ~ [data-zoom]').length`), true)

    // --- Barca: a foto da cobertura amplia sem escolher a cobertura ---
    await page('/monte-seu-pedido/barca-de-acai', viewport)
    check(`${at} barca: uma lupa por cobertura`, await run(`document.querySelectorAll('input[name="barca-de-acai-sabor"]').length === [...document.querySelectorAll('input[name="barca-de-acai-sabor"]')].filter((i) => i.closest('label').parentElement.querySelector('[data-zoom]')).length`), true)
    await realClick(`__q('input[name="barca-de-acai-sabor"][value="calda-chocolate"]').closest('label').parentElement.querySelector('[data-zoom]')`)
    check(`${at} barca: cobertura de chocolate ampliada, "Inclusa", sem escolher`, [(await run(`__info()`))?.title, (await run(`__info()`))?.price, await run(`__q('input[value="calda-chocolate"]').checked`)], ['Chocolate', 'Inclusa', false])
    await key('Escape')

    // --- Carrinho ---
    await page('/carrinho', viewport)
    await realClick(`__q('[aria-label="Itens do carrinho"] [data-zoom]')`)
    check(`${at} carrinho: a foto do item amplia`, (await run(`__info()`))?.id, 'item:combo-de-sorvete')
    await key('Escape')

    // --- Notificação de oferta: a miniatura amplia, a oferta espera na tela ---
    await page('/monte-seu-pedido', viewport, `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: ['picole-gourmet'], last: null, dismissed: 0, stopped: false })); true`)
    await run(`window.scrollTo(0, 600); true`)
    check(`${at} oferta na tela`, await waitFor(`__q('aside[aria-label="Oferta"]')`, 9000), true)
    await sleep(600)
    await realClick(`__q('aside[aria-label="Oferta"] [data-zoom]')`)
    check(`${at} oferta: a miniatura amplia (com o texto da oferta), sem ir para a compra`, [(await run(`__info()`))?.title, await run(`location.pathname`), await run(`!!__q('dialog[aria-labelledby="opcoes-item-titulo"]')?.open`)], ['Picolé Gourmet Cremoso', '/monte-seu-pedido', false])
    await sleep(9000)
    check(`${at} oferta: segue na tela enquanto a foto está aberta (mais de 8 s)`, await run(`!!__q('aside[aria-label="Oferta"]')`), true)
    await key('Escape')
    check(`${at} oferta: a foto fecha e a oferta continua`, [await run(`__isOpen()`), await run(`!!__q('aside[aria-label="Oferta"]')`)], [false, true])

    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }
} catch (error) {
  failures.push(`erro inesperado: ${error.stack ?? error.message}`)
} finally {
  browser.close()
}

if (failures.length) {
  console.log(`FALHAS (${failures.length} de ${checks}):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
