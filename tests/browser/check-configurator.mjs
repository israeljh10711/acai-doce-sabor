// Usa o site como um cliente: monta açaí, açaí batido e milk-shake em qualquer ordem, confere a
// foto fixa do produto, as fotos reais dos ingredientes, os limites e os preços, e leva tudo ao
// carrinho.
//
// Uso: node tests/browser/check-configurator.mjs [endereçoBase] [pastaDeSaída]
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = process.argv[3] ?? join(tmpdir(), 'acai-doce-sabor-conferencia', 'personalizador')
mkdirSync(outDir, { recursive: true })

const failures = []
let checks = 0

// Funções que rodam dentro da página.
const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__label = (b) => b.getAttribute('aria-label') ?? b.textContent.trim();
  window.__button = (label) => [...document.querySelectorAll('button')].find((b) => __label(b) === label);
  window.__buttonStarting = (prefix) => [...document.querySelectorAll('button')].find((b) => __label(b).startsWith(prefix));
  window.__blocked = (label) => { const b = window.__button(label) ?? window.__buttonStarting(label); return !!b && (b.disabled || b.getAttribute('aria-disabled') === 'true') };
  window.__pressed = (label) => window.__button(label)?.getAttribute('aria-pressed');
  window.__radio = (value) => document.querySelector('input[type=radio][value="' + value + '"]');
  window.__text = () => document.body.innerText;
  window.__live = () => document.querySelector('[aria-live="polite"]').textContent;
  window.__photo = (root = '[aria-label="Prévia do pedido"]') => document.querySelector(root + ' [data-product-photo]')?.dataset.productPhoto;
  // A foto do produto carregou, aparece inteira (contain) e vem da pasta das fotos enviadas pela loja.
  window.__photoShown = async (root = '[aria-label="Prévia do pedido"]') => {
    const img = document.querySelector(root + ' [data-product-photo]');
    if (!img) return null;
    if (!img.complete) await new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }) });
    return { loaded: img.naturalWidth > 0, fit: getComputedStyle(img).objectFit, folder: new URL(img.currentSrc).pathname.split('/').slice(-2, -1)[0] };
  };
  window.__summary = () => __q('#resumo').innerText;
  // Janela "Confirme seu item antes de adicionar" e seus botões.
  window.__confirm = () => __q('dialog[role="alertdialog"]');
  window.__confirmText = () => (__confirm()?.open ? __confirm().textContent : null);
  window.__confirmButton = (text) => [...__confirm().querySelectorAll('button')].find((b) => b.textContent.includes(text));
  // Número do selo do carrinho no cabeçalho ("0" sem selo).
  window.__cartCount = () => (__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0];
  // Digita num campo controlado pelo React.
  window.__type = (selector, text) => {
    const el = __q(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  // Troca window.open para guardar o link do WhatsApp em vez de abrir outra aba.
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return {}; }; return true };
  window.__openedText = () => (window.__opened?.length ? new URL(window.__opened.at(-1)).searchParams.get('text') : null);
  // Transparência (alfa, 0 a 255) de pontos de uma foto, em frações da largura e da altura.
  window.__alpha = async (img, points) => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return points.map(([fx, fy]) => ctx.getImageData(Math.floor(fx * (canvas.width - 1)), Math.floor(fy * (canvas.height - 1)), 1, 1).data[3]);
  };
  window.__liveText = () => [...document.querySelectorAll('p[aria-live]')].map((p) => p.textContent).join('|');
  window.__groupNames = (title) => {
    const section = [...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.includes(title));
    return section ? [...section.querySelectorAll('li')].map((li) => li.querySelector('span.font-semibold')?.textContent) : null;
  };
  // Todas as fotos dos cartões de ingrediente respondem (as de baixo da tela carregam só ao rolar).
  window.__brokenThumbs = async () => {
    const sources = [...new Set([...document.querySelectorAll('img[data-fit]')].map((img) => img.src))];
    const results = await Promise.all(sources.map((src) => fetch(src).then((r) => (r.ok && r.headers.get('content-type')?.startsWith('image/') ? null : src))));
    return { total: sources.length, broken: results.filter(Boolean) };
  };
  window.__fits = () => Object.fromEntries([...document.querySelectorAll('img[data-fit]')].map((img) => [img.src.split('/').pop(), img.dataset.fit]));
  true;
`

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const browser = await openBrowser(join(outDir, 'edge-profile-principal'), 9337)
// Espera uma condição da página ficar verdadeira (até 10 s). Com o computador ocupado, a página
// do personalizador (carregada sob demanda) pode demorar mais que uma espera fixa.
const waitFor = async (condition, label = condition) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await browser.evaluate(`(() => { try { return !!(${condition}) } catch { return false } })()`)) {
      await browser.evaluate(helpers)
      return
    }
    await sleep(100)
  }
  throw new Error(`Esperou 10 s e não aconteceu: ${label}`)
}
const page = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await waitFor(`document.querySelector('h1')`)
}
const click = async (expression) => {
  await browser.evaluate(helpers)
  const ok = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(300)
}
// Clique de verdade (mouse), para o que exige gesto do usuário, como copiar para a área de transferência.
const realClick = async (expression) => {
  await browser.evaluate(helpers)
  const box = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!box) throw new Error(`Elemento não encontrado: ${expression}`)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await browser.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  }
  await sleep(400)
}
const key = async (keyName, code) => {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 })
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 })
  await sleep(400)
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    const desktop = viewport.width >= 1024

    // Carrinho vazio no começo de cada rodada.
    await page('/', viewport)
    await browser.evaluate(`localStorage.clear(); true`)

    // --- Página inicial: milk-shake recortado sobre o roxo ---
    const heroShake = `document.querySelector('figure [data-product-photo="milkshake"]')`
    check(
      `${at} início: milk-shake carregado, da pasta das fotos da loja, inteiro`,
      await browser.evaluate(`(async () => { const img = ${heroShake}; await img.decode(); return [img.naturalWidth > 0, new URL(img.currentSrc).pathname.split('/').slice(-2, -1)[0], getComputedStyle(img).objectFit] })()`),
      [true, 'produtos', 'contain'],
    )
    check(
      `${at} início: milk-shake com fundo transparente de verdade (cantos 0, copo 255)`,
      await browser.evaluate(`__alpha(${heroShake}, [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.55]])`),
      [0, 0, 0, 0, 255],
    )
    check(
      `${at} início: sem quadro branco em volta do milk-shake`,
      await browser.evaluate(`[getComputedStyle(${heroShake}).backgroundColor, getComputedStyle(${heroShake}.parentElement).backgroundColor]`),
      ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
    )

    // --- Açaí Tradicional: ordem livre ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    check(`${at} foto fixa e real do produto`, await browser.evaluate(`__photo()`), 'acai-tradicional')
    check(`${at} foto enviada pela loja, carregada e inteira`, await browser.evaluate(`__photoShown()`), { loaded: true, fit: 'contain', folder: 'produtos' })
    check(`${at} sem Biscoito no cardápio`, await browser.evaluate(`!/biscoito/i.test(__text())`), true)
    check(`${at} sem camadas montadas nem 3D`, await browser.evaluate(`!document.querySelector('[data-composer], canvas')`), true)
    check(
      `${at} adicionais com leite condensado e disquete`,
      await browser.evaluate(`__groupNames('Adicionais')`),
      ['Leite em pó', 'Granola', 'Paçoca', 'Chocoball', 'Amendoim', 'Gotas de chocolate', 'Canudinho', 'BIS', 'Farinha láctea', 'Sucrilhos', 'Marshmallow', 'Leite condensado', 'Disquete (confete)'],
    )
    check(
      `${at} caldas e cremes, na ordem pedida`,
      await browser.evaluate(`__groupNames('Caldas e cremes')`),
      ['Creme de ninho', 'Creme de avelã', 'Frutas vermelhas', 'Doce de leite', 'Açaí', 'Banana caramelada', 'Chocolate', 'Morango'],
    )
    const thumbs = await browser.evaluate(`__brokenThumbs()`)
    check(`${at} todas as ${thumbs.total} fotos de ingrediente carregam`, thumbs.broken, [])
    const fits = await browser.evaluate(`__fits()`)
    check(
      `${at} embalagens inteiras e texturas preenchendo o quadro`,
      [fits['leite-condensado.png'], fits['leite-em-po.png'], fits['farinha-lactea.png'], fits['cobertura-morango.png'], fits['banana.png'], fits['marshmallow.png'], fits['creme-avela.png']],
      ['contain', 'contain', 'contain', 'contain', 'cover', 'cover', 'cover'],
    )
    check(`${at} antes do tamanho, "Adicionar Granola" liberado`, await browser.evaluate(`__blocked('Adicionar Granola')`), false)
    check(`${at} antes do tamanho, Banana liberada`, await browser.evaluate(`__blocked('Banana')`), false)
    for (let i = 0; i < 4; i++) await click(`__button('Adicionar Granola')`)
    await click(`__button('Banana')`)
    await click(`__button('Creme de ninho')`)
    check(`${at} sem tamanho: escolhas aceitas, contador de escolhidos`, await browser.evaluate(`__text().includes('4 escolhidos · de 2 a 7 grátis')`), true)
    check(`${at} sem tamanho, o total espera o tamanho`, await browser.evaluate(`__summary().includes('Escolha o tamanho para ver o preço.')`), true)
    check(`${at} carrinho espera o tamanho`, await browser.evaluate(`__blocked('Adicionar ao carrinho')`), true)

    await click(`__radio('copo-500')`)
    check(`${at} copo 500 corta o que passa de 3 grátis`, await browser.evaluate(`__text().includes('Saíram por passar do novo limite: 1 Granola.')`), true)
    check(`${at} contador "3 de 3 adicionais grátis"`, await browser.evaluate(`__text().includes('3 de 3 adicionais grátis · limite atingido')`), true)
    check(`${at} com o limite cheio, "Adicionar Leite condensado" desabilitado`, await browser.evaluate(`__blocked('Adicionar Leite condensado')`), true)
    check(`${at} com o limite cheio, "Adicionar Kit Kat" habilitado`, await browser.evaluate(`__blocked('Adicionar Kit Kat')`), false)
    check(`${at} creme de ninho marcado, + R$ 3,00: R$ 15,00`, await browser.evaluate(`__pressed('Creme de ninho') === 'true' && __summary().includes('R$ 15,00')`), true)
    await click(`__button('Creme de ninho')`)
    check(`${at} creme é um só: tocar de novo desmarca (R$ 12,00)`, await browser.evaluate(`__pressed('Creme de ninho') === 'false' && __summary().includes('R$ 12,00')`), true)
    await click(`__button('Adicionar Kit Kat')`)
    await click(`__button('Adicionar Kit Kat')`)
    await click(`__button('cobertura de Banana caramelada')`)
    check(`${at} cobertura grátis marcada uma vez`, await browser.evaluate(`__pressed('cobertura de Banana caramelada')`), 'true')
    check(`${at} total R$ 20,00`, await browser.evaluate(`__summary().includes('R$ 20,00')`), true)
    check(`${at} a foto não muda com os ingredientes`, await browser.evaluate(`__photo()`), 'acai-tradicional')

    await click(`__radio('isopor-m')`)
    check(`${at} no isopor, a mesma foto do Tradicional`, await browser.evaluate(`__photo()`), 'acai-tradicional')
    await sleep(500)
    writeFileSync(join(outDir, `tradicional-isopor-${viewport.width}.png`), await browser.screenshot())

    if (!desktop) {
      await click(`__button('Ver foto')`)
      check(`${at} "Ver foto" abre a foto grande`, await browser.evaluate(`__q('dialog').open`), true)
      check(`${at} foto grande do mesmo produto`, await browser.evaluate(`__photo('dialog')`), 'acai-tradicional')
      check(`${at} foto grande carregada e inteira`, await browser.evaluate(`__photoShown('dialog')`), { loaded: true, fit: 'contain', folder: 'produtos' })
      await key('Escape', 'Escape')
      check(`${at} Esc fecha a foto grande`, await browser.evaluate(`__q('dialog').open`), false)
      check(`${at} foco volta para "Ver foto"`, await browser.evaluate(`document.activeElement.textContent.trim()`), 'Ver foto')
    }

    await click(`__radio('pote-200')`)
    check(`${at} aviso visível da saída`, await browser.evaluate(`__text().includes('Saíram por passar do novo limite: 1 Granola.')`), true)
    check(`${at} anúncio da saída`, await browser.evaluate(`__live()`), 'Tamanho: Pote 200 ml, R$ 7,00. Saíram por passar do novo limite: 1 Granola.')
    check(`${at} total R$ 15,00 no pote`, await browser.evaluate(`__summary().includes('R$ 15,00')`), true)
    await click(`__button('Tirar Kit Kat')`)
    check(`${at} tirar 1 Kit Kat: total R$ 11,00`, await browser.evaluate(`__summary().includes('R$ 11,00')`), true)
    await click(`__button('Banana')`)
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    check(`${at} "Adicionar ao carrinho" abre a confirmação, sem adicionar`, await browser.evaluate(`[__confirm().open, __cartCount()]`), [true, '0'])
    const confirmText = await browser.evaluate(`__confirmText()`)
    check(`${at} confirmação: título, produto e tamanho`, ['Confirme seu item antes de adicionar', 'Açaí Tradicional — Pote 200 ml'].map((t) => confirmText.includes(t)), [true, true])
    check(
      `${at} confirmação: grupos escolhidos, sem os vazios`,
      ['Adicionais2x Granola', 'Caldas e cremesBanana caramelada', 'Adicionais pagosKit Kat (+ R$ 4,00)', 'Frutas'].map((t) => confirmText.includes(t)),
      [true, true, true, false],
    )
    check(`${at} confirmação: valor do item e pergunta`, ['Valor do item:R$ 11,00', 'Deseja adicionar este item ao carrinho?'].map((t) => confirmText.includes(t)), [true, true])
    check(`${at} confirmação: foco no botão principal`, await browser.evaluate(`document.activeElement.textContent.trim()`), 'Adicionar e ir para o carrinho')
    check(
      `${at} confirmação: os três botões, sem "Cancelar pedido"`,
      await browser.evaluate(`[...__confirm().querySelectorAll('button')].map((b) => b.textContent.trim())`),
      ['Adicionar e ir para o carrinho', 'Adicionar e continuar comprando', 'Voltar e editar'],
    )
    writeFileSync(join(outDir, `confirmacao-${viewport.width}.png`), await browser.screenshot())
    await click(`__confirmButton('Voltar e editar')`)
    check(`${at} "Voltar e editar" fecha sem adicionar`, await browser.evaluate(`[__confirm().open, __cartCount()]`), [false, '0'])
    check(
      `${at} "Voltar e editar" mantém as escolhas`,
      await browser.evaluate(`[__radio('pote-200').checked, __summary().includes('R$ 11,00'), __pressed('cobertura de Banana caramelada'), __pressed('Banana')]`),
      [true, true, 'true', 'false'],
    )
    check(`${at} "Voltar e editar" devolve o foco ao botão`, await browser.evaluate(`document.activeElement.textContent.includes('Adicionar ao carrinho')`), true)
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    await key('Escape', 'Escape')
    check(`${at} Esc também volta sem adicionar`, await browser.evaluate(`[__confirm().open, __cartCount()]`), [false, '0'])
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    await click(`__confirmButton('continuar comprando')`)
    await waitFor(`location.pathname === '/monte-seu-pedido' && document.body.textContent.includes('adicionado ao carrinho')`)
    check(`${at} "continuar comprando" volta ao cardápio`, await browser.evaluate(`location.pathname`), '/monte-seu-pedido')
    check(`${at} aviso de item adicionado e carrinho com 1`, await browser.evaluate(`[__text().includes('Açaí Tradicional adicionado ao carrinho.'), __cartCount()]`), [true, '1'])

    // --- Açaí Oca ---
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} Oca com os selos`, await browser.evaluate(`document.body.textContent.includes('Especialidade da casa') && document.body.textContent.includes('O mais pedido')`), true)
    check(`${at} foto do Oca`, await browser.evaluate(`__photo()`), 'acai-oca')
    check(`${at} Oca não tem 150 ml`, await browser.evaluate(`__radio('pote-150') === null`), true)
    await click(`__radio('copo-500')`)
    for (const id of ['Leite condensado', 'Leite em pó', 'Disquete (confete)']) await click(`__button('Adicionar ${id}')`)
    await click(`__button('Morango')`)
    await click(`__button('Creme de avelã')`)
    check(`${at} Oca copo 500 + creme de avelã: R$ 23,00`, await browser.evaluate(`__summary().includes('R$ 23,00')`), true)
    check(`${at} leite condensado e disquete contam no limite: 3 de 3`, await browser.evaluate(`__text().includes('3 de 3 adicionais grátis')`), true)

    // --- Açaí Batido ---
    await page('/monte-seu-pedido/acai-batido', viewport)
    check(`${at} foto do batido`, await browser.evaluate(`__photo()`), 'acai-batido')
    const batidoFits = await browser.evaluate(`__fits()`)
    check(
      `${at} batido: creme de cookies, Ovomaltine e creme de morango com as fotos enviadas, preenchendo o quadro`,
      [batidoFits['creme-cookies.png'], batidoFits['ovomaltine.png'], batidoFits['creme-morango.png']],
      ['cover', 'cover', 'cover'],
    )
    const batidoThumbs = await browser.evaluate(`__brokenThumbs()`)
    check(`${at} batido: todas as ${batidoThumbs.total} fotos de adicional carregam`, batidoThumbs.broken, [])
    check(
      `${at} batido com os três sabores`,
      await browser.evaluate(`['leite-condensado', 'leite-condensado-amendoim', 'leite-condensado-pacoca'].every((id) => !!__radio(id))`),
      true,
    )
    await click(`__button('Adicionar Creme de avelã')`)
    check(`${at} batido: adicional antes do tamanho e do sabor`, await browser.evaluate(`document.querySelector('[role=group][aria-label="Creme de avelã: 1"]') !== null`), true)
    await click(`__radio('300-ml')`)
    check(`${at} batido sem sabor pede o sabor`, await browser.evaluate(`__summary().includes('Falta escolher o sabor.')`), true)
    await click(`__radio('leite-condensado-amendoim')`)
    await click(`__button('Adicionar Creme de avelã')`)
    await click(`__button('Adicionar Ovomaltine')`)
    check(`${at} batido 300 ml + 3 adicionais de R$ 3,00: R$ 19,00`, await browser.evaluate(`__summary().includes('R$ 19,00')`), true)
    for (let i = 0; i < 11; i++) await click(`__button('Adicionar Creme de cookies')`)
    check(`${at} batido: no máximo 10 de cada adicional`, await browser.evaluate(`__blocked('Adicionar Creme de cookies')`), true)
    check(`${at} batido 300 ml + 13 adicionais: R$ 49,00`, await browser.evaluate(`__summary().includes('R$ 49,00')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} batido 500 ml com os mesmos adicionais: R$ 51,00`, await browser.evaluate(`__summary().includes('R$ 51,00')`), true)
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    const batidoText = await browser.evaluate(`__confirmText()`)
    check(
      `${at} confirmação do batido: sabor, adicionais com preço e valor`,
      ['Açaí Batido — Copo 500 ml', 'SaborAçaí com Leite Condensado e Amendoim', '2x Creme de avelã (+ R$ 6,00), 10x Creme de cookies (+ R$ 30,00) e Ovomaltine (+ R$ 3,00)', 'Valor do item:R$ 51,00'].map((t) => batidoText.includes(t)),
      [true, true, true, true],
    )
    await click(`__confirmButton('ir para o carrinho')`)
    await waitFor(`location.pathname === '/carrinho' && document.querySelector('[aria-label="Itens do carrinho"]')`)
    check(`${at} "ir para o carrinho" abre o carrinho com 2 itens`, await browser.evaluate(`[location.pathname, document.querySelectorAll('[aria-label="Itens do carrinho"] > li').length]`), ['/carrinho', 2])

    // --- Milk-shake ---
    await page('/monte-seu-pedido/milk-shake', viewport)
    check(`${at} foto do milk-shake`, await browser.evaluate(`__photo()`), 'milkshake')
    check(`${at} aviso de sabores`, await browser.evaluate(`__text().includes('Favor verificar com a nossa atendente a disponibilidade de sabores.')`), true)
    check(`${at} 13 sabores`, await browser.evaluate(`document.querySelectorAll('input[name="milk-shake-sabor"]').length`), 13)
    check(`${at} sem adicionais grátis nem frutas`, await browser.evaluate(`!__button('Adicionar Granola') && !__button('Banana')`), true)
    check(`${at} milk-shake continua com a cobertura de leite condensado`, await browser.evaluate(`!!__button('cobertura de Leite condensado')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} sem sabor, o resumo pede o sabor`, await browser.evaluate(`__summary().includes('Falta escolher o sabor.')`), true)
    await click(`__radio('morango')`)
    check(`${at} milk-shake 500 ml de morango: R$ 12,00`, await browser.evaluate(`__summary().includes('R$ 12,00')`), true)
    await click(`__button('Creme de avelã')`)
    await click(`__button('cobertura de Chocolate')`)
    check(`${at} milk-shake com creme de avelã: R$ 15,00`, await browser.evaluate(`__summary().includes('R$ 15,00')`), true)
    await sleep(500)
    writeFileSync(join(outDir, `milk-shake-${viewport.width}.png`), await browser.screenshot())
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    const milkText = await browser.evaluate(`__confirmText()`)
    check(`${at} confirmação do milk-shake: sabor e caldas`, ['SaborMorango', 'Caldas e cremesCreme de avelã (+ R$ 3,00) e Chocolate'].map((t) => milkText.includes(t)), [true, true])
    await click(`__confirmButton('continuar comprando')`)

    // --- Carrinho ---
    await page('/carrinho', viewport)
    check(`${at} carrinho com os 3 itens`, await browser.evaluate(`document.querySelectorAll('[aria-label="Itens do carrinho"] > li').length`), 3)
    check(`${at} carrinho com as fotos dos produtos`, await browser.evaluate(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] [data-product-photo]')].map((img) => img.dataset.productPhoto)`), ['acai-tradicional', 'acai-batido', 'milkshake'])
    // Tradicional Pote 200 (R$ 11,00) + Batido 500 ml (R$ 51,00) + Milk-shake (R$ 15,00) = R$ 77,00.
    check(`${at} total do carrinho R$ 77,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 77,00')`), true)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][0].querySelector('[aria-label="Aumentar quantidade"]')`)
    check(`${at} 2x o primeiro item: R$ 88,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 88,00')`), true)
    check(`${at} contador do cabeçalho: 4 itens`, await browser.evaluate(`__q('header').innerText.includes('4')`), true)
    check(`${at} quatro formas de pagamento`, await browser.evaluate(`[...document.querySelectorAll('input[name="forma-de-pagamento"]')].map((i) => i.value)`), ['pix', 'credito', 'debito', 'dinheiro'])
    writeFileSync(join(outDir, `carrinho-${viewport.width}.png`), await browser.screenshot())

    // Editar o batido: abre o personalizador com a montagem dele; salvar volta ao carrinho.
    await click(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes('Editar') && a.href.includes('acai-batido'))`)
    await waitFor(`document.querySelector('input[value="500-ml"]')`)
    check(`${at} edição abre com o tamanho do item`, await browser.evaluate(`__radio('500-ml').checked`), true)
    check(`${at} edição abre com o sabor do item`, await browser.evaluate(`__radio('leite-condensado-amendoim').checked`), true)
    await click(`__radio('300-ml')`)
    await click(`__buttonStarting('Salvar alterações')`)
    await waitFor(`location.pathname === '/carrinho' && document.querySelector('[aria-labelledby="total-titulo"]')`)
    check(`${at} salvar volta ao carrinho`, await browser.evaluate(`location.pathname`), '/carrinho')
    check(`${at} item editado: R$ 88,00 - R$ 2,00 = R$ 86,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 86,00')`), true)
    check(`${at} editar não cria item novo`, await browser.evaluate(`document.querySelectorAll('[aria-label="Itens do carrinho"] > li').length`), 3)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][2].querySelector('button[class*="red"]')`)
    check(`${at} remover o milk-shake: R$ 71,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 71,00')`), true)

    // --- Finalização: forma de pagamento, troco, Pix e mensagem do WhatsApp ---
    await browser.evaluate(`__stubOpen()`)
    const sendButton = `__button('Confirmar e Enviar Pedido no WhatsApp')`
    await click(sendButton)
    check(`${at} sem forma de pagamento: aviso e nada aberto`, await browser.evaluate(`[__text().includes('Selecione uma forma de pagamento para continuar'), window.__opened.length]`), [true, 0])
    check(`${at} sem forma de pagamento: foco nas opções`, await browser.evaluate(`document.activeElement.name`), 'forma-de-pagamento')
    await click(`__radio('dinheiro')`)
    await browser.evaluate(`__type('#troco-para', '50')`)
    await sleep(200)
    check(`${at} troco para 50: aviso de valor menor que o total`, await browser.evaluate(`__text().includes('O valor informado é menor que o total do pedido (R$ 71,00)')`), true)
    await click(sendButton)
    check(`${at} troco menor que o total bloqueia o envio`, await browser.evaluate(`window.__opened.length`), 0)
    await browser.evaluate(`__type('#troco-para', '100')`)
    await sleep(200)
    check(`${at} troco calculado na hora: R$ 29,00`, await browser.evaluate(`__liveText().includes('Troco a levar:R$ 29,00')`), true)
    await click(sendButton)
    check(
      `${at} abre a conversa do WhatsApp oficial`,
      await browser.evaluate(`[window.__opened.length, new URL(window.__opened[0]).origin + new URL(window.__opened[0]).pathname]`),
      [1, 'https://wa.me/5583996999980'],
    )
    const message = await browser.evaluate(`__openedText()`)
    check(
      `${at} mensagem: cabeçalho, itens com escolhas e total`,
      [
        '*NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍨',
        '*ITENS DO PEDIDO:*',
        '*2x Açaí Tradicional (Pote 200 ml)* — R$ 22,00 (R$ 11,00 cada)',
        '• Adicionais: 2x Granola',
        '• Caldas/Cremes: Banana caramelada',
        '• Adicionais pagos: Kit Kat (+ R$ 4,00)',
        '*1x Açaí Batido (Copo 300 ml)* — R$ 49,00',
        '• Sabor: Açaí com Leite Condensado e Amendoim',
        '*TOTAL DO PEDIDO: R$ 71,00*',
      ].map((t) => message.includes(t)),
      Array(9).fill(true),
    )
    check(`${at} mensagem: dinheiro com troco`, message.split('\n').slice(-2), ['*FORMA DE PAGAMENTO:* Dinheiro', '*TROCO PARA:* R$ 100,00 *(Levar troco de R$ 29,00)*'])
    check(`${at} avisa que abriu o WhatsApp, sem dizer que enviou`, await browser.evaluate(`[__text().includes('Abrimos o WhatsApp com o seu pedido.'), /pedido (foi )?enviado/i.test(__text())]`), [true, false])
    await click(`[...document.querySelectorAll('input[type=checkbox]')].find((i) => i.closest('label').textContent.includes('Não preciso de troco'))`)
    check(`${at} "não preciso de troco" desliga o campo; aviso antigo some`, await browser.evaluate(`[__q('#troco-para').disabled, __text().includes('Abrimos o WhatsApp')]`), [true, false])
    await click(sendButton)
    check(`${at} mensagem sem troco`, (await browser.evaluate(`__openedText()`)).split('\n').at(-1), '*TROCO:* Não preciso de troco (valor exato)')
    await click(`__radio('pix')`)
    check(
      `${at} Pix: chave, tipo, titular e instrução`,
      await browser.evaluate(`['83996999980', 'Chave Pix (Celular)', 'Titular: Açaí Doce Sabor', 'Realize o Pix e envie o comprovante junto com o seu pedido no WhatsApp.'].map((t) => document.body.textContent.includes(t))`),
      [true, true, true, true],
    )
    await realClick(`__button('Copiar chave Pix')`)
    check(`${at} copiar: "Chave Pix copiada!"`, await browser.evaluate(`!!__button('Chave Pix copiada!')`), true)
    writeFileSync(join(outDir, `finalizacao-pix-${viewport.width}.png`), await browser.screenshot())
    await sleep(2600)
    check(`${at} depois de 2,5 s o botão volta a "Copiar chave Pix"`, await browser.evaluate(`!!__button('Copiar chave Pix')`), true)
    await click(sendButton)
    check(`${at} mensagem com Pix`, (await browser.evaluate(`__openedText()`)).split('\n').slice(-2), ['*FORMA DE PAGAMENTO:* Pix', 'Envio o comprovante do Pix nesta conversa.'])
    await click(`__button('Já enviei, esvaziar o carrinho')`)
    check(`${at} "Já enviei" esvazia o carrinho`, await browser.evaluate(`[document.body.textContent.includes('Seu carrinho está vazio'), __cartCount()]`), [true, '0'])
    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }

  // Com "reduzir movimento" ligado, tudo continua funcionando.
  await browser.goto(baseUrl + '/monte-seu-pedido/acai-tradicional', { width: 390, height: 844, reducedMotion: true })
  await browser.evaluate(helpers)
  await click(`__radio('isopor-m')`)
  await click(`__button('Adicionar Paçoca')`)
  await click(`__button('Kiwi')`)
  check('movimento reduzido: total R$ 15,00', await browser.evaluate(`__summary().includes('R$ 15,00')`), true)
  check('movimento reduzido: a mesma foto no isopor', await browser.evaluate(`__photo()`), 'acai-tradicional')
} catch (error) {
  failures.push(`ERRO: ${error.message}`)
} finally {
  browser.close()
}

for (const failure of failures) console.log('FALHOU:', failure)
console.log(`Fotos em: ${outDir}`)
console.log(
  failures.length === 0
    ? `RESULTADO: as ${checks} conferências passaram`
    : `RESULTADO: ${failures.length} falha(s) em ${checks} conferências`,
)
process.exit(failures.length === 0 ? 0 : 1)
