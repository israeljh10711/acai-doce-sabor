// Confere no navegador o modo de demonstração local do painel de pedidos (2026-11-20), num site
// na porta 5180 SEM o Supabase:
// - o pedido enviado pelo carrinho fica no localStorage (DEMO-0001), sem duplicar no toque duplo,
//   e o cliente não vê nada do painel;
// - o vendedor desbloqueia com a senha (vendedor2026) e vê "📋 Pedidos" com o selo;
// - o painel mostra "Modo de demonstração local" e o pedido; muda a situação e cancela (guardado);
// - outras abas do mesmo navegador: a mudança e o pedido novo aparecem sozinhos, com o bipe;
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
    class FakeAudio {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.listeners = []; }
      addEventListener(type, listener) { this.listeners.push(listener); }
      resume() { this.state = 'running'; this.listeners.forEach((listener) => listener()); return Promise.resolve(); }
      createOscillator() { return { type: 'sine', frequency: { value: 0 }, connect: (node) => node, start: () => { win.__tones++ }, stop() {} }; }
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

  // --- O cliente envia (sem Supabase) ---
  await browser.goto(`${baseUrl}/carrinho`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-order-values]')`)
  await run(`__set(__q('input[autocomplete="name"]'), 'Cliente Demo')`)
  await click(`__q('input[type="radio"][value="local"]')`, 400)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  await run(`window.__opened = []; window.open = (url) => { window.__opened.push(url); return {} }; true`)
  await run(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Confirmar e Enviar Pedido')); b.click(); b.click(); return true })()`)
  await sleep(600)
  check('o WhatsApp abre com a comanda de sempre (sem código de demonstração)', await run(`[window.__opened.length > 0, new URL(window.__opened[0]).origin, new URL(window.__opened[0]).searchParams.get('text').includes('DEMO')]`), [true, 'https://wa.me', false])
  check('o pedido fica no localStorage, uma vez só (toque duplo)', await run(`__demo()`), ['DEMO-0001:novo'])
  check('o cliente não vê nada do painel nem da demonstração', await run(`[!!__q('[data-orders-link]'), document.body.textContent.includes('demonstração')]`), [false, false])

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
  await click(`__q('[data-order-next]')`, 700)
  check('aceitar: guardado no navegador', await run(`__demo()`), ['DEMO-0001:preparando'])
  check('a outra aba mostra a mudança sozinha', await waitFor(`__codes(window.__b.document).join() === 'DEMO-0001:preparando'`, 4000), true)

  await gesture(`window.__c = window.open('/carrinho'); true`)
  await waitFor(`window.__c?.document.querySelector('[data-order-values]')`, 10_000)
  await sleep(600)
  await run(`(() => {
    const doc = window.__c.document;
    __set(doc.querySelector('input[autocomplete="name"]'), 'Outra Cliente');
    doc.querySelector('input[type="radio"][value="retirada"]').click();
    doc.querySelector('input[name="forma-de-pagamento"][value="pix"]').click();
    window.__c.open = () => ({});
    return true;
  })()`)
  await sleep(500)
  await run(`[...window.__c.document.querySelectorAll('button')].find((x) => x.textContent.includes('Confirmar e Enviar Pedido')).click(); true`)
  check('pedido de outra aba aparece sozinho no painel', await waitFor(`__codes().includes('DEMO-0002:novo')`, 4000), true)
  check('com o bipe e o selo atualizado', [await run(`window.__tones`), await run(`__q('[data-orders-badge]')?.dataset.ordersBadge`)], [2, '1'])
  check('e também na outra aba do painel', await waitFor(`__codes(window.__b.document).includes('DEMO-0002:novo')`, 4000), true)

  // --- Cancelar ---
  await click(`__q('[data-order-card="DEMO-0002"] [data-order-cancel]')`, 300)
  await click(`__q('[data-order-card="DEMO-0002"] [data-order-cancel-confirm]')`, 700)
  check('cancelar: guardado e identificado', [await run(`__demo()`), await run(`__q('[data-order-card="DEMO-0002"] [data-order-final]')?.textContent`)], [['DEMO-0001:preparando', 'DEMO-0002:cancelado'], '❌ Pedido cancelado'])
  check('a outra aba vê o cancelamento', await waitFor(`__codes(window.__b.document).includes('DEMO-0002:cancelado')`, 4000), true)
  await run(`window.__b.close(); window.__c.close(); true`)

  // --- Recarregar ---
  await browser.goto(`${baseUrl}/pedidos`, desktop)
  await run(quiet)
  await waitFor(`document.querySelectorAll('[data-order-card]').length >= 2`)
  check('recarregou: os pedidos continuam, sem repetir', await run(`__codes()`), ['DEMO-0002:cancelado', 'DEMO-0001:preparando'])
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
