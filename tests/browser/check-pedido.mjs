// Confere no navegador o registro do pedido no Supabase (pedido de 2026-11-17, opções A e 1), sem
// um Supabase de verdade: sobe o Supabase de mentira (tests/browser/fake-supabase.mjs, com a função
// "pedido" gerada) e um segundo site na porta 5175 ligado a ele. O site da porta 5173 não muda.
// - pedido registrado: "Pedido ADS-0001 registrado", WhatsApp com a comanda do servidor (com o código);
// - o mesmo pedido de novo: o mesmo código; pedido mudado: ADS-0002;
// - preço mudado no banco: "Os preços mudaram", o carrinho relê o total e "Tentar de novo" registra;
// - servidor fora do ar: "Tentar de novo" e "Enviar mesmo assim pelo WhatsApp" (comanda marcada como
//   não registrada), e a aba em branco fecha;
// - esgotado e loja fechada no banco: o motivo, e o carrinho mostra o que mudou;
// - celular: sem rolagem lateral.
//
// Uso: node tests/browser/check-pedido.mjs
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { PUBLIC_KEY, startFakeSupabase } from './fake-supabase.mjs'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5175
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'pedido')
const failures = []
let checks = 0
function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const fake = await startFakeSupabase()
// O segundo site lê o Supabase de mentira (variáveis do processo valem mais que o .env.local).
process.env.VITE_SUPABASE_URL = fake.url
process.env.VITE_SUPABASE_ANON_KEY = PUBLIC_KEY
process.env.VITE_SELLER_EMAIL = 'vendedor@teste.local'
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-pedido'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
  window.__set = (el, text) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  // Abas de mentira: a aba em branco aberta no toque e o endereço que ela recebe depois.
  window.__stubTabs = () => {
    window.__tabs = [];
    window.open = (url) => {
      const tab = { closed: false, opener: {}, location: { href: url || '' }, close() { this.closed = true } };
      window.__tabs.push(tab);
      return tab;
    };
    return true;
  };
  window.__lastTab = () => window.__tabs?.at(-1) ?? null;
  window.__lastText = () => { const tab = __lastTab(); return tab && tab.location.href ? new URL(tab.location.href).searchParams.get('text') : null };
  window.__values = () => __q('[data-order-values]')?.innerText.replace(/\\s+/g, ' ') ?? '';
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9372)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const click = async (expression, pause = 400) => {
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
const name = (text) => run(`__set(__q('input[autocomplete="name"]'), ${JSON.stringify(text)})`)
const send = () => click(`__button('Confirmar e Enviar Pedido no WhatsApp')`, 300)

/** Loja aberta pelo interruptor: a conferência roda a qualquer hora. */
const OPEN_NOW = { kind: 'settings', id: 'loja', data: { override: { state: 'open', until: Date.now() + 3_600_000 } } }
/** Jujuba (R$ 1,00) e Água (R$ 2,00): R$ 3,00. */
const CART = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 },
  ],
})
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const openCart = async (viewport) => {
  await browser.goto(`${baseUrl}/carrinho`, viewport)
  await run(quiet)
  await waitFor(`__q('[data-order-values]')`)
  await run(`__stubTabs()`)
}

try {
  const desktop = { width: 1280, height: 900 }
  fake.db.changes.push(OPEN_NOW)
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); ${quiet}`)
  await openCart(desktop)
  check('carrinho no site ligado ao Supabase: R$ 3,00 e o aviso de registro', await run(`[__values(), document.body.textContent.includes('Registra o pedido e abre o WhatsApp')]`), [
    'Subtotal R$ 3,00 Entrega escolha abaixo TOTAL R$ 3,00',
    true,
  ])

  // --- Registrado ---
  await name('Cliente Teste')
  await click(`__q('input[type="radio"][value="retirada"]')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await send()
  check('"Pedido ADS-0001 registrado. Falta enviar a mensagem"', await waitFor(`__q('[data-order-registered]')?.textContent.includes('Pedido ADS-0001 registrado.')`), true)
  const first = ((await run(`__lastText()`)) ?? '').split('\n')
  check(
    'a aba abre o WhatsApp da loja com a comanda do servidor (com o código)',
    [await run(`__lastTab()?.location.href.startsWith('https://wa.me/5583996999980?text=')`), first[1], first.includes('🛍️ *Subtotal dos itens:* R$ 3,00')],
    [true, '🔖 *Pedido:* ADS-0001', true],
  )
  check('gravado uma vez no banco', [fake.db.orders.length, fake.db.orders[0]?.customer_name, fake.db.orders[0]?.total_cents], [1, 'Cliente Teste', 300])

  // --- Repetido e mudado ---
  await send()
  await waitFor(`__q('[data-order-registered]')`)
  check('o mesmo pedido de novo: ADS-0001, sem gravar outro', [await run(`__q('[data-order-registered]')?.textContent.includes('ADS-0001')`), fake.db.orders.length], [true, 1])
  await name('Cliente Dois')
  await send()
  check('pedido mudado (outro nome): ADS-0002', await waitFor(`__q('[data-order-registered]')?.textContent.includes('Pedido ADS-0002 registrado.')`), true)

  // --- Toque duplo no botão: uma aba só, um registro só ---
  await name('Cliente Toque Duplo')
  const tabsBefore = await run(`__tabs.length`)
  await run(`(() => { const button = __button('Confirmar e Enviar Pedido no WhatsApp'); button.click(); button.click(); return true })()`)
  check(
    'toque duplo: abre uma aba só e registra uma vez',
    [await waitFor(`__q('[data-order-registered]')?.textContent.includes('Pedido ADS-0003 registrado.')`), (await run(`__tabs.length`)) - tabsBefore, fake.db.orders.length],
    [true, 1, 3],
  )

  // --- Preço mudado no banco (o site ainda mostra o antigo) ---
  fake.db.changes.push({ kind: 'items', id: 'jujuba', data: { priceCents: 150 } })
  await name('Cliente Preço')
  await send()
  check(
    '"Os preços mudaram": o total certo, sem gravar, e a aba em branco fecha',
    [await waitFor(`__q('[data-order-rejected]')?.textContent.includes('Os preços mudaram: o total agora é R$ 3,50')`), fake.db.orders.length, await run(`__lastTab()?.closed`)],
    [true, 3, true],
  )
  check('o carrinho relê o cardápio e mostra o total novo', await waitFor(`__values().includes('TOTAL R$ 3,50')`), true)
  await click(`__q('[data-order-retry]')`, 300)
  check('"Tentar de novo" com o total novo registra ADS-0004', await waitFor(`__q('[data-order-registered]')?.textContent.includes('Pedido ADS-0004 registrado.')`), true)

  // --- Servidor fora do ar (opção 1) ---
  fake.state.failFunction = true
  await name('Cliente Falha')
  await send()
  check(
    'servidor fora: aviso, "Tentar de novo" e "Enviar mesmo assim", aba em branco fechada',
    [await waitFor(`__q('[data-order-failed]')`), await run(`[!!__q('[data-order-retry]'), !!__q('[data-order-unregistered]'), __lastTab()?.closed]`)],
    [true, [true, true, true]],
  )
  await click(`__q('[data-order-unregistered]')`, 400)
  const unregistered = ((await run(`__lastText()`)) ?? '').split('\n')
  check(
    '"Enviar mesmo assim": comanda do aparelho marcada como não registrada, sem código',
    [unregistered.includes('⚠️ *Pedido não registrado no sistema*'), unregistered.some((line) => line.startsWith('🔖')), await run(`document.body.textContent.includes('Abrimos o WhatsApp com o seu pedido (sem registro no sistema).')`), fake.db.orders.length],
    [true, false, true, 4],
  )
  fake.state.failFunction = false

  // --- Esgotado e loja fechada no banco ---
  fake.db.changes.push({ kind: 'items', id: 'agua-mineral-500-ml', data: { available: false } })
  await name('Cliente Esgotado')
  await send()
  check('esgotado no banco: "Esgotou: Água Mineral 500 ml"', await waitFor(`__q('[data-order-rejected]')?.textContent.includes('Esgotou: Água Mineral 500 ml')`), true)
  check('o carrinho relê e marca a água como esgotada', await waitFor(`__q('[data-cart-problem]')?.textContent.includes('Esgotado')`), true)
  fake.db.changes.pop()

  fake.db.changes.splice(0, fake.db.changes.length, { kind: 'settings', id: 'loja', data: { closedOrders: 'bloquear', override: { state: 'closed', until: Date.now() + 3_600_000 } } })
  await openCart(desktop)
  // O site leu "fechada" ao abrir: o botão já vem bloqueado, e nada vai para o servidor.
  check('loja fechada com bloqueio: botão desligado no site', await run(`__button('Loja fechada')?.disabled`), true)
  fake.db.changes.splice(0, fake.db.changes.length, OPEN_NOW)

  // --- Celular ---
  await openCart({ width: 390, height: 844 })
  await name('Cliente Celular')
  await click(`__q('input[type="radio"][value="retirada"]')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await send()
  check('celular: registrado e sem rolagem lateral', [await waitFor(`__q('[data-order-registered]')`), await run(`document.documentElement.scrollWidth`)], [true, 390])

  // O 503 da função fora do ar aparece no console do navegador (esperado); o resto, não.
  const problems = browser.consoleProblems().filter((problem) => !/503|Service Unavailable/i.test(String(problem)))
  check('console sem outros erros', problems, [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  browser.close()
  await site.close()
  await fake.close()
}

console.log(`${checks} conferências`)
if (failures.length > 0) {
  console.log(`FALHAS (${failures.length}):`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
