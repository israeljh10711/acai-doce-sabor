// Confere no navegador o modo de demonstração local do painel de pedidos (2026-11-20), num site
// na porta 5180 SEM o Supabase:
// - o pedido finalizado no carrinho (2026-11-20: no site, sem WhatsApp) fica no localStorage
//   (DEMO-0001), sem duplicar no toque duplo; o cliente vai para o acompanhamento, com o aviso de
//   demonstração, e não vê nada do painel;
// - o vendedor desbloqueia com a senha (vendedor2026) e vê "📋 Pedidos" com o selo;
// - o painel mostra "Modo de demonstração local" e o pedido; muda a situação e cancela (guardado);
// - outras abas do mesmo navegador: a mudança e o pedido novo aparecem sozinhos, com o bipe;
// - a aba do cliente acompanha a mudança na hora; "Adicionar mais itens" acrescenta ao mesmo pedido
//   e o painel mostra os novos itens no mesmo cartão, destacado, com o aviso e o "ding-dong"
//   de itens acrescentados (não o bipe de pedido novo), sem mudar o contador;
// - recarregar mantém os pedidos, sem repetir.
//
// Uso: node tests/browser/check-pedidos-demo.mjs
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5180
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'pedidos-demo')
const failures = []
let checks = 0
function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_ANON_KEY = ''
process.env.VITE_SELLER_EMAIL = ''
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-demo'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__codes = (doc = document) => [...doc.querySelectorAll('[data-order-card]')].map((card) => card.dataset.orderCard + ':' + card.dataset.status);
  window.__demo = () => JSON.parse(localStorage.getItem('acai_doce_sabor_pedidos_demo_v1') ?? '{"orders":[]}').orders.map((row) => row.code + ':' + row.status);
  window.__set = (el, text) => {
    const view = el.ownerDocument.defaultView;
    Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new view.Event('input', { bubbles: true }));
    return true;
  };
  window.__fakeAudio = (win = window) => {
    win.__tones = 0;
    win.__notes = [];
    class FakeAudio {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.listeners = []; }
      addEventListener(type, listener) { this.listeners.push(listener); }
      resume() { this.state = 'running'; this.listeners.forEach((listener) => listener()); return Promise.resolve(); }
      createOscillator() { const osc = { type: 'sine', frequency: { value: 0 }, connect: (node) => node, start: () => { win.__tones++; win.__notes.push(osc.type + ':' + osc.frequency.value) }, stop() {} }; return osc; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node) => node }; }
    }
    Object.defineProperty(win, 'AudioContext', { value: FakeAudio, configurable: true });
    return true;
  };
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9380)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
/** Como um toque do vendedor (janelas novas não são bloqueadas). */
const gesture = async (expression) => {
  await browser.evaluate(helpers)
  const { result, exceptionDetails } = await browser.send('Runtime.evaluate', { expression, userGesture: true, returnByValue: true, awaitPromise: true })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  return result.value
}
const click = async (expression, pause = 500) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
const waitFor = async (condition, timeout = 8000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`!!(${condition})`)) return true
    await sleep(100)
  }
  return false
}
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
/** Jujuba (R$ 1,00) e Água (R$ 2,00). */
const CART = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 },
  ],
})
const OPEN_NOW = JSON.stringify({ settings: { loja: { override: { state: 'open', until: Date.now() + 3_600_000 } } } })

try {
  const desktop = { width: 1280, height: 900 }
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); localStorage.setItem('acai_doce_sabor_seller_catalog_v1', ${JSON.stringify(OPEN_NOW)}); ${quiet}`)

  // --- O cliente finaliza (sem Supabase) ---
  await browser.goto(`${baseUrl}/carrinho`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-order-values]')`)
  await run(`__set(__q('input[autocomplete="name"]'), 'Cliente Demo')`)
  await click(`__q('input[type="radio"][value="local"]')`, 400)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  await run(`window.__opened = []; window.open = (url) => { window.__opened.push(url); return null }; true`)
  await run(`(() => { const b = __q('[data-finalize]'); b.click(); b.click(); return true })()`)
  check(
    'finalizado no site: acompanhamento do DEMO-0001 com o aviso de demonstração, sem abrir o WhatsApp',
    [await waitFor(`location.pathname === '/acompanhar/DEMO-0001' && __q('[data-order-success="pedido"]') && __q('[data-demo-notice]')`), await run(`window.__opened.length`)],
    [true, 0],
  )
  check('o pedido fica no localStorage, uma vez só (toque duplo)', await run(`__demo()`), ['DEMO-0001:novo'])
  check('a comanda guardada é a de sempre (sem código de demonstração)', await run(`JSON.parse(localStorage.getItem('acai_doce_sabor_pedidos_demo_v1')).orders[0].message.includes('DEMO')`), false)
  check('o cliente não vê nada do painel', await run(`!!__q('[data-orders-link]')`), false)

  // --- O vendedor desbloqueia ---
  await browser.goto(`${baseUrl}/monte-seu-pedido`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-seller-access]')`)
  await click(`__q('[data-seller-access]')`, 800)
  await run(`(() => { const el = __q('#senha-vendedor'); __set(el, 'vendedor2026'); el.form.requestSubmit(); return true })()`)
  check('senha vendedor2026: Modo Vendedor ligado, "📋 Pedidos" com o selo (1)', [await waitFor(`__q('[data-orders-badge]')`), await run(`__q('[data-orders-badge]')?.dataset.ordersBadge`)], [true, '1'])
  await click(`__q('[data-orders-link]')`, 800)
  await run(`__fakeAudio()`)
  await waitFor(`__q('[data-order-card]')`)
  check(
    'painel: "Modo de demonstração local" e o pedido do carrinho',
    await run(`[__q('[data-orders-live]')?.dataset.ordersLive, __q('[data-orders-live]').textContent.includes('Modo de demonstração local'), __codes(), __q('[data-order-card] [data-modality]')?.textContent, __q('[data-order-card] h2')?.textContent]`),
    ['local', true, ['DEMO-0001:novo'], '🍨 Comer no Local', '#DEMO-0001'],
  )
  await click(`__q('[data-orders-sound-on]')`, 300)

  // --- Outras abas ---
  await gesture(`window.__b = window.open('/pedidos'); true`)
  check('outra aba do painel abre com o mesmo pedido', await waitFor(`window.__b?.document.querySelectorAll('[data-order-card]').length === 1`, 10_000), true)
  // A aba do cliente (2026-11-20): o acompanhamento do pedido, ao vivo pelo BroadcastChannel.
  await gesture(`window.__t = window.open('/acompanhar/DEMO-0001'); true`)
  check('aba do cliente: acompanhamento do DEMO-0001', await waitFor(`window.__t?.document.querySelector('[data-step="recebido"]')?.dataset.stepState === 'current'`, 10_000), true)
  await click(`__q('[data-order-next]')`, 700)
  check('aceitar: guardado no navegador', await run(`__demo()`), ['DEMO-0001:preparando'])
  check('a outra aba mostra a mudança sozinha', await waitFor(`__codes(window.__b.document).join() === 'DEMO-0001:preparando'`, 4000), true)
  check('a aba do cliente mostra "Preparando" sozinha', await waitFor(`window.__t.document.querySelector('[data-step="preparando"]')?.dataset.stepState === 'current'`, 4000), true)

  // --- O cliente acrescenta itens ao mesmo pedido ---
  const notesBeforeAdd = await run(`window.__notes.length`)
  await run(`window.__t.document.querySelector('[data-add-items]').click(); true`)
  check('aba do cliente: modo de adição no cardápio', await waitFor(`window.__t.document.querySelector('[data-add-mode-banner="DEMO-0001"]')`, 6000), true)
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'z1', itemId: 'jujuba', choices: [], quantity: 2 }] })); window.__t.location.href = '/carrinho'; true`)
  await sleep(1500)
  check('o carrinho confirma a adição (novo total R$ 5,00)', await waitFor(`window.__t.document?.querySelector('[data-add-new-total]')?.textContent === 'R$ 5,00'`, 10_000), true)
  await run(`window.__t.document.querySelector('[data-add-confirm]').click(); true`)
  check('itens acrescentados ao mesmo pedido', await waitFor(`window.__t.document.querySelector('[data-order-success="itens"]')`, 6000), true)
  check(
    'painel: o mesmo cartão com "➕ Novos itens", sem cartão novo, destacado, com o aviso e o "ding-dong" (não o bipe)',
    [
      await waitFor(`__q('[data-order-card="DEMO-0001"] [data-order-addition]')`, 4000),
      await waitFor(`__q('[data-added-notice="DEMO-0001"]')`, 4000),
      await run(`[__codes(), window.__notes.slice(${notesBeforeAdd}), __q('[data-order-card="DEMO-0001"]').matches('[data-order-added]'), __q('[data-order-card="DEMO-0001"] [data-addition-total]')?.textContent, __q('[data-orders-badge]')?.dataset.ordersBadge ?? '0']`),
    ],
    [true, true, [['DEMO-0001:preparando'], ['triangle:523.25', 'triangle:783.99'], true, '+ R$ 2,00', '0']],
  )
  await run(`window.__t.close(); true`)

  // Cada pedido confirmado esvazia o carrinho: a outra cliente monta o dela.
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); true`)
  await gesture(`window.__c = window.open('/carrinho'); true`)
  await waitFor(`window.__c?.document.querySelector('[data-order-values]')`, 10_000)
  await sleep(600)
  await run(`(() => {
    const doc = window.__c.document;
    __set(doc.querySelector('input[autocomplete="name"]'), 'Outra Cliente');
    doc.querySelector('input[type="radio"][value="retirada"]').click();
    doc.querySelector('input[name="forma-de-pagamento"][value="pix"]').click();
    window.__c.open = () => null;
    return true;
  })()`)
  await sleep(500)
  await run(`window.__c.document.querySelector('[data-finalize]').click(); true`)
  check('pedido de outra aba aparece sozinho no painel', await waitFor(`__codes().includes('DEMO-0002:novo')`, 4000), true)
  check(
    'com o bipe de pedido novo (não o ding-dong) e o selo atualizado',
    [await run(`window.__notes.slice(${notesBeforeAdd} + 2)`), await run(`__q('[data-orders-badge]')?.dataset.ordersBadge`)],
    [['sine:880', 'sine:1175'], '1'],
  )
  check('e também na outra aba do painel', await waitFor(`__codes(window.__b.document).includes('DEMO-0002:novo')`, 4000), true)

  // --- Cancelar ---
  await click(`__q('[data-order-card="DEMO-0002"] [data-order-cancel]')`, 300)
  await click(`__q('[data-order-card="DEMO-0002"] [data-order-cancel-confirm]')`, 700)
  check('cancelar: guardado e identificado', [await run(`__demo()`), await run(`__q('[data-order-card="DEMO-0002"] [data-order-final]')?.textContent`)], [['DEMO-0001:preparando', 'DEMO-0002:cancelado'], '❌ Pedido cancelado'])
  // A outra aba abre na fila "Em andamento" (2026-11-21): o cancelado sai dela e aparece em "Todos".
  check('a outra aba: o cancelado sai da fila "Em andamento"', await waitFor(`!__codes(window.__b.document).some((code) => code.startsWith('DEMO-0002'))`, 4000), true)
  await run(`window.__b.document.querySelector('[data-orders-filter="todos"]').click(); true`)
  check('a outra aba vê o cancelamento em "Todos"', await waitFor(`__codes(window.__b.document).includes('DEMO-0002:cancelado')`, 4000), true)
  await run(`window.__b.close(); window.__c.close(); true`)

  // --- Recarregar ---
  await browser.goto(`${baseUrl}/pedidos`, desktop)
  await run(quiet)
  await waitFor(`document.querySelectorAll('[data-order-card]').length >= 2`)
  check('recarregou: abre na fila "Em andamento", só com o que falta fazer', await run(`__codes()`), ['DEMO-0001:preparando'])
  await click(`__q('[data-orders-filter="todos"]')`, 300)
  check('em "Todos": os pedidos continuam, sem repetir, do mais antigo para o mais novo', await run(`__codes()`), ['DEMO-0001:preparando', 'DEMO-0002:cancelado'])
  check('sem rolagem lateral', await run(`document.documentElement.scrollWidth <= window.innerWidth`), true)

  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  browser.close()
  await site.close()
}

console.log(`${checks - failures.length}/${checks} conferências passaram.`)
if (failures.length) {
  console.log(failures.map((failure) => `FALHA ${failure}`).join('\n'))
  process.exit(1)
}
