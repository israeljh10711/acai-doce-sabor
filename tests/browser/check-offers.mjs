// Confere no navegador as notificações flutuantes de ofertas (pedido de 2026-11-15):
// aparição depois de 4 s, posição no celular e no computador, X, pausas (busca, janela, aviso do
// carrinho, ponteiro e foco), o encerramento depois de 3 fechamentos com "Ver ofertas" e o toque
// em cada tipo de oferta (sabor, confirmação direta, personalizador e produto principal).
//
// Usa o relógio real (as esperas são de verdade): leva por volta de 3 minutos.
// Para escolher a oferta que aparece, grava o "saco" da visita no sessionStorage antes de abrir
// a página, como o próprio site faz entre uma página e outra.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-offers.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'ofertas')
const KEY = 'acai-doce-sabor:ofertas'
const ALLOWED = [
  'pote-de-acai-1-litro',
  'barca-de-acai',
  'kit-completo-casquinha',
  'pote-de-acai-2-litros',
  'combo-1-litro',
  'pote-de-sorvete-2-litros-especiais',
  'acai-oca',
  'acai-batido',
  'picole-gourmet',
  'picole-trufado',
  'moreninha',
  'cremosinho',
]

const failures = []
let checks = 0

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__offer = () => __q('aside[aria-label="Oferta"]');
  window.__offerId = () => __offer()?.dataset.offer ?? null;
  window.__memory = () => JSON.parse(sessionStorage.getItem('${KEY}') ?? 'null');
  window.__bell = () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ver ofertas') ?? null;
  window.__type = (selector, text) => {
    const el = __q(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9356)
// O Edge sem janela não tem o foco do sistema: sem isto, focar um elemento não dispara os eventos
// de foco (a pausa pelo teclado não seria testada).
await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true })
// Marca a hora (desde o início da página) em que cada oferta aparece.
await browser.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__offerTimes = [];
    new MutationObserver(() => {
      const aside = document.querySelector('aside[aria-label="Oferta"]');
      if (aside && !aside.dataset.seen) {
        aside.dataset.seen = '1';
        window.__offerTimes.push({ id: aside.dataset.offer, t: Math.round(performance.now()) });
      }
    }).observe(document, { childList: true, subtree: true });
  `,
})

const run = async (code) => {
  await browser.evaluate(helpers)
  return browser.evaluate(code)
}
const waitFor = async (condition, ms = 10000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`)) return true
    await sleep(100)
  }
  return false
}
const click = async (expression) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(350)
}

/** Abre a página com o estado da visita escolhido (oferta da vez, fechamentos). */
const open = async (path, viewport, memory = null) => {
  await browser.goto(baseUrl + '/carrinho', viewport)
  await run(`sessionStorage.clear(); ${memory ? `sessionStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(memory))});` : ''} true`)
  await browser.goto(baseUrl + path, viewport)
  await run(`window.scrollTo(0, 500); true`)
}
const withOffer = (id, extra = {}) => ({ bag: [id], last: null, dismissed: 0, stopped: false, ...extra })
const toastBody = `__offer()?.querySelector('button:not([aria-label])')`

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    const desktop = viewport.width >= 768

    // --- Aparição, posição e X ---
    await open('/monte-seu-pedido', viewport)
    check(`${at} nada antes de 4 s`, await run(`__offer() === null`), true)
    check(`${at} aparece`, await waitFor(`__offer()`, 9000), true)
    const first = await run(`window.__offerTimes[0]`)
    check(`${at} aparece entre 4 e 7 s depois de abrir`, first.t >= 4000 && first.t < 7000, true)
    check(`${at} é uma das 12 ofertas`, ALLOWED.includes(first.id), true)
    await sleep(600) // fim da animação de entrada
    const box = await run(`(() => { const r = __offer().getBoundingClientRect(); const page = document.documentElement; return { left: Math.round(r.left), right: Math.round(page.clientWidth - r.right), bottom: Math.round(page.clientHeight - r.bottom), width: Math.round(r.width), top: Math.round(r.top) } })()`)
    if (desktop) check(`${at} canto inferior direito, 390 px`, [box.right, box.bottom, box.width], [24, 24, 390])
    else check(`${at} embaixo, de lado a lado, acima da borda`, [box.left, box.right, box.bottom], [12, 12, 96])
    check(`${at} não cobre o topo (cabeçalho, busca, atalhos)`, box.top > 200, true)
    check(
      `${at} selo, X, "Aproveitar" e barra de tempo`,
      await run(`(() => { const a = __offer(); return [!!a.querySelector('.rounded-full.bg-gold-400'), !!a.querySelector('button[aria-label="Fechar oferta"]'), a.textContent.includes('Aproveitar'), !!a.querySelector('[data-offer-bar]')] })()`),
      [true, true, true, true],
    )
    check(`${at} a barra de tempo está correndo`, await run(`__q('[data-offer-bar]').getAnimations()[0]?.playState`), 'running')
    check(
      `${at} miniatura da foto do cardápio: 48 px, arredondada, carregada, sem texto alternativo`,
      await run(`(async () => {
        const img = __offer().querySelector('img[data-offer-photo]');
        if (!img) return null;
        await img.decode().catch(() => null);
        const box = img.getBoundingClientRect();
        return [Math.round(box.width) + 'x' + Math.round(box.height), parseFloat(getComputedStyle(img).borderTopLeftRadius) >= 10, img.naturalWidth > 0, img.alt, new URL(img.currentSrc).pathname.startsWith('/images/')];
      })()`),
      ['48x48', true, true, '', true],
    )
    await click(`__q('button[aria-label="Fechar oferta"]')`)
    check(`${at} o X fecha na hora`, await waitFor(`__offer() === null`, 1000), true)
    check(`${at} o X conta um fechamento`, await run(`__memory().dismissed`), 1)
    await sleep(2000)
    check(`${at} depois do X, a próxima não vem logo`, await run(`__offer() === null`), true)

    // --- Busca para tudo ---
    await open('/monte-seu-pedido', viewport, withOffer('cremosinho'))
    await waitFor(`__offer()`, 9000)
    check(`${at} oferta escolhida pelo saco da visita`, await run(`__offerId()`), 'cremosinho')
    await run(`__type('#busca-cardapio', 'picole')`)
    check(`${at} digitar na busca some com a oferta`, await waitFor(`__offer() === null`, 1000), true)
    await sleep(1500)
    check(`${at} com texto na busca, nada aparece`, await run(`__offer() === null`), true)
    await run(`__type('#busca-cardapio', '')`)
    await sleep(2500)
    check(`${at} ao limpar a busca, não volta na hora`, await run(`__offer() === null`), true)

    // --- Menu das categorias aberto (celular, desde 2026-11-16) também para ---
    if (viewport.width < 1024) {
      await open('/monte-seu-pedido', viewport, withOffer('cremosinho'))
      await waitFor(`__offer()`, 9000)
      await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Categorias')`)
      check(`${at} menu das categorias aberto some com a oferta`, await run(`[__q('dialog[aria-labelledby="menu-categorias-titulo"]').open, __offer() === null]`), [true, true])
      await sleep(1500)
      check(`${at} com o menu aberto, nada aparece`, await run(`__offer() === null`), true)
      await click(`__q('dialog[aria-labelledby="menu-categorias-titulo"] button[aria-label="Fechar categorias"]')`)
    }

    // --- Janela aberta para tudo ---
    await open('/monte-seu-pedido', viewport, withOffer('cremosinho'))
    await waitFor(`__offer()`, 9000)
    await click(`__q('[data-item="pote-de-acai-2-litros"] button:not([data-zoom])')`)
    check(`${at} janela de confirmação aberta some com a oferta`, await run(`[__q('dialog[open]') !== null, __offer() === null]`), [true, true])
    await sleep(1500)
    check(`${at} com janela aberta, nada aparece`, await run(`__offer() === null`), true)

    // --- Aviso "Adicionado ao carrinho" também para ---
    await click(`[...__q('dialog[open]').querySelectorAll('button')].find((b) => b.textContent.includes('continuar comprando'))`)
    check(
      `${at} com o aviso do carrinho na tela, nada aparece`,
      await run(`[!!__q('[role="status"].fixed')?.textContent.includes('Adicionado ao carrinho'), __offer() === null]`),
      [true, true],
    )

    // --- Toque em cada tipo de oferta ---
    await open('/monte-seu-pedido', viewport, withOffer('picole-gourmet'))
    await waitFor(`__offer()`, 9000)
    await click(toastBody)
    check(
      `${at} sabor: abre a escolha do Picolé Gourmet e some a oferta`,
      await run(`[__q('dialog[open]')?.textContent.includes('Picolé Gourmet'), __q('#opcoes-item-titulo')?.textContent, __offer() === null]`),
      [true, 'Escolha o sabor', true],
    )

    await open('/monte-seu-pedido', viewport, withOffer('moreninha'))
    await waitFor(`__offer()`, 9000)
    await click(toastBody)
    const confirmText = await run(`__q('dialog[role="alertdialog"][open]')?.textContent ?? ''`)
    check(`${at} direta: abre a confirmação da Moreninha`, ['Moreninha', 'Valor do item:R$ 3,50'].map((t) => confirmText.includes(t)), [true, true])

    await open('/monte-seu-pedido', viewport, withOffer('kit-completo-casquinha'))
    await waitFor(`__offer()`, 9000)
    await click(toastBody)
    check(`${at} kit: abre os dois sabores`, await run(`[__q('#opcoes-item-titulo')?.textContent, __q('dialog[open]')?.querySelectorAll('fieldset').length]`), ['Escolha os sabores', 2])

    for (const [id, path] of [
      ['pote-de-acai-1-litro', '/monte-seu-pedido/pote-de-acai-1-litro'],
      ['barca-de-acai', '/monte-seu-pedido/barca-de-acai'],
      ['acai-oca', '/monte-seu-pedido/acai-oca'],
      ['acai-batido', '/monte-seu-pedido/acai-batido'],
    ]) {
      await open('/monte-seu-pedido', viewport, withOffer(id))
      await waitFor(`__offer()`, 9000)
      check(`${at} oferta ${id} na tela`, await run(`__offerId()`), id)
      // Foto do item do catálogo preenchendo o quadro; a dos produtos principais (foto da loja), inteira.
      const fit = id === 'acai-oca' || id === 'acai-batido' ? 'contain' : 'cover'
      check(
        `${at} ${id}: miniatura certa (${fit})`,
        await run(`(async () => { const img = __offer().querySelector('img[data-offer-photo]'); await img.decode().catch(() => null); return [img.naturalWidth > 0, getComputedStyle(img).objectFit, new URL(img.currentSrc).pathname.split('/').pop()] })()`),
        [true, fit, `${{ 'pote-de-acai-1-litro': 'pote-1-litro-acai-montado', 'barca-de-acai': 'barca-de-acai', 'acai-oca': 'acai-oca', 'acai-batido': 'acai-batido' }[id]}-480.webp`],
      )
      await click(toastBody)
      check(`${at} ${id}: abre a montagem`, await waitFor(`location.pathname === '${path}' && __q('h1')`, 5000), true)
    }
    await sleep(5000)
    check(`${at} no personalizador não há notificação`, await run(`__offer() === null`), true)
    await browser.goto(baseUrl + '/carrinho', viewport)
    await sleep(5000)
    check(`${at} no carrinho não há notificação`, await run(`__offer() === null`), true)

    // --- 3 fechamentos encerram; "Ver ofertas" reativa ---
    await open('/monte-seu-pedido', viewport, withOffer('cremosinho', { dismissed: 2 }))
    await waitFor(`__offer()`, 9000)
    await click(`__q('button[aria-label="Fechar oferta"]')`)
    check(`${at} 3º fechamento encerra e mostra "Ver ofertas"`, await run(`[__offer() === null, __bell() !== null, __memory().stopped]`), [true, true, true])
    await browser.goto(baseUrl + '/monte-seu-pedido', viewport)
    await sleep(5500)
    check(`${at} encerrado vale para a visita toda`, await run(`[__offer() === null, __bell() !== null]`), [true, true])
    await click(`__bell()`)
    check(`${at} "Ver ofertas" mostra uma na hora`, await run(`[__offer() !== null, __bell() === null, __memory().dismissed]`), [true, true, 0])

    // --- A contagem para com o foco (teclado) e, no computador, com o ponteiro ---
    await open('/monte-seu-pedido', viewport, withOffer('combo-1-litro'))
    await waitFor(`__offer()`, 9000)
    if (desktop) {
      const center = await run(`(() => { const r = __offer().getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: center.x, y: center.y })
    } else {
      await run(`${toastBody}.focus(); true`)
    }
    await sleep(500)
    check(`${at} parada: barra de tempo pausada`, await run(`__q('[data-offer-bar]').getAnimations()[0]?.playState`), 'paused')
    await sleep(9000)
    check(`${at} parada: continua na tela depois de 9 s`, await run(`__offerId()`), 'combo-1-litro')
    if (desktop) await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 })
    else await run(`document.activeElement.blur(); true`)
    check(`${at} solta: a contagem volta e ela sai`, await waitFor(`__offer() === null`, 10000), true)

    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }
} catch (error) {
  failures.push(`ERRO: ${error.message}`)
} finally {
  browser.close()
}

for (const failure of failures) console.log('FALHOU:', failure)
console.log(failures.length === 0 ? `RESULTADO: as ${checks} conferências passaram` : `RESULTADO: ${failures.length} falha(s) em ${checks} conferências`)
process.exit(failures.length === 0 ? 0 : 1)
