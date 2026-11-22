// Confere no navegador a navegação do cardápio (pedido de 2026-11-16), no celular (390 px) e no
// computador (1280 px), na página Cardápio e no início:
// - barra lateral fixa (computador): as 9 seções em 2 grupos, com dicas e contagens; a seção à
//   vista marcada ao rolar; o clique rola até a seção (e abre a recolhida), leva o foco e acende o
//   contorno orquídea por 1,2 s; "Ver Ofertas & Combos" leva aos combos;
// - barra fixa do celular: "Categorias", a busca e os 9 botões com contagem; o título da seção para
//   logo abaixo da barra; o menu deslizante (foco dentro, Esc, toque fora, escolha que fecha e rola);
// - faixa de destaques: os 5 itens com foto e "Pedir" nos três caminhos;
// - seções abertas: selos "N sabores" e preços riscados;
// - busca: resumo com "Limpar busca", contagens da navegação, faixa filtrada, seção escondida;
// - endereços antigos (#bebidas) e a volta do personalizador para a seção;
// - nada cobre a busca nem o carrinho; console sem erros.
//
// Uso (com o site rodando, por exemplo em `npm run dev`): node tests/browser/check-navigation.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'navegacao')
const failures = []
let checks = 0

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const ANCHORS = [
  'secao-acai-oca',
  'secao-acai-tradicional',
  'secao-acai-batido',
  'secao-milkshake',
  'secao-combos',
  'secao-barcas-potes',
  'secao-picoles-sorvetes',
  'secao-bebidas',
  'secao-doces-bomboniere',
]

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__shown = (el) => !!el && el.getBoundingClientRect().width > 0;
  window.__sidebar = () => __q('nav[aria-label="Categorias do cardápio"]');
  window.__sideLinks = () => [...document.querySelectorAll('nav[aria-label="Categorias do cardápio"] a[data-nav]')].filter(__shown);
  window.__pills = () => [...document.querySelectorAll('nav[aria-label="Atalhos do cardápio"] a[data-target]')].filter(__shown);
  window.__go = (anchor) => [...__sideLinks(), ...__pills()].find((a) => (a.dataset.nav ?? a.dataset.target) === anchor);
  window.__marked = () => [...__sideLinks(), ...__pills()].filter((a) => a.getAttribute('aria-current') === 'true').map((a) => a.dataset.nav ?? a.dataset.target);
  window.__count = (a) => a.querySelector('.nums')?.firstChild?.textContent ?? null;
  window.__barBottom = () => { const bar = __q('[data-menu-bar]'); return getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : 0 };
  window.__gap = (anchor) => Math.round(document.getElementById(anchor).getBoundingClientRect().top - __barBottom());
  window.__drawer = () => __q('dialog[aria-labelledby="menu-categorias-titulo"]');
  window.__categories = () => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Categorias');
  window.__flash = (anchor) => { const el = document.getElementById(anchor); const target = el.matches('[data-flash-target]') ? el : el.querySelector('[data-flash-target]'); return target.hasAttribute('data-flash') };
  window.__type = (selector, text) => {
    const el = __q(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  window.__dialogOpen = () => [...document.querySelectorAll('dialog')].filter((d) => d.open).map((d) => d.getAttribute('aria-labelledby') ?? d.getAttribute('role'));
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9364)
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
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); localStorage.clear(); true`
const page = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await waitFor(`document.querySelector('h1')`)
  await run(quiet)
  await browser.goto(baseUrl + path, viewport)
  await waitFor(`document.querySelector('[data-menu-bar]')`)
  await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  // A página pode voltar na posição da visita anterior (ScrollRestoration): começa do topo.
  await run(`window.scrollTo(0, 0); true`)
  await sleep(300)
}
const click = async (expression, pause = 500) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
// Toque de verdade (mouse) num ponto da tela.
const tap = async (x, y) => {
  await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  await sleep(500)
}
const key = async (keyName) => {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: 27 })
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: 27 })
  await sleep(500)
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    const desktop = viewport.width >= 1024

    for (const path of ['/monte-seu-pedido', '/']) {
      const where = `${at} ${path === '/' ? 'início' : 'Cardápio'}`
      await page(path, viewport)

      // --- O que aparece em cada largura ---
      check(
        `${where}: ${desktop ? 'barra lateral, sem botões nem "Categorias"' : 'barra fixa com "Categorias" e os botões, sem barra lateral'}`,
        await run(`[__shown(__sidebar()), __pills().length, __shown(__categories())]`),
        desktop ? [true, 0, false] : [false, 9, true],
      )
      const links = desktop ? `__sideLinks()` : `__pills()`
      check(`${where}: as 9 seções na ordem`, await run(`${links}.map((a) => a.dataset.nav ?? a.dataset.target)`), ANCHORS)
      check(`${where}: contagens das 5 seções do catálogo`, await run(`${links}.map(__count)`), [null, null, null, null, '5', '11', '12', '2', '14'])
      if (desktop) {
        check(
          `${where}: dicas dos 4 produtos e os 2 grupos`,
          await run(`[${links}.slice(0, 4).map((a) => a.querySelector('.text-xs')?.textContent), [...__sidebar().querySelectorAll('[id^="lateral-grupo-"]')].map((p) => p.textContent)]`),
          [['Especialidade da casa', 'A partir de R$ 6,00', '300 ml e 500 ml', '13 sabores'], ['Monte do seu jeito', 'Catálogo completo']],
        )
        check(`${where}: "Ver Ofertas & Combos" no topo da barra lateral`, await run(`[...__sidebar().parentElement.querySelectorAll('a')][0]?.textContent.trim()`), 'Ver Ofertas & Combos')
      } else {
        check(`${where}: nomes curtos dos botões`, await run(`__pills().map((a) => a.childNodes[1]?.textContent)`), [
          'Açaí Oca',
          'Tradicional',
          'Batido',
          'Milk-shake',
          'Combos',
          'Barcas e Potes',
          'Picolés e Sorvetes',
          'Bebidas',
          'Doces',
        ])
      }
      check(`${where}: no topo, nenhuma seção marcada`, await run(`__marked()`), [])
      // A barra lateral e o menu do celular usam a mesma lista: nenhum id pode se repetir na página.
      check(
        `${where}: nenhum id repetido na página`,
        await run(`(() => { const ids = [...document.querySelectorAll('[id]')].map((el) => el.id); return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))] })()`),
        [],
      )

      // --- Rolar marca a seção à vista ---
      await run(`window.scrollTo(0, document.getElementById('secao-bebidas').getBoundingClientRect().top + scrollY - 140); true`)
      await sleep(500)
      check(`${where}: rolar até Bebidas a marca`, await run(`__marked()`), ['secao-bebidas'])
      await run(`window.scrollTo(0, document.getElementById('secao-picoles-sorvetes').getBoundingClientRect().top + scrollY + 200); true`)
      await sleep(500)
      check(`${where}: rolar de volta até Picolés a marca`, await run(`__marked()`), ['secao-picoles-sorvetes'])

      // --- Clique: seção recolhida abre, a página para no título, foco e contorno por 1,2 s ---
      await run(`window.scrollTo(0, 0); true`)
      await click(`__q('[data-toggle="doces-e-bomboniere"]')`, 500)
      check(`${where}: Doces recolhida`, await run(`__q('[data-toggle="doces-e-bomboniere"]').getAttribute('aria-expanded')`), 'false')
      await click(`__go('secao-doces-bomboniere')`, 400)
      check(`${where}: Doces aberta pela navegação, contorno aceso`, await run(`[__q('[data-toggle="doces-e-bomboniere"]').getAttribute('aria-expanded'), __flash('secao-doces-bomboniere')]`), ['true', true])
      check(`${where}: Doces logo abaixo da ${desktop ? 'borda da tela' : 'barra fixa'}`, await run(`(() => { const gap = __gap('secao-doces-bomboniere'); return gap > 0 && gap < 60 })()`), true)
      check(`${where}: Doces marcada e com o foco`, await run(`[__marked(), document.activeElement?.id]`), [['secao-doces-bomboniere'], 'secao-doces-bomboniere'])
      await sleep(1400)
      check(`${where}: o contorno some depois de 1,2 s`, await run(`__flash('secao-doces-bomboniere')`), false)
      // Os 3 produtos lado a lado no computador: o escolhido fica marcado.
      await click(`__go('secao-milkshake')`, 900)
      check(`${where}: Milk-shake marcado (mesmo na linha do Tradicional)`, await run(`[__marked(), (() => { const gap = __gap('secao-milkshake'); return gap > 0 && gap < 60 })()]`), [['secao-milkshake'], true])

      if (desktop) {
        await click(`[...__sidebar().parentElement.querySelectorAll('a')][0]`, 900)
        check(`${where}: "Ver Ofertas & Combos" leva aos combos`, await run(`[__marked(), (() => { const gap = __gap('secao-combos'); return gap > 0 && gap < 60 })()]`), [['secao-combos'], true])
        check(`${where}: barra lateral presa ao topo`, await run(`Math.round(__sidebar().parentElement.getBoundingClientRect().top)`), 16)
      } else {
        // --- Barra fixa do celular ---
        await run(`window.scrollTo(0, 3000); true`)
        await sleep(300)
        check(`${where}: barra fixa presa ao topo ao rolar`, await run(`Math.round(__q('[data-menu-bar]').getBoundingClientRect().top)`), 0)
        // --- Menu deslizante ---
        await click(`__categories()`, 600)
        check(
          `${where}: menu aberto, preso à esquerda, com o foco dentro e as 9 seções`,
          await run(`(() => { const d = __drawer(); const r = d.getBoundingClientRect(); return [d.open, Math.round(r.left), Math.round(r.width), d.contains(document.activeElement), d.querySelectorAll('a[data-nav]').length, __categories().getAttribute('aria-expanded')] })()`),
          [true, 0, 320, true, 9, 'true'],
        )
        check(`${where}: menu com o atalho de ofertas e as contagens`, await run(`[__drawer().textContent.includes('Ver Ofertas & Combos'), [...__drawer().querySelectorAll('a[data-nav]')].map(__count)]`), [true, [null, null, null, null, '5', '11', '12', '2', '14']])
        await key('Escape')
        check(`${where}: Esc fecha o menu e devolve o foco a "Categorias"`, await run(`[__drawer().open, document.activeElement === __categories()]`), [false, true])
        await click(`__categories()`, 600)
        await tap(viewport.width - 20, viewport.height / 2)
        check(`${where}: toque fora fecha o menu`, await run(`__drawer().open`), false)
        await click(`__categories()`, 600)
        await click(`__drawer().querySelector('a[data-nav="secao-bebidas"]')`, 1000)
        check(
          `${where}: escolher Bebidas no menu fecha e leva à seção, logo abaixo da barra`,
          await run(`[__drawer().open, (() => { const gap = __gap('secao-bebidas'); return gap > 0 && gap < 60 })(), document.activeElement?.id, __marked()]`),
          [false, true, 'secao-bebidas', ['secao-bebidas']],
        )
      }
    }

    // --- Faixa de destaques (Cardápio) ---
    await page('/monte-seu-pedido', viewport)
    const highlights = await run(`(async () => {
      const cards = [...document.querySelectorAll('[data-highlight]')];
      const imgs = cards.map((card) => card.querySelector('img[data-item-photo]'));
      await Promise.all(imgs.map((img) => img.decode().catch(() => null)));
      return {
        ids: cards.map((card) => card.dataset.highlight),
        loaded: imgs.filter((img) => img.complete && img.naturalWidth > 0).length,
        square: imgs.every((img) => { const r = img.getBoundingClientRect(); return Math.round(r.width) === Math.round(r.height) }),
        prices: cards.map((card) => [card.querySelector('s')?.textContent ?? null, card.querySelector('strong').textContent]),
        buttons: cards.map((card) => [...card.querySelectorAll('a, button:not([data-zoom])')].map((b) => b.textContent.trim().split(':')[0])),
        title: __q('#destaques-titulo')?.textContent,
        seal: __q('[data-highlights]').textContent.includes('Pronto para pedir'),
      };
    })()`)
    check(`${at} faixa: título e selo`, [highlights.title, highlights.seal], ['Mais pedidos & ofertas do dia', true])
    check(`${at} faixa: os 5 destaques, na ordem`, highlights.ids, ['pote-de-acai-1-litro', 'barca-de-acai', 'kit-completo-casquinha', 'combo-1-litro', 'pote-de-acai-2-litros'])
    check(`${at} faixa: 5 fotos carregadas, quadradas`, [highlights.loaded, highlights.square], [5, true])
    check(`${at} faixa: preços do catálogo`, highlights.prices, [['R$ 33,00', 'R$ 30,00'], [null, 'R$ 30,00'], [null, 'R$ 41,00'], [null, 'R$ 23,99'], [null, 'R$ 35,00']])
    check(`${at} faixa: "Pedir" em todos`, highlights.buttons, [['Pedir'], ['Pedir'], ['Pedir'], ['Pedir'], ['Pedir']])
    check(`${at} faixa: lupa em cada foto`, await run(`document.querySelectorAll('[data-highlight] [data-zoom]').length`), 5)
    await click(`__q('[data-highlight="pote-de-acai-2-litros"] button:not([data-zoom])')`, 700)
    check(`${at} "Pedir" do Pote 2 L: confirmação direta`, await run(`[__dialogOpen(), __q('dialog[role="alertdialog"]').textContent.includes('Pote de Açaí 2 Litros')]`), [['confirmar-item-titulo'], true])
    await click(`[...__q('dialog[role="alertdialog"]').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Voltar')`, 500)
    await click(`__q('[data-highlight="combo-1-litro"] button:not([data-zoom])')`, 700)
    check(`${at} "Pedir" do Combo 1 Litro: escolha de sabor`, await run(`[__dialogOpen(), __q('#opcoes-item-titulo')?.textContent]`), [['opcoes-item-titulo'], 'Escolha o sabor'])
    await key('Escape')
    await click(`__q('[data-highlight="barca-de-acai"] a')`, 1200)
    check(`${at} "Pedir" da Barca: personalizador`, await run(`location.pathname`), '/monte-seu-pedido/barca-de-acai')
    // A volta do personalizador leva à seção da Barca.
    check(`${at} personalizador da Barca volta para a seção Barcas e Potes`, await run(`[...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/monte-seu-pedido#secao-barcas-potes')`), true)

    // --- Seções abertas: selos e preços riscados ---
    await page('/monte-seu-pedido', viewport)
    check(
      `${at} selos "N sabores"`,
      await run(`['kit-completo-casquinha', 'pote-de-sorvete-1-5-litro', 'combo-de-sorvete', 'agua-mineral-500-ml'].map((id) => __q('[data-item="' + id + '"] [aria-label="Selos"]')?.textContent ?? null)`),
      ['12 sabores', '6 sabores', '6 sabores', null],
    )
    check(
      `${at} preços riscados`,
      await run(`[...document.querySelectorAll('[data-item] s')].map((s) => s.closest('[data-item]').dataset.item + ' ' + s.textContent)`),
      ['pote-de-acai-1-litro R$ 33,00', 'quadradinho-de-brownie R$ 6,00', 'trufas R$ 3,00'],
    )
    check(`${at} cartões com data-product-id`, await run(`[document.querySelectorAll('[data-item][data-product-id]').length, document.querySelectorAll('[data-highlight][data-product-id]').length]`), [44, 5])

    // --- Busca ---
    await run(`__type('#busca-cardapio', 'refri')`)
    await sleep(500)
    const links = desktop ? `__sideLinks()` : `__pills()`
    check(
      `${at} "refri": resumo, faixa escondida e contagens da busca`,
      await run(`[__q('[data-search-summary]')?.textContent.includes('1 resultado encontrado para “refri”'), document.querySelectorAll('[data-highlight]').length, ${links}.map(__count), ${links}.filter((a) => a.hasAttribute('data-empty')).length]`),
      [true, 0, [null, null, null, null, '0', '0', '0', '1', '0'], 8],
    )
    await run(`__type('#busca-cardapio', 'barca')`)
    await sleep(500)
    check(`${at} "barca": a faixa só com a Barca`, await run(`[...document.querySelectorAll('[data-highlight]')].map((c) => c.dataset.highlight)`), ['barca-de-acai'])
    await click(`[...document.querySelectorAll('[data-search-summary] button')].find((b) => b.textContent.trim() === 'Limpar busca')`, 500)
    check(`${at} "Limpar busca" do resumo: tudo de volta`, await run(`[__q('#busca-cardapio').value, document.querySelectorAll('[data-item]').length, document.querySelectorAll('[data-highlight]').length, !!__q('[data-search-summary]')]`), ['', 44, 5, false])
    await run(`__type('#busca-cardapio', 'refri')`)
    await sleep(500)
    await click(`__go('secao-combos')`, 1000)
    check(`${at} seção escondida pela busca: a navegação limpa a busca e leva à seção`, await run(`[__q('#busca-cardapio').value, (() => { const gap = __gap('secao-combos'); return gap > 0 && gap < 60 })()]`), ['', true])

    // --- Endereço antigo ---
    await browser.goto(baseUrl + '/monte-seu-pedido#bebidas', viewport)
    await waitFor(`document.getElementById('secao-bebidas')`)
    await sleep(600)
    check(`${at} endereço antigo #bebidas leva à seção Bebidas`, await run(`(() => { const gap = __gap('secao-bebidas'); return gap >= 0 && gap < 60 })()`), true)

    // --- Camadas: nada cobre a busca nem o carrinho ---
    await page('/monte-seu-pedido', viewport)
    const covered = async () =>
      run(`['#busca-cardapio', 'header a[href="/carrinho"]'].filter((selector) => { const el = __q(selector); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(hit && (el === hit || el.contains(hit))) })`)
    check(`${at} no topo, nada cobre a busca nem o carrinho`, await covered(), [])
    if (!desktop) {
      await run(`window.scrollTo(0, 4000); true`)
      await sleep(300)
      check(
        `${at} rolando, a barra fixa fica por cima do conteúdo, com a busca livre`,
        await run(`(() => { const el = __q('#busca-cardapio'); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === hit || el.contains(hit) })()`),
        true,
      )
    }
  }
  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro: ${error.message}`)
} finally {
  browser.close()
}

if (failures.length) {
  console.log(`FALHAS (${failures.length} de ${checks}):`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
