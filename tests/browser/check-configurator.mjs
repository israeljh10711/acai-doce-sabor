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
  // Desde 2026-11-20 o pedido é finalizado no site: nenhuma aba deve abrir (o window.open só conta).
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; return true };
  // Sem o Supabase, a comanda fica guardada no modo de demonstração deste navegador.
  window.__demoOrders = () => { try { return JSON.parse(localStorage.getItem('acai_doce_sabor_pedidos_demo_v1')).orders } catch { return [] } };
  window.__demoCount = () => __demoOrders().length;
  window.__openedText = () => __demoOrders().at(-1)?.message ?? null;
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
/** Comanda de 2026-11-17: nome e retirada na loja (sem endereço), antes de enviar o pedido. */
const FILL_CUSTOMER = `(() => {
  const name = document.querySelector('input[autocomplete="name"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Cliente Teste');
  name.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('input[type="radio"][value="retirada"]').click();
  return true;
})()`

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

    const campaign = await browser.evaluate(`(async () => {
      const img = document.querySelector('section[aria-labelledby="inicio-titulo"] img[fetchpriority="high"]')
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 32
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, 32, 32)
      return {
        file: new URL(img.currentSrc).pathname,
        ratio: img.naturalWidth / img.naturalHeight,
        displayedRatio: img.clientWidth / img.clientHeight,
        cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3],
      }
    })()`)
    check(`${at} início: açaís e milk-shake com fundo transparente`, [
      campaign.file.startsWith('/images/campanha/acai-e-milkshake-'), campaign.cornerAlpha,
    ], [true, 0])
    check(`${at} início: composição inteira, sem distorção`, Math.abs(campaign.displayedRatio - campaign.ratio) < 0.01, true)

    const showcase = `document.querySelector('[aria-label="Vitrine interativa"]')`
    for (const [name, id] of [['Açaí Oca', 'oca'], ['Milk-shake de chocolate', 'milkshake'], ['Açaí Tradicional', 'tradicional']]) {
      const hotspot = `${showcase}.querySelector('[aria-label="Ver ${name} inteiro"]')`
      await click(hotspot)
      await waitFor(`${showcase}.querySelector('img[data-item="${id}"][data-ready="true"]')`)
      check(`${at} destaque de ${name} com o trio oculto`, await browser.evaluate(
        `getComputedStyle(${showcase}.querySelector('img[fetchpriority]')).opacity === '0'`), true)
      await key('Escape', 'Escape')
      check(`${at} volta para ${name} na vitrine`, await browser.evaluate(`document.activeElement === ${hotspot}`), true)
    }

    // A vitrine só gira quando aparece na tela; reproduzimos a visita de quem rolou até ela.
    await browser.evaluate(`${showcase}.scrollIntoView({block:'center',behavior:'instant'})`)
    await click("__button('Iniciar giro')")
    const activeSlide = `${showcase}.querySelector('img[data-sequence="true"]:last-of-type')`
    for (const id of ['oca', 'milkshake', 'tradicional', 'oca']) {
      await waitFor(`${activeSlide}?.dataset.item === '${id}'`, `giro automático: ${id}`)
    }
    await click("__button('Pausar giro')")
    await sleep(5200)
    check(`${at} pausa mantém o produto visível`, await browser.evaluate(`${activeSlide}?.dataset.item`), 'oca')
    await click("__button('Ver os três')")

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
    check(`${at} antes do tamanho, "Granola" liberado`, await browser.evaluate(`__blocked('Granola')`), false)
    check(`${at} antes do tamanho, Banana liberada`, await browser.evaluate(`__blocked('Banana')`), false)
    for (const name of ['Granola', 'Paçoca', 'Amendoim', 'BIS']) await click(`__button('${name}')`)
    await click(`__button('Banana')`)
    await click(`__button('Creme de ninho')`)
    check(`${at} quatro complementos distintos antes do tamanho`, await browser.evaluate(`['Granola','Paçoca','Amendoim','BIS'].every(n => __pressed(n) === 'true')`), true)
    check(`${at} sem tamanho, o total espera o tamanho`, await browser.evaluate(`__summary().includes('Escolha o tamanho para ver o preço.')`), true)
    check(`${at} carrinho espera o tamanho`, await browser.evaluate(`__blocked('Adicionar ao carrinho')`), true)

    await click(`__radio('copo-500')`)
    check(`${at} quatro complementos também cabem no copo 500`, await browser.evaluate(`['Granola','Paçoca','Amendoim','BIS'].every(n => __pressed(n) === 'true')`), true)
    check(`${at} dica do Tradicional sem cota`, await browser.evaluate(`__text().includes('Escolha quantos quiser, um de cada')`), true)
    check(`${at} outro ingrediente continua disponível`, await browser.evaluate(`__blocked('Leite condensado')`), false)
    check(`${at} com o limite cheio, "Kit Kat" habilitado`, await browser.evaluate(`__blocked('Kit Kat')`), false)
    check(`${at} creme de ninho marcado, + R$ 3,00: R$ 15,00`, await browser.evaluate(`__pressed('Creme de ninho') === 'true' && __summary().includes('R$ 15,00')`), true)
    await click(`__button('Creme de ninho')`)
    check(`${at} creme é um só: tocar de novo desmarca (R$ 12,00)`, await browser.evaluate(`__pressed('Creme de ninho') === 'false' && __summary().includes('R$ 12,00')`), true)
    await click(`__button('Kit Kat')`)
    await click(`__button('cobertura de Banana caramelada')`)
    check(`${at} cobertura grátis marcada uma vez`, await browser.evaluate(`__pressed('cobertura de Banana caramelada')`), 'true')
    check(`${at} total R$ 16,00`, await browser.evaluate(`__summary().includes('R$ 16,00')`), true)
    check(`${at} a foto não muda com os ingredientes`, await browser.evaluate(`__photo()`), 'acai-tradicional')

    await click(`__radio('isopor-m')`)
    check(`${at} no isopor, a mesma foto do Tradicional`, await browser.evaluate(`__photo()`), 'acai-tradicional')
    await sleep(500)
    writeFileSync(join(outDir, `tradicional-isopor-${viewport.width}.png`), await browser.screenshot())

    if (!desktop) {
      // "Ver foto" abre a foto ampliada do site (a mesma de um toque em qualquer foto).
      const zoomDialog = `__q('dialog[aria-labelledby="foto-ampliada-titulo"]')`
      await click(`__button('Ver foto')`)
      await sleep(400)
      check(`${at} "Ver foto" abre a foto ampliada`, await browser.evaluate(`${zoomDialog}.open`), true)
      check(`${at} foto ampliada do mesmo produto`, await browser.evaluate(`${zoomDialog}.dataset.lightbox`), 'produto:acai-tradicional')
      check(
        `${at} foto ampliada carregada e inteira, da pasta das fotos da loja`,
        await browser.evaluate(`(async () => { const img = ${zoomDialog}.querySelector('img'); await img.decode().catch(() => null); return { loaded: img.naturalWidth > 0, fit: getComputedStyle(img).objectFit, folder: new URL(img.currentSrc).pathname.split('/').slice(-2, -1)[0] } })()`),
        { loaded: true, fit: 'contain', folder: 'produtos' },
      )
      await key('Escape', 'Escape')
      check(`${at} Esc fecha a foto ampliada`, await browser.evaluate(`${zoomDialog}.open`), false)
      check(`${at} foco volta para "Ver foto"`, await browser.evaluate(`document.activeElement.textContent.trim()`), 'Ver foto')
    }

    await click(`__radio('pote-200')`)
    check(`${at} reduzir o Tradicional mantém os complementos`, await browser.evaluate(`['Granola','Paçoca','Amendoim','BIS'].every(n => __pressed(n) === 'true')`), true)
    check(`${at} anúncio do novo tamanho`, await browser.evaluate(`__live()`), 'Tamanho: Pote 200 ml, R$ 7,00.')
    check(`${at} total R$ 11,00 no pote`, await browser.evaluate(`__summary().includes('R$ 11,00')`), true)
    await click(`__button('Kit Kat')`)
    check(`${at} desmarcar Kit Kat remove a cobrança`, await browser.evaluate(`__summary().includes('R$ 7,00')`), true)
    await click(`__button('Kit Kat')`)
    await click(`__button('Banana')`)
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    check(`${at} "Adicionar ao carrinho" abre a confirmação, sem adicionar`, await browser.evaluate(`[__confirm().open, __cartCount()]`), [true, '0'])
    const confirmText = await browser.evaluate(`__confirmText()`)
    check(`${at} confirmação: título, produto e tamanho`, ['Confirme seu item antes de adicionar', 'Açaí Tradicional — Pote 200 ml'].map((t) => confirmText.includes(t)), [true, true])
    check(
      `${at} confirmação: grupos escolhidos, sem os vazios`,
      ['AdicionaisGranola', 'Caldas e cremesBanana caramelada', 'Adicionais pagosKit Kat (+ R$ 4,00)', 'Frutas'].map((t) => confirmText.includes(t)),
      [true, true, true, false],
    )
    check(`${at} confirmação: valor do item e pergunta`, ['Valor do item:R$ 11,00', 'Deseja adicionar este item ao carrinho?'].map((t) => confirmText.includes(t)), [true, true])
    check(`${at} confirmação: foco no botão principal`, await browser.evaluate(`document.activeElement.textContent.trim()`), 'Adicionar e ir para o carrinho')
    check(
      `${at} confirmação: os três botões, sem "Cancelar pedido"`,
      await browser.evaluate(`[...__confirm().querySelectorAll('button:not([data-zoom])')].map((b) => b.textContent.trim())`),
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
    await waitFor(`location.pathname === '/monte-seu-pedido' && document.body.textContent.includes('Adicionado ao carrinho')`)
    check(`${at} "continuar comprando" volta ao cardápio`, await browser.evaluate(`location.pathname`), '/monte-seu-pedido')
    check(
      `${at} aviso de item adicionado e carrinho com 1`,
      await browser.evaluate(`[document.querySelector('[role=status].fixed')?.textContent.includes('Adicionado ao carrinhoAçaí Tradicional'), __cartCount()]`),
      [true, '1'],
    )

    // --- Açaí Oca ---
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} Oca com os selos`, await browser.evaluate(`document.body.textContent.includes('Especialidade da casa') && document.body.textContent.includes('O mais pedido')`), true)
    check(`${at} foto do Oca`, await browser.evaluate(`__photo()`), 'acai-oca')
    check(`${at} Oca não tem 150 ml`, await browser.evaluate(`__radio('pote-150') === null`), true)
    await click(`__radio('copo-500')`)
    for (const id of ['Leite condensado', 'Leite em pó', 'Disquete (confete)']) await click(`__button('${id}')`)
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
    await click(`__button('Creme de avelã')`)
    check(`${at} batido: adicional antes do tamanho e do sabor`, await browser.evaluate(`__pressed('Creme de avelã') === 'true'`), true)
    await click(`__radio('300-ml')`)
    check(`${at} batido sem sabor pede o sabor`, await browser.evaluate(`__summary().includes('Falta escolher o sabor.')`), true)
    await click(`__radio('leite-condensado-amendoim')`)
    await click(`__button('Ovomaltine')`)
    check(`${at} batido 300 ml + 2 adicionais de R$ 3,00: R$ 16,00`, await browser.evaluate(`__summary().includes('R$ 16,00')`), true)
    await click(`__button('Creme de cookies')`)
    check(`${at} cookies selecionado uma vez`, await browser.evaluate(`__pressed('Creme de cookies')`), 'true')
    check(`${at} batido 300 ml + 3 adicionais: R$ 19,00`, await browser.evaluate(`__summary().includes('R$ 19,00')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} batido 500 ml com os mesmos adicionais: R$ 21,00`, await browser.evaluate(`__summary().includes('R$ 21,00')`), true)
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    const batidoText = await browser.evaluate(`__confirmText()`)
    check(
      `${at} confirmação do batido: sabor, adicionais com preço e valor`,
      ['Açaí Batido — Copo 500 ml', 'SaborAçaí com Leite Condensado e Amendoim', 'Creme de avelã (+ R$ 3,00), Creme de cookies (+ R$ 3,00) e Ovomaltine (+ R$ 3,00)', 'Valor do item:R$ 21,00'].map((t) => batidoText.includes(t)),
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
    check(`${at} sem adicionais grátis nem frutas`, await browser.evaluate(`!__button('Granola') && !__button('Banana')`), true)
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
    // Tradicional Pote 200 (R$ 11,00) + Batido 500 ml (R$ 21,00) + Milk-shake (R$ 15,00) = R$ 47,00.
    check(`${at} total do carrinho R$ 47,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 47,00')`), true)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][0].querySelector('[aria-label="Aumentar quantidade"]')`)
    check(`${at} 2x o primeiro item: R$ 58,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 58,00')`), true)
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
    check(`${at} item editado: R$ 58,00 - R$ 2,00 = R$ 56,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 56,00')`), true)
    check(`${at} editar não cria item novo`, await browser.evaluate(`document.querySelectorAll('[aria-label="Itens do carrinho"] > li').length`), 3)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][2].querySelector('button[class*="red"]')`)
    check(`${at} remover o milk-shake: R$ 41,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 41,00')`), true)

    // --- Finalização: forma de pagamento, troco, Pix e a comanda (pedido 100% no site, 2026-11-20) ---
    // Sem o Supabase, o pedido fica no modo de demonstração deste navegador; nenhuma aba abre.
    await browser.evaluate(`__stubOpen()`)
    await browser.evaluate(FILL_CUSTOMER)
    await sleep(300)
    const savedCart = await browser.evaluate(`localStorage.getItem('acai-doce-sabor:carrinho')`)
    /** Volta ao carrinho com os mesmos itens (cada pedido confirmado esvazia o carrinho). */
    const backToCart = async () => {
      await browser.evaluate(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(savedCart)}); true`)
      await browser.goto(baseUrl + '/carrinho', viewport)
      await browser.evaluate(helpers)
      await browser.evaluate(`__stubOpen()`)
      await waitFor(`__q('[data-finalize]')`)
    }
    const sendButton = `__q('[data-finalize]')`
    const demoBefore = await browser.evaluate(`__demoCount()`)
    await click(sendButton)
    check(`${at} sem forma de pagamento: aviso e nada salvo`, await browser.evaluate(`[__text().includes('Selecione uma forma de pagamento para continuar'), __demoCount() - ${demoBefore}]`), [true, 0])
    check(`${at} sem forma de pagamento: foco nas opções`, await browser.evaluate(`document.activeElement.name`), 'forma-de-pagamento')
    await click(`__radio('dinheiro')`)
    await browser.evaluate(`__type('#troco-para', '30')`)
    await sleep(200)
    check(`${at} troco para 30: aviso de valor menor que o total`, await browser.evaluate(`__text().includes('O valor informado é menor que o total do pedido (R$ 41,00)')`), true)
    await click(sendButton)
    check(`${at} troco menor que o total bloqueia a finalização`, await browser.evaluate(`__demoCount() - ${demoBefore}`), 0)
    await browser.evaluate(`__type('#troco-para', '100')`)
    await sleep(200)
    check(`${at} troco calculado na hora: R$ 59,00`, await browser.evaluate(`__liveText().includes('Troco a levar:R$ 59,00')`), true)
    await click(sendButton)
    await waitFor(`location.pathname.startsWith('/acompanhar/DEMO-') && __q('[data-order-success="pedido"]')`)
    check(
      `${at} finalizado no site: acompanhamento com "Pedido recebido", aviso de demonstração, nenhuma aba aberta`,
      await browser.evaluate(`[!!__q('[data-demo-notice]'), window.__opened.length, __demoCount() - ${demoBefore}]`),
      [true, 0, 1],
    )
    const message = await browser.evaluate(`__openedText()`)
    // Comanda de 2026-11-17: itens numerados, pagos com o valor, acompanhamentos por grupo.
    check(
      `${at} comanda: cabeçalho, itens com escolhas e total`,
      [
        '🍧 *NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍧',
        '🍨 *ITENS DO PEDIDO*',
        '*2x Açaí Tradicional* (Pote 200 ml) — *R$ 22,00*',
        '   ➕ *Cremes / Extras Pagos:* Kit Kat (+R$ 4,00)',
        '      • Adicionais: Granola',
        '      • Caldas e cremes: Banana caramelada',
        '*1x Açaí Batido* (Copo 300 ml · Sabor: Açaí com Leite Condensado e Amendoim) — *R$ 19,00*',
        '💰 *TOTAL A PAGAR:* *R$ 41,00*',
      ].map((t) => message.includes(t)),
      Array(8).fill(true),
    )
    check(
      `${at} comanda: dinheiro com troco`,
      ['• *Método escolhido:* 💵 *Dinheiro* — *R$ 41,00*', '  🪙 *Troco para:* R$ 100,00 *(Levar R$ 59,00 de troco)*'].map((t) => message.split('\n').includes(t)),
      [true, true],
    )
    check(`${at} o carrinho esvaziou depois da confirmação`, await browser.evaluate(`__cartCount()`), '0')

    await backToCart()
    await click(`__radio('dinheiro')`)
    await click(`[...document.querySelectorAll('input[type=checkbox]')].find((i) => i.closest('label').textContent.includes('Não preciso de troco'))`)
    check(`${at} "não preciso de troco" desliga o campo`, await browser.evaluate(`__q('#troco-para').disabled`), true)
    await click(sendButton)
    await waitFor(`location.pathname.startsWith('/acompanhar/')`)
    check(`${at} comanda sem troco`, (await browser.evaluate(`__openedText()`)).split('\n').includes('  ✅ *Troco:* Não precisa (valor exato)'), true)

    await backToCart()
    await click(`__radio('pix')`)
    check(
      `${at} Pix: chave, tipo, titular e instrução`,
      await browser.evaluate(`['83996999980', 'Chave Pix (Celular)', 'Titular: Açaí Doce Sabor', 'Faça o Pix e guarde o comprovante.'].map((t) => document.body.textContent.includes(t))`),
      [true, true, true, true],
    )
    await realClick(`__button('Copiar chave Pix')`)
    check(`${at} copiar: "Chave Pix copiada!"`, await browser.evaluate(`!!__button('Chave Pix copiada!')`), true)
    writeFileSync(join(outDir, `finalizacao-pix-${viewport.width}.png`), await browser.screenshot())
    await sleep(2600)
    check(`${at} depois de 2,5 s o botão volta a "Copiar chave Pix"`, await browser.evaluate(`!!__button('Copiar chave Pix')`), true)
    await click(sendButton)
    await waitFor(`location.pathname.startsWith('/acompanhar/')`)
    const pixLines = (await browser.evaluate(`__openedText()`)).split('\n')
    check(
      `${at} comanda com Pix`,
      ['• *Método escolhido:* 💠 *Pix* — *R$ 41,00*', '  📎 _Conferir o comprovante do Pix._'].map((t) => pixLines.includes(t)),
      [true, true],
    )
    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }

  // Com "reduzir movimento" ligado, tudo continua funcionando.
  await browser.goto(baseUrl + '/monte-seu-pedido/acai-tradicional', { width: 390, height: 844, reducedMotion: true })
  await browser.evaluate(helpers)
  await click(`__radio('isopor-m')`)
  await click(`__button('Paçoca')`)
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
