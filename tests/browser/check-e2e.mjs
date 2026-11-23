// Conferência de ponta a ponta (pedido de 2026-11-15, "testar tudo, tudo mesmo"), no celular
// (390 px) e no computador (1280 px), complementando check:menu, check:configurator e check:offers:
// - vitrine: os 4 produtos principais com as fotos da loja;
// - busca com e sem acento e os sinônimos do pedido (batida, dindin, refri, agua, casquinha, barca);
// - cada uma das 5 seções recolhe e abre de novo; cada uma das 9 entradas da navegação (barra lateral no
//   computador, botões da barra fixa no celular) leva ao lugar certo;
// - TODOS os 44 itens do catálogo: os 42 que vão direto ao carrinho (com sabor, tamanho ou sem) passam pela
//   confirmação e entram no carrinho; os 2 de montagem abrem o personalizador;
// - carrinho com os 41 itens, total certo, mensagem do WhatsApp com cada um, no crédito e no débito;
// - o exemplo do pedido: pedido de R$ 48,00 com troco para R$ 50,00 leva R$ 2,00 de troco;
// - mais e menos no carrinho; "continuar comprando" zera o personalizador.
//
// Uso (com o site rodando, por exemplo em `npm run dev`): node tests/browser/check-e2e.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EXTRA_ITEMS, choiceGroupsOf } from '../../src/features/catalog/extras.ts'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'ponta-a-ponta')
const failures = []
let checks = 0

const brl = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__type = (selector, text) => {
    const el = __q(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  window.__button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
  window.__go = (anchor) => [...document.querySelectorAll('nav[aria-label="Categorias do cardápio"] a[data-nav], nav[aria-label="Atalhos do cardápio"] a[data-target]')].find((a) => a.getBoundingClientRect().width > 0 && (a.dataset.nav ?? a.dataset.target) === anchor);
  window.__barBottom = () => { const bar = __q('[data-menu-bar]'); return getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : 0 };
  window.__drawerButton = (id) => __q('[data-toggle="' + id + '"]');
  window.__itemsIn = (id) => [...document.querySelectorAll('[data-section="' + id + '"] [data-item] [id$="-nome"]')].map((h) => h.textContent);
  window.__shownItems = () => [...document.querySelectorAll('[data-item] [id$="-nome"]')].map((h) => h.textContent);
  window.__mains = () => [['acai-oca', 'secao-acai-oca'], ['acai-tradicional', 'secao-acai-tradicional'], ['acai-batido', 'secao-acai-batido'], ['milk-shake', 'secao-milkshake']].filter(([, anchor]) => document.getElementById(anchor)).map(([slug]) => slug);
  window.__itemButton = (id) => __q('[data-item="' + id + '"] button:not([data-zoom]), [data-item="' + id + '"] a');
  window.__confirm = () => __q('dialog[role="alertdialog"]');
  window.__options = () => __q('dialog[aria-labelledby="opcoes-item-titulo"]');
  window.__in = (dialog, text) => [...dialog.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  window.__toast = () => __q('[role="status"].fixed')?.textContent ?? '';
  window.__cartCount = () => Number((__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0]);
  window.__total = () => __q('[aria-labelledby="total-titulo"]')?.innerText ?? '';
  window.__lines = () => [...document.querySelectorAll('[aria-label="Itens do carrinho"] > li article')].map((a) => a.getAttribute('aria-label'));
  window.__line = (title) => [...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')].find((li) => li.querySelector('article')?.getAttribute('aria-label') === title);
  window.__liveText = () => [...document.querySelectorAll('p[aria-live]')].map((p) => p.textContent).join('|');
  // Desde 2026-11-20 o pedido é finalizado no site: nenhuma aba deve abrir (o window.open só conta).
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; return true };
  // Sem o Supabase, a comanda fica guardada no modo de demonstração deste navegador.
  window.__demoOrders = () => { try { return JSON.parse(localStorage.getItem('acai_doce_sabor_pedidos_demo_v1')).orders } catch { return [] } };
  window.__openedText = () => __demoOrders().at(-1)?.message ?? null;
  true;
`

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const browser = await openBrowser(join(outDir, 'edge-profile'), 9357)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const waitFor = async (condition, timeout = 10000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`)) return true
    await sleep(100)
  }
  return false
}
/** Comanda de 2026-11-17: nome e retirada na loja (sem endereço), antes de enviar o pedido. */
const FILL_CUSTOMER = `(() => {
  const name = document.querySelector('input[autocomplete="name"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Cliente Teste');
  name.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('input[type="radio"][value="retirada"]').click();
  return true;
})()`

const page = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await waitFor(`document.querySelector('h1')`)
  await run(`window.scrollTo(0, 0); true`)
}
const click = async (expression, pause = 300) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
// Sem notificações de oferta nesta conferência: elas têm a conferência delas (check:offers).
const quietOffers = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`

const DRAWERS = [
  ['combos-e-ofertas', 5],
  ['barcas-e-potes', 11],
  ['picoles-e-sorvetes', 12],
  ['bebidas', 2],
  ['doces-e-bomboniere', 14],
]
// Âncora de cada entrada da navegação e a seção do catálogo que ela abre (os 4 produtos não recolhem).
const NAV = [
  ['secao-acai-oca', null],
  ['secao-acai-tradicional', null],
  ['secao-acai-batido', null],
  ['secao-milkshake', null],
  ['secao-combos', 'combos-e-ofertas'],
  ['secao-barcas-potes', 'barcas-e-potes'],
  ['secao-picoles-sorvetes', 'picoles-e-sorvetes'],
  ['secao-bebidas', 'bebidas'],
  ['secao-doces-bomboniere', 'doces-e-bomboniere'],
]
const ACAI_ITEMS = [
  'Pote de Açaí 1 Litro Montado',
  'Barca de Açaí',
  'Pote de Açaí 2 Litros (Açaímix Brazil)',
  'Açaí de 1 Litro (Açaímix Brazil)',
  'Açaí do Oca (Pote Pronto)',
  'Açaí com Creme Ninho (Pronto)',
  'Açaí Mix 150 ml',
]
const SEARCHES = [
  ['batida', ['acai-batido'], []],
  ['dindin', [], ['Garrafinha', 'Cremosinho']],
  ['refri', [], ['Refrigerante 350 ml']],
  ['agua', [], ['Água Mineral 500 ml']],
  ['água', [], ['Água Mineral 500 ml']],
  ['casquinha', [], ['Kit Completo Casquinha DUO', 'Kit Completo', 'Combo 1 Litro', 'Combo de Sorvete', 'Cascão DUO', 'Moreninha']],
  ['barca', [], ['Barca de Açaí']],
  ['Açaí', ['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'], ACAI_ITEMS],
  ['acai', ['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'], ACAI_ITEMS],
  ['picolé', [], ['Picolé Trufado', 'Picolé Gourmet', 'Picolé Comum']],
  ['picole', [], ['Picolé Trufado', 'Picolé Gourmet', 'Picolé Comum']],
]

/** Coloca um item do catálogo no carrinho pela tela: sabor (a primeira opção de cada grupo) e confirmação. */
async function addExtra(at, item) {
  const open = await run(`__drawerButton('${item.drawer}').getAttribute('aria-expanded')`)
  if (open !== 'true') await click(`__drawerButton('${item.drawer}')`, 500)
  const before = await run(`__cartCount()`)
  await click(`__itemButton('${item.id}')`)
  const groups = choiceGroupsOf(item)
  const chosen = []
  if (groups.length) {
    if (!(await waitFor(`__options()?.open`, 4000))) return `${item.id}: a escolha de sabor não abriu`
    const shown = await run(`[...__options().querySelectorAll('fieldset')].map((f) => f.dataset.group)`)
    if (JSON.stringify(shown) !== JSON.stringify(groups.map((group) => group.id))) return `${item.id}: grupos ${JSON.stringify(shown)}`
    for (const group of groups) {
      await click(`[...__options().querySelectorAll('fieldset[data-group="${group.id}"] input[type=radio]')].find((i) => i.value === ${JSON.stringify(group.options[0])})`, 120)
      chosen.push(group.options[0])
    }
    await click(`__in(__options(), 'Continuar')`)
  }
  if (!(await waitFor(`__confirm()?.open`, 4000))) return `${item.id}: a confirmação não abriu`
  const text = await run(`__confirm().textContent`)
  const missing = [item.name, `Valor do item:${brl(item.priceCents)}`, ...chosen].filter((piece) => !text.includes(piece))
  if (missing.length) return `${item.id}: confirmação sem ${JSON.stringify(missing)}`
  await click(`__in(__confirm(), 'continuar comprando')`)
  if (!(await waitFor(`!__confirm()?.open && __cartCount() === ${before + 1} && __toast().includes('Adicionado ao carrinho')`, 4000))) {
    return `${item.id}: não entrou no carrinho (contador ${await run(`__cartCount()`)})`
  }
  return null
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    await page('/monte-seu-pedido', viewport)
    await run(`localStorage.clear(); sessionStorage.clear(); ${quietOffers}`)
    await page('/monte-seu-pedido', viewport)

    // --- Vitrine: os 4 carros-chefes com as fotos enviadas pela loja ---
    // Um cartão de cada vez (2026-11-23): as fotos carregam ao aparecer; rolar para os 4 de uma vez deixava
    // as três primeiras fora da tela e o decode() nunca terminava.
    const mains = await run(`(async () => { const out = []; for (const id of ['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake']) out.push(await (async () => {
      const card = document.getElementById({ 'acai-oca': 'secao-acai-oca', 'acai-tradicional': 'secao-acai-tradicional', 'acai-batido': 'secao-acai-batido', 'milk-shake': 'secao-milkshake' }[id]);
      const img = card?.querySelector('[data-product-photo]');
      if (!img) return [id, null];
      img.scrollIntoView({ block: 'center' });
      await img.decode().catch(() => null);
      return [id, img.dataset.productPhoto, img.naturalWidth > 0, getComputedStyle(img).objectFit, new URL(img.currentSrc).pathname.split('/').slice(-2, -1)[0]];
    })()); return out })()`)
    check(`${at} vitrine: os 4 carros-chefes com a foto da loja, inteira`, mains, [
      ['acai-oca', 'acai-oca', true, 'contain', 'produtos'],
      ['acai-tradicional', 'acai-tradicional', true, 'contain', 'produtos'],
      ['acai-batido', 'acai-batido', true, 'contain', 'produtos'],
      ['milk-shake', 'milkshake', true, 'contain', 'produtos'],
    ])
    await run(`window.scrollTo(0, 0); true`)

    // --- Busca: com e sem acento, sinônimos do pedido ---
    for (const [query, mainIds, items] of SEARCHES) {
      await run(`__type('#busca-cardapio', ${JSON.stringify(query)})`)
      await sleep(400)
      check(`${at} busca "${query}"`, await run(`[__mains(), __shownItems()]`), [mainIds, items])
    }
    await run(`__type('#busca-cardapio', '')`)
    await sleep(400)
    check(`${at} busca limpa: cardápio inteiro de volta`, await run(`[__mains().length, document.querySelectorAll('[data-section]').length]`), [4, 5])

    // --- As 5 seções começam abertas, recolhem e abrem de novo ---
    for (const [id, count] of DRAWERS) {
      const states = [await run(`[__drawerButton('${id}').getAttribute('aria-expanded'), __itemsIn('${id}').length]`)]
      for (let toggle = 0; toggle < 2; toggle++) {
        await click(`__drawerButton('${id}')`, 600)
        states.push(await run(`[__drawerButton('${id}').getAttribute('aria-expanded'), __itemsIn('${id}').length]`))
      }
      check(`${at} seção ${id}: aberta com ${count} itens, recolhe e abre de novo`, states, [['true', count], ['false', 0], ['true', count]])
    }

    // --- As 9 entradas da navegação (barra lateral ou botões da barra fixa) ---
    for (const [anchor, drawer] of NAV) {
      await run(`window.scrollTo(0, 0); true`)
      await sleep(200)
      if (drawer) await click(`__drawerButton('${drawer}')`, 500)
      await click(`__go('${anchor}')`, 1100)
      const where = await run(`(() => { const gap = Math.round(document.getElementById('${anchor}').getBoundingClientRect().top - __barBottom()); return gap > 0 && gap < 60 })()`)
      const opened = drawer ? await run(`__drawerButton('${drawer}').getAttribute('aria-expanded')`) : 'true'
      const marked = await run(`__go('${anchor}').getAttribute('aria-current')`)
      check(`${at} navegação "${anchor}" leva ao lugar certo e marca a seção${drawer ? ' (recolhida antes: abre)' : ''}`, [where, opened, marked], [true, 'true', 'true'])
    }

    // --- Os 44 itens do catálogo ---
    await page('/monte-seu-pedido', viewport)
    const orderable = EXTRA_ITEMS.filter((item) => item.action.type !== 'customizer')
    const problems = []
    for (const item of orderable) {
      const problem = await addExtra(at, item)
      if (problem) problems.push(problem)
    }
    check(`${at} os ${orderable.length} itens do catálogo sem montagem entram no carrinho pela confirmação`, problems, [])
    check(`${at} contador do carrinho: ${orderable.length}`, await run(`__cartCount()`), orderable.length)
    for (const item of EXTRA_ITEMS.filter((candidate) => candidate.action.type === 'customizer')) {
      await page('/monte-seu-pedido', viewport)
      if ((await run(`__drawerButton('${item.drawer}').getAttribute('aria-expanded')`)) !== 'true') await click(`__drawerButton('${item.drawer}')`, 500)
      await click(`__itemButton('${item.id}')`)
      check(
        `${at} ${item.name}: abre a montagem`,
        await waitFor(`location.pathname === '/monte-seu-pedido/${item.action.product}' && __q('h1')?.textContent === ${JSON.stringify(item.name)}`, 5000),
        true,
      )
    }

    // --- Carrinho com os 41 itens, total e mensagem (crédito e débito) ---
    await page('/carrinho', viewport)
    const sum = orderable.reduce((total, item) => total + item.priceCents, 0)
    check(`${at} carrinho: ${orderable.length} linhas, uma por item`, await run(`__lines().length`), orderable.length)
    check(`${at} carrinho: total ${brl(sum)}`, await run(`__total().includes(${JSON.stringify(brl(sum))})`), true)
    const fullCart = await run(`localStorage.getItem('acai-doce-sabor:carrinho')`)
    for (const [method, label] of [['credito', 'Cartão de crédito'], ['debito', 'Cartão de débito']]) {
      // Cada pedido confirmado esvazia o carrinho (2026-11-20): volta com os mesmos itens.
      await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(fullCart)}); true`)
      await page('/carrinho', viewport)
      await run(`__stubOpen()`)
      await run(FILL_CUSTOMER)
      await sleep(300)
      await click(`__q('input[name="forma-de-pagamento"][value="${method}"]')`)
      await click(`__q('[data-finalize]')`)
      check(`${at} ${label}: finalizado no site, sem abrir o WhatsApp`, [await waitFor(`location.pathname.startsWith('/acompanhar/DEMO-')`), await run(`window.__opened.length`)], [true, 0])
      const message = (await run(`__openedText()`)) ?? ''
      const lines = message.split('\n')
      // Comanda de 2026-11-17: "1️⃣ *1x Nome* (Sabor: X) — *R$ 3,00*"; com 2 escolhas ou mais, uma por linha.
      const missing = orderable
        .filter((item) => !lines.some((line) => line.includes(`*1x ${item.name}*`) && line.endsWith(`— *${brl(item.priceCents)}*`)))
        .map((item) => item.id)
      const flavorsMissing = orderable
        .flatMap((item) => choiceGroupsOf(item).map((group) => [group.label, group.options[0]]))
        .filter(([groupLabel, option]) => !message.includes(`(${groupLabel}: ${option})`) && !message.includes(`• *${groupLabel}:* ${option}`))
        .map(([groupLabel, option]) => `${groupLabel}: ${option}`)
      check(`${at} ${label}: comanda com os ${orderable.length} itens e os sabores`, [missing, [...new Set(flavorsMissing)]], [[], []])
      check(
        `${at} ${label}: total e forma de pagamento`,
        [lines.includes(`💰 *TOTAL A PAGAR:* *${brl(sum)}*`), lines.includes(`• *Método escolhido:* 💳 *${label}* — *${brl(sum)}*`)],
        [true, true],
      )
    }

    // --- O exemplo do pedido: R$ 48,00 com troco para R$ 50,00 ---
    await run(`localStorage.clear(); ${quietOffers}`)
    await page('/monte-seu-pedido', viewport)
    const byId = (id) => EXTRA_ITEMS.find((item) => item.id === id)
    for (const id of ['kit-completo-casquinha', 'picole-gourmet', 'agua-mineral-500-ml', 'agua-mineral-500-ml']) {
      const problem = await addExtra(at, byId(id))
      if (problem) failures.push(`${at} ${problem}`)
    }
    await page('/carrinho', viewport)
    check(`${at} troco: pedido de R$ 48,00 (41 + 3 + 2 x 2)`, await run(`[__lines().length, __total().includes('R$ 48,00')]`), [3, true])
    await run(`__stubOpen()`)
    await run(FILL_CUSTOMER)
    await sleep(300)
    await click(`__q('input[name="forma-de-pagamento"][value="dinheiro"]')`)
    await run(`__type('#troco-para', '50')`)
    await sleep(250)
    check(`${at} troco para R$ 50,00: "Troco a levar: R$ 2,00"`, await run(`__liveText().includes('Troco a levar:R$ 2,00')`), true)
    await run(`__type('#troco-para', '45')`)
    await sleep(250)
    check(`${at} troco para R$ 45,00: aviso de valor menor`, await run(`document.body.textContent.includes('O valor informado é menor que o total do pedido (R$ 48,00)')`), true)
    const demoBefore = await run(`__demoOrders().length`)
    await click(`__q('[data-finalize]')`)
    check(`${at} troco menor bloqueia a finalização`, await run(`[__demoOrders().length - ${demoBefore}, location.pathname]`), [0, '/carrinho'])
    await run(`__type('#troco-para', '50')`)
    await sleep(250)
    const cashCart = await run(`localStorage.getItem('acai-doce-sabor:carrinho')`)
    await click(`__q('[data-finalize]')`)
    await waitFor(`location.pathname.startsWith('/acompanhar/')`)
    const cashLines = ((await run(`__openedText()`)) ?? '').split('\n')
    check(
      `${at} comanda: dinheiro, troco para R$ 50,00, levar R$ 2,00`,
      ['• *Método escolhido:* 💵 *Dinheiro* — *R$ 48,00*', '  🪙 *Troco para:* R$ 50,00 *(Levar R$ 2,00 de troco)*'].map((t) => cashLines.includes(t)),
      [true, true],
    )
    await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cashCart)}); true`)
    await page('/carrinho', viewport)
    await click(`__q('input[name="forma-de-pagamento"][value="dinheiro"]')`)
    await click(`[...document.querySelectorAll('input[type=checkbox]')].find((i) => i.closest('label').textContent.includes('Não preciso de troco'))`)
    await click(`__q('[data-finalize]')`)
    await waitFor(`location.pathname.startsWith('/acompanhar/')`)
    check(`${at} "Não preciso de troco (valor exato)" na comanda`, ((await run(`__openedText()`)) ?? '').split('\n').includes('  ✅ *Troco:* Não precisa (valor exato)'), true)

    // --- Mais, menos e remover no carrinho ---
    await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cashCart)}); true`)
    await page('/carrinho', viewport)
    await click(`__line('Picolé Gourmet').querySelector('button[aria-label="Aumentar quantidade"]')`)
    check(`${at} carrinho: + no picolé = R$ 51,00`, await run(`__total().includes('R$ 51,00')`), true)
    await click(`__line('Picolé Gourmet').querySelector('button[aria-label="Diminuir quantidade"]')`)
    check(`${at} carrinho: − no picolé = R$ 48,00`, await run(`__total().includes('R$ 48,00')`), true)
    await click(`__line('Água Mineral 500 ml').querySelector('button[aria-label="Diminuir quantidade"]')`)
    check(`${at} carrinho: − na água (2 para 1) = R$ 46,00`, await run(`__total().includes('R$ 46,00')`), true)
    await click(`__line('Kit Completo Casquinha DUO').querySelector('button[class*="red"]')`)
    check(`${at} carrinho: remover o kit = R$ 5,00`, await run(`[__lines().length, __total().includes('R$ 5,00')]`), [2, true])

    // --- "Adicionar e continuar comprando" zera o personalizador ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    await click(`__q('input[type=radio][value="pote-200"]')`)
    await click(`__q('[aria-label="Adicionar Granola"]')`)
    await click(`__q('[aria-label="Banana"]')`)
    const countBefore = await run(`__cartCount()`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar ao carrinho'))`)
    await waitFor(`__confirm()?.open`, 4000)
    await click(`__in(__confirm(), 'continuar comprando')`)
    check(
      `${at} "continuar comprando": volta ao cardápio e o contador sobe`,
      await waitFor(`location.pathname === '/monte-seu-pedido' && __cartCount() === ${countBefore + 1}`, 5000),
      true,
    )
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    check(
      `${at} personalizador zerado depois de adicionar (sem tamanho, sem adicionais, sem frutas)`,
      await run(`[[...document.querySelectorAll('input[type=radio]')].some((i) => i.checked), __q('[aria-label="Banana"]').getAttribute('aria-pressed'), [...document.querySelectorAll('button[aria-label^="Tirar "]')].some((b) => !b.disabled), __q('[role="group"][aria-label="Granola: 0"]') !== null, __q('[aria-label="Prévia do pedido"]').textContent.includes('—')]`),
      [false, 'false', false, true, true],
    )
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
