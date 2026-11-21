// Confere no navegador o acompanhamento do pedido pelo cliente e a adição de itens ao mesmo pedido
// (pedido 100% no site, 2026-11-20), sem um Supabase de verdade: o Supabase de mentira (função
// "pedido" gerada, sessão anônima, order_events, adicionar_itens_pedido e Realtime) e um site na
// porta 5181. Três navegadores separados: a cliente Ana, a cliente Bia e o vendedor (painel).
// - finalizar sem WhatsApp: cada cliente vai para o acompanhamento do próprio pedido;
// - o vendedor muda a situação: a linha do tempo da Ana muda na hora, sem recarregar; o evento vai
//   só para a sessão dela (a Bia não recebe) e a Bia não abre o pedido da Ana nem pelo código;
// - "➕ Adicionar mais itens": a faixa do modo de adição sobrevive a recarregar; troco conferido;
//   "Confirmar adição" acrescenta ao MESMO pedido (mesmo código, sem frete de novo, total novo);
//   no painel o cartão mostra "➕ Novos itens adicionados pelo cliente", sem cartão novo; o vendedor
//   ouve o "ding-dong" (não o bipe de pedido novo), vê o cartão destacado e o aviso, em qualquer
//   página (também no cardápio), e o contador de pedidos novos não muda;
// - toque duplo e tentativa repetida não acrescentam duas vezes; troco que não cobre é recusado;
// - o pedido avança enquanto o cliente escolhe: a adição é bloqueada (na tela e no banco);
// - vários pedidos no mesmo aparelho; sem Realtime, a tela continua se atualizando sozinha;
// - 390 e 320 px sem rolagem lateral; console sem erros.
//
// Uso: node tests/browser/check-acompanhamento.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { PUBLIC_KEY, SELLER_PASSWORD, startFakeSupabase } from './fake-supabase.mjs'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5181
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'acompanhamento')
mkdirSync(outDir, { recursive: true })
const failures = []
let checks = 0
function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const fake = await startFakeSupabase()
fake.db.changes.push({ kind: 'settings', id: 'loja', data: { override: { state: 'open', until: Date.now() + 3_600_000 } } })
process.env.VITE_SUPABASE_URL = fake.url
process.env.VITE_SUPABASE_ANON_KEY = PUBLIC_KEY
process.env.VITE_SELLER_EMAIL = 'vendedor@teste.local'
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-acompanhamento'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__text = (el) => el?.innerText.replace(/\\s+/g, ' ').trim() ?? null;
  window.__set = (el, text) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  window.__cartItems = () => JSON.parse(localStorage.getItem('acai-doce-sabor:carrinho') ?? '{"items":[]}').items.length;
  window.__session = () => JSON.parse(localStorage.getItem('acai_doce_sabor_cliente_sessao_v1') ?? 'null');
  window.__step = (key) => __q('[data-step="' + key + '"]')?.dataset.stepState ?? null;
  window.__card = (code) => __q('[data-order-card="' + code + '"]');
  window.__codes = () => [...document.querySelectorAll('[data-order-card]')].map((card) => card.dataset.orderCard);
  window.__noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;
  // Web Audio de mentira: conta as notas e guarda o timbre e a altura de cada uma ("sine:880").
  window.__fakeAudio = () => {
    window.__tones = 0;
    window.__notes = [];
    class FakeAudio {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.listeners = []; }
      addEventListener(type, listener) { this.listeners.push(listener); }
      resume() { this.state = 'running'; this.listeners.forEach((listener) => listener()); return Promise.resolve(); }
      createOscillator() { const osc = { type: 'sine', frequency: { value: 0 }, connect: (node) => node, start: () => { window.__tones++; window.__notes.push(osc.type + ':' + osc.frequency.value) }, stop() {} }; return osc; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node) => node }; }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio, configurable: true });
    return true;
  };
  // A própria função "pedido", chamada com a sessão desta cliente (para conferir as regras do servidor).
  window.__pedido = async (body) => {
    const response = await fetch(${JSON.stringify(fake.url)} + '/functions/v1/pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ${JSON.stringify(PUBLIC_KEY)}, Authorization: 'Bearer ' + __session().accessToken },
      body: JSON.stringify(body),
    });
    return response.json();
  };
  true;
`
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const q = JSON.stringify

/** Um navegador com os atalhos de conferência. */
async function person(profile, port) {
  const browser = await openBrowser(join(outDir, profile), port)
  const run = async (expression) => {
    await browser.evaluate(helpers)
    return browser.evaluate(expression)
  }
  const click = async (expression, pause = 400) => {
    const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
    if (!ok) throw new Error(`[${profile}] elemento não encontrado: ${expression}`)
    await sleep(pause)
  }
  const waitFor = async (condition, timeout = 8000) => {
    for (let waited = 0; waited < timeout; waited += 100) {
      if (await run(`!!(${condition})`)) return true
      await sleep(100)
    }
    return false
  }
  return { browser, run, click, waitFor }
}

const desktop = { width: 1280, height: 900 }
/** Jujuba (R$ 1,00) e Água (R$ 2,00): R$ 3,00. */
const cartOf = (items) => q({ v: 2, items })
const BASE_CART = cartOf([
  { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
  { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 },
])
const JUJUBAS = (quantity, id = 'j9') => cartOf([{ kind: 'extra', id, itemId: 'jujuba', choices: [], quantity }])

/** Abre o carrinho com estes itens (página nova, como quem volta ao site). */
async function openCart(who, cart, viewport = desktop) {
  await who.run(`localStorage.setItem('acai-doce-sabor:carrinho', ${q(cart)}); ${quiet}`)
  await who.browser.goto(`${baseUrl}/carrinho`, viewport)
  await who.run(quiet)
}

/** Finaliza um pedido no carrinho: nome, modalidade e pagamento (com troco, no dinheiro). */
async function placeOrder(who, { name, kind, method, changeFor }) {
  await openCart(who, BASE_CART)
  await who.waitFor(`__q('[data-finalize]')`)
  await who.run(`__set(__q('input[autocomplete="name"]'), ${q(name)})`)
  await who.click(`__q('input[type="radio"][value="${kind}"]')`)
  await who.click(`__q('input[name="forma-de-pagamento"][value="${method}"]')`)
  if (changeFor) await who.run(`__set(__q('#troco-para'), ${q(changeFor)})`)
  await who.click(`__q('[data-finalize]')`, 300)
}

/** Fotografa um pedaço da página (para conferir o visual). */
async function shotOf(who, selector, name) {
  const box = await who.run(`(() => { const r = __q(${q(selector)})?.getBoundingClientRect(); return r ? { x: Math.max(0, r.x + scrollX - 8), y: Math.max(0, r.y + scrollY - 8), width: r.width + 16, height: r.height + 16 } : null })()`)
  if (box) writeFileSync(join(outDir, `${name}.png`), await who.browser.screenshot(box))
}

const ana = await person('ana', 9384)
const bia = await person('bia', 9385)
const seller = await person('vendedor', 9386)

try {
  for (const who of [ana, bia, seller]) {
    await who.browser.goto(`${baseUrl}/`, desktop)
    await who.run(`localStorage.clear(); sessionStorage.clear(); ${quiet}`)
  }

  // --- O vendedor abre o painel ao vivo ---
  await seller.browser.goto(`${baseUrl}/pedidos`, desktop)
  await seller.run(`${quiet}; __fakeAudio()`)
  await seller.waitFor(`__q('[data-orders-login]')`)
  await seller.click(`__q('[data-orders-login]')`, 600)
  await seller.run(`(() => { const el = __q('#senha-vendedor'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${q(SELLER_PASSWORD)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.form.requestSubmit(); return true })()`)
  check('painel do vendedor ao vivo', await seller.waitFor(`__q('[data-orders-live]')?.dataset.ordersLive === 'live'`), true)
  await seller.click(`__q('[data-orders-sound-on]')`, 300)

  // --- Ana e Bia finalizam pelo site ---
  await placeOrder(ana, { name: 'Ana', kind: 'retirada', method: 'dinheiro', changeFor: '10,00' })
  check('Ana: acompanhamento do ADS-0001 com o recado de sucesso', await ana.waitFor(`location.pathname === '/acompanhar/ADS-0001' && __q('[data-order-success="pedido"]')`), true)
  await placeOrder(bia, { name: 'Bia', kind: 'local', method: 'pix' })
  check('Bia: acompanhamento do ADS-0002', await bia.waitFor(`location.pathname === '/acompanhar/ADS-0002' && __q('[data-order-success="pedido"]')`), true)
  const anaSession = await ana.run(`__session()`)
  const biaSession = await bia.run(`__session()`)
  const anaOrder = fake.db.orders.find((order) => order.code === 'ADS-0001')
  const biaOrder = fake.db.orders.find((order) => order.code === 'ADS-0002')
  check(
    'cada pedido ligado à sessão de quem fez (sessões diferentes)',
    [anaOrder.customer_user_id === anaSession.userId, biaOrder.customer_user_id === biaSession.userId, anaSession.userId !== biaSession.userId],
    [true, true, true],
  )
  check('as duas ao vivo', [await ana.waitFor(`__q('[data-live="live"]')`), await bia.waitFor(`__q('[data-live="live"]')`)], [true, true])
  check('o painel recebe os dois pedidos na hora', await seller.waitFor(`__codes().includes('ADS-0001') && __codes().includes('ADS-0002')`), true)

  // --- O vendedor aceita o pedido da Ana: a tela dela muda na hora ---
  const deliveredBefore = fake.realtime.stats.delivered.length
  await seller.click(`__card('ADS-0001').querySelector('[data-order-next]')`, 300)
  check(
    'Ana vê "🍨 Preparando seu pedido" sem recarregar, com a hora da etapa',
    await ana.waitFor(`__step('preparando') === 'current' && __text(__q('#etapa-atual')) === '🍨 Preparando seu pedido' && /\\d{2}:\\d{2}/.test(__text(__q('[data-step="preparando"]')))`),
    true,
  )
  const anaEvents = fake.realtime.stats.delivered.slice(deliveredBefore).filter((entry) => entry.table === 'order_events')
  check(
    'o evento vai só para a sessão da Ana (a Bia não recebe nada do pedido dela)',
    [anaEvents.length > 0, anaEvents.every((entry) => entry.token === anaSession.accessToken), anaEvents.some((entry) => entry.token === biaSession.accessToken)],
    [true, true, false],
  )
  check('a tela da Bia continua no "Pedido recebido"', await bia.run(`__step('recebido')`), 'current')
  check(
    'painel: depois do UPDATE (que chega sem a comanda, como no Supabase de verdade), o cartão continua com os itens da comanda',
    await seller.waitFor(`__card('ADS-0001')?.dataset.status === 'preparando' && __card('ADS-0001').querySelectorAll('[data-order-item]').length === 2`),
    true,
  )

  // --- Isolamento: a Bia não abre o pedido da Ana, nem pelo código nem pela função ---
  await bia.browser.goto(`${baseUrl}/acompanhar/ADS-0001`, desktop)
  check('Bia em /acompanhar/ADS-0001: "Pedido não encontrado neste aparelho"', await bia.waitFor(`__q('[data-tracking-missing]')`), true)
  check(
    'Bia pela função com o id do pedido da Ana: recusado, sem dados',
    await bia.run(`__pedido({ op: 'consultar', orderId: ${q(anaOrder.id)} }).then((r) => [r.ok, r.order === undefined])`),
    [false, true],
  )
  check(
    'Bia tentando acrescentar ao pedido da Ana: recusado e nada muda',
    [await bia.run(`__pedido({ op: 'adicionar', orderId: ${q(anaOrder.id)}, attemptId: 'tentativa-da-bia-000001', cart: ${q(JUJUBAS(1))}, expectedSubtotalCents: 100 }).then((r) => r.ok)`), (anaOrder.additions ?? []).length],
    [false, 0],
  )

  // --- Ana acrescenta itens ao mesmo pedido ---
  const notesBefore = await seller.run(`window.__notes.length`)
  const badgeBefore = await seller.run(`__q('[data-orders-badge]')?.dataset.ordersBadge ?? '0'`)
  await ana.click(`__q('[data-add-items]')`, 500)
  check(
    '"➕ Adicionar mais itens": o cardápio com a faixa do modo de adição',
    await ana.waitFor(`location.pathname === '/monte-seu-pedido' && __text(__q('[data-add-mode-banner]'))?.includes('➕ Adicionando itens ao pedido #ADS-0001')`),
    true,
  )
  check('a faixa explica e oferece "Cancelar adição"', await ana.run(`[__text(__q('[data-add-mode-banner]')).includes('Escolha os produtos que deseja acrescentar ao seu pedido.'), !!__q('[data-add-mode-cancel]')]`), [true, true])
  // Escolhe 2 jujubas e abre o carrinho (página nova: o modo de adição continua depois de recarregar).
  await openCart(ana, JUJUBAS(2))
  check('recarregou: o modo de adição continua, e o carrinho confirma a adição', await ana.waitFor(`__q('[data-add-mode-banner="ADS-0001"]') && __q('[data-add-panel="ADS-0001"]')`), true)
  check(
    'novos itens, sem frete de novo, e o novo total (R$ 3,00 + R$ 2,00)',
    await ana.run(`[__text(__q('[data-add-values]')), !__q('[data-finalize]')]`),
    ['Novos itens: 2 + R$ 2,00 Entrega sem cobrança nova NOVO TOTAL R$ 5,00', true],
  )
  await shotOf(ana, '[data-add-panel]', 'painel-adicao')
  await ana.run(`__set(__q('#troco-acrescimo'), '4,00')`)
  await ana.click(`__q('[data-add-confirm]')`, 300)
  check(
    'troco menor que o novo total: avisa no aparelho e nada vai para o servidor',
    [await ana.run(`__text(__q('#troco-acrescimo-erro'))`), (anaOrder.additions ?? []).length],
    ['O troco precisa ser para R$ 5,00 ou mais.', 0],
  )
  await ana.run(`__set(__q('#troco-acrescimo'), '')`)
  await ana.click(`__q('[data-add-confirm]')`, 300)
  check(
    'confirmado: volta ao acompanhamento com "✅ Itens adicionados ao pedido #ADS-0001!"',
    await ana.waitFor(`location.pathname === '/acompanhar/ADS-0001' && __text(__q('[data-order-success="itens"]'))?.startsWith('✅ Itens adicionados ao pedido #ADS-0001!')`),
    true,
  )
  check(
    'no banco: o MESMO pedido, um lote acrescentado, total novo, troco mantido, nenhum pedido novo',
    [fake.db.orders.length, anaOrder.code, anaOrder.additions.length, anaOrder.subtotal_cents, anaOrder.total_cents, anaOrder.change_for_cents, anaOrder.delivery_fee_cents],
    [2, 'ADS-0001', 1, 500, 500, 1000, 0],
  )
  check('o carrinho esvaziou e a faixa do modo de adição saiu', await ana.run(`[__cartItems(), !!__q('[data-add-mode-banner]')]`), [0, false])
  check(
    'o resumo da Ana mostra os itens acrescentados e o total novo',
    await ana.waitFor(`__text(__q('[data-order-summary] [data-order-addition]'))?.includes('2x Jujuba') && __text(__q('[data-order-total]')) === 'R$ 5,00'`),
    true,
  )
  check(
    'painel: "➕ Novos itens adicionados pelo cliente" no MESMO cartão, sem cartão novo',
    [
      await seller.waitFor(`__text(__card('ADS-0001')?.querySelector('[data-order-addition]'))?.includes('➕ Novos itens adicionados pelo cliente')`),
      await seller.run(`[__codes().length, __text(__card('ADS-0001').querySelector('[data-order-addition] [data-order-items]')), __text(__card('ADS-0001').querySelector('[data-addition-total]')), /^\\d{2}:\\d{2}$/.test(__text(__card('ADS-0001').querySelector('[data-addition-time]')))]`),
    ],
    [true, [2, '2x Jujuba R$ 2,00', '+ R$ 2,00', true]],
  )
  // Aviso de itens acrescentados (2026-11-20): o "ding-dong" (não o bipe de pedido novo), o destaque e o balão.
  check(
    'som: o "ding-dong" ascendente uma vez (dó e sol, triangular), sem o bipe de pedido novo',
    await seller.run(`window.__notes.slice(${notesBefore})`),
    ['triangle:523.25', 'triangle:783.99'],
  )
  check(
    'destaque: só o cartão do ADS-0001, com "➕ Novos itens adicionados"; o ADS-0002 fica como estava',
    await seller.run(`[!!__card('ADS-0001').matches('[data-order-added]'), __text(__card('ADS-0001').querySelector('[data-added-badge]'))?.startsWith('➕ Novos itens adicionados'), __card('ADS-0002').matches('[data-order-added]')]`),
    [true, true, false],
  )
  check(
    'aviso: "🔔 Novos itens adicionados ao pedido ADS-0001"',
    await seller.run(`__text(__q('[data-added-notice="ADS-0001"]'))?.includes('🔔 Novos itens adicionados ao pedido ADS-0001')`),
    true,
  )
  check(
    'o contador vermelho de pedidos novos não muda, e a situação do pedido também não',
    await seller.run(`[__q('[data-orders-badge]')?.dataset.ordersBadge ?? '0', __card('ADS-0001').dataset.status]`),
    [badgeBefore, 'preparando'],
  )
  await shotOf(seller, '[data-order-card="ADS-0001"]', 'cartao-vendedor-com-adicao')
  await seller.click(`__card('ADS-0001').querySelector('[data-added-seen]')`, 600)
  check('"✓ Visto": o destaque sai', await seller.run(`[__card('ADS-0001').matches('[data-order-added]'), !!__q('[data-added-notice="ADS-0001"]')]`), [false, false])

  // --- Em outra página do Modo Vendedor (o cardápio), pela navegação do site (sem recarregar) ---
  await seller.click(`__q('header a[href="/monte-seu-pedido"]')`, 800)
  check('vendedor no cardápio (navegação dentro do site)', await seller.waitFor(`location.pathname === '/monte-seu-pedido'`), true)
  const notesOnMenu = await seller.run(`window.__notes.length`)

  // --- Toque duplo e tentativa repetida: uma adição só ---
  await ana.click(`__q('[data-add-items]')`, 400)
  await openCart(ana, JUJUBAS(1, 'j10'))
  await ana.waitFor(`__q('[data-add-confirm]')`)
  await ana.run(`(() => { const b = __q('[data-add-confirm]'); b.click(); b.click(); return true })()`)
  check('toque duplo em "Confirmar adição": um lote só', [await ana.waitFor(`__q('[data-order-success="itens"]')`), anaOrder.additions.length, anaOrder.total_cents], [true, 2, 600])
  check(
    'no cardápio: o aviso do ADS-0001 aparece e o "ding-dong" toca uma vez (um lote só)',
    [await seller.waitFor(`__q('[data-added-notice="ADS-0001"]')`), await seller.run(`[location.pathname, window.__notes.slice(${notesOnMenu})]`)],
    [true, ['/monte-seu-pedido', ['triangle:523.25', 'triangle:783.99']]],
  )
  writeFileSync(join(outDir, 'aviso-no-cardapio.png'), Buffer.from((await seller.browser.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await seller.click(`__q('[data-added-notice="ADS-0001"] [data-added-notice-open]')`, 800)
  check(
    '"Ver pedido": abre o painel no cartão do ADS-0001, destacado e com o foco',
    await seller.waitFor(`location.pathname === '/pedidos' && __card('ADS-0001')?.matches('[data-order-added]') && document.activeElement === __card('ADS-0001')`),
    true,
  )
  const notesBeforeRepeat = await seller.run(`window.__notes.length`)
  const repeat = { op: 'adicionar', orderId: anaOrder.id, attemptId: 'tentativa-repetida-0001', cart: JUJUBAS(1, 'j11'), expectedSubtotalCents: 100 }
  const firstTry = await ana.run(`__pedido(${q(repeat)})`)
  const secondTry = await ana.run(`__pedido(${q(repeat)})`)
  check(
    'a mesma tentativa mandada duas vezes (internet que caiu): acrescenta uma vez só',
    [firstTry.ok, firstTry.repeated, secondTry.ok, secondTry.repeated, anaOrder.additions.length, anaOrder.total_cents],
    [true, false, true, true, 3, 700],
  )
  await seller.waitFor(`window.__notes.length >= ${notesBeforeRepeat + 2}`)
  await sleep(800)
  check('o lote repetido não toca de novo: um "ding-dong" só para as duas chamadas', await seller.run(`window.__notes.length - ${notesBeforeRepeat}`), 2)
  const notesBeforeRefused = await seller.run(`window.__notes.length`)
  check(
    'troco que não cobre o novo total: recusado pelo banco (nada muda)',
    [await ana.run(`__pedido({ op: 'adicionar', orderId: ${q(anaOrder.id)}, attemptId: 'tentativa-troco-000001', cart: ${q(JUJUBAS(4, 'j12'))}, expectedSubtotalCents: 400 }).then((r) => [r.ok, r.reason, r.totalCents])`), anaOrder.additions.length],
    [[false, 'troco', 1100], 3],
  )
  check(
    'preço que o cliente manda não vale: o servidor confere pelo cardápio',
    await ana.run(`__pedido({ op: 'adicionar', orderId: ${q(anaOrder.id)}, attemptId: 'tentativa-preco-0000001', cart: ${q(JUJUBAS(1, 'j13'))}, expectedSubtotalCents: 1 }).then((r) => [r.ok, r.reason])`),
    [false, 'total-mudou'],
  )

  // --- O pedido avança enquanto a cliente escolhe: a adição é bloqueada ---
  await ana.click(`__q('[data-add-items]')`, 400)
  await openCart(ana, JUJUBAS(1, 'j14'))
  await ana.waitFor(`__q('[data-add-confirm]')`)
  await seller.click(`__card('ADS-0001').querySelector('[data-order-next]')`, 300)
  check('o vendedor marca "pronto para retirada" no banco', anaOrder.status, 'pronto_retirada')
  check(
    'a tela da Ana bloqueia a adição na hora ("não aceita mais itens") e oferece um pedido novo',
    await ana.waitFor(`__q('[data-add-closed]') && !__q('[data-add-confirm]') && __q('[data-add-new-order]')`),
    true,
  )
  check(
    'e o banco também recusa (situação)',
    await ana.run(`__pedido({ op: 'adicionar', orderId: ${q(anaOrder.id)}, attemptId: 'tentativa-tarde-0000001', cart: ${q(JUJUBAS(1, 'j15'))}, expectedSubtotalCents: 100 }).then((r) => [r.ok, r.reason])`),
    [false, 'situacao'],
  )
  await ana.click(`__q('[data-add-new-order]')`, 400)
  check('"Fazer um novo pedido com estes itens": a finalização normal, com o item no carrinho', await ana.run(`[!!__q('[data-finalize]'), !!__q('[data-add-mode-banner]'), __cartItems()]`), [true, false, 1])
  await sleep(800)
  check(
    'acréscimos recusados (troco, preço, situação) e a mudança de situação pelo vendedor: nenhum som',
    await seller.run(`window.__notes.length - ${notesBeforeRefused}`),
    0,
  )

  // --- Vários pedidos no mesmo aparelho ---
  await placeOrder(ana, { name: 'Ana', kind: 'retirada', method: 'pix' })
  check('Ana faz outro pedido: ADS-0003', await ana.waitFor(`location.pathname === '/acompanhar/ADS-0003'`), true)
  await ana.browser.goto(`${baseUrl}/acompanhar`, desktop)
  check(
    '"Meus pedidos": os dois, o mais novo primeiro, cada um com a situação',
    await ana.run(`[...document.querySelectorAll('[data-tracked-order]')].map((row) => [row.dataset.trackedOrder, row.querySelector('[data-tracked-status]').textContent])`),
    [
      ['ADS-0003', 'Recebido'],
      ['ADS-0001', 'Pronto para retirada'],
    ],
  )
  await ana.browser.goto(`${baseUrl}/`, desktop)
  check(
    'a faixa "📦 Acompanhar pedido" nas outras páginas, com os dois em andamento',
    await ana.waitFor(`__text(__q('[data-tracking-strip]')) === '📦 Acompanhar pedido (2 em andamento)'`),
    true,
  )

  // --- Sem o Realtime: a tela continua se atualizando sozinha ---
  await ana.browser.goto(`${baseUrl}/acompanhar/ADS-0003`, desktop)
  await ana.waitFor(`__q('[data-live="live"]')`)
  fake.realtime.closeAll()
  await seller.click(`__card('ADS-0003').querySelector('[data-order-next]')`, 300)
  check('Realtime caiu: a etapa nova chega mesmo assim (reconexão ou consulta a cada 20 s)', await ana.waitFor(`__step('preparando') === 'current'`, 30_000), true)

  // --- Celular ---
  for (const width of [390, 320]) {
    await ana.browser.goto(`${baseUrl}/acompanhar/ADS-0001`, { width, height: 844 })
    await ana.waitFor(`__q('[data-tracking-timeline]')`)
    check(`${width} px: acompanhamento sem rolagem lateral`, await ana.run(`__noOverflow()`), true)
    if (width === 390) writeFileSync(join(outDir, 'acompanhamento-390.png'), await ana.browser.screenshot({ x: 0, y: 0, width: 390, height: 2400 }))
    await ana.browser.goto(`${baseUrl}/`, { width, height: 844 })
    await ana.waitFor(`__q('[data-tracking-strip]')`)
    check(`${width} px: faixa do pedido sem rolagem lateral`, await ana.run(`__noOverflow()`), true)
  }

  const problems = [ana, bia, seller].flatMap((who) => who.browser.consoleProblems())
  check('console sem erros', problems, [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  for (const who of [ana, bia, seller]) who.browser.close()
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
