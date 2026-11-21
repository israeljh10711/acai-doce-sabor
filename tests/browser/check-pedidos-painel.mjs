// Confere no navegador o painel de pedidos AO VIVO do Modo Vendedor (2026-11-20), sem um Supabase
// de verdade: sobe o Supabase de mentira (função "pedido" gerada, login do vendedor e Realtime
// por WebSocket, fake-realtime.mjs) e um segundo site na porta 5179 ligado a ele.
// - sem login: a página pede a senha; com login, "📋 Pedidos" na faixa com o selo vermelho;
// - inscrição no Realtime com o token do vendedor, uma só para a faixa e a página;
// - cartões: #código, hora, cliente, selo da modalidade, itens organizados (Completo, SEM, extras
//   pagos, observação), endereço e GPS só na entrega, pagamento, WhatsApp do cliente;
// - filtros rápidos; fluxo de cada modalidade gravado no banco; cancelar com confirmação; erro;
// - Realtime: INSERT aparece na hora com o bipe (sem recarregar); UPDATE de outro aparelho sem
//   bipe; evento repetido sem duplicar; silenciado sem bipe; contador em outra página;
// - sair do Modo Vendedor remove a inscrição; 1280, 390 e 320 px sem rolagem lateral;
// - fila de produção (2026-11-21): abre em "Em andamento", do mais antigo para o mais novo; "Há N min"
//   e atraso (só entrega, pelo tempo da loja); "✅ Concluir" com confirmação; "↩ Voltar etapa"; busca
//   por código ou nome; tela acesa (Wake Lock) só no painel; aviso de som bloqueado na faixa.
//
// Uso: node tests/browser/check-pedidos-painel.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer } from 'vite'
import { PUBLIC_KEY, SELLER_PASSWORD, SELLER_TOKEN, startFakeSupabase } from './fake-supabase.mjs'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5179
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'painel-pedidos')
mkdirSync(outDir, { recursive: true })
const failures = []
let checks = 0

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

// O carrinho com um Açaí Completo de verdade, montado pelas regras do próprio site.
const src = (path) => pathToFileURL(join(process.cwd(), 'src', path)).href
const { EMPTY_CART, addExtraItem, addItem, cartTotalCents, serializeCart, setNote } = await import(src('features/cart/cart.ts'))
const { PRODUCTS } = await import(src('features/catalog/menu.ts'))
const { EMPTY_SELECTION, addTopping, applyComplete, chooseSize, removeTopping } = await import(src('features/catalog/selection.ts'))

const fake = await startFakeSupabase()
fake.db.changes.push({
  kind: 'settings',
  id: 'loja',
  data: { override: { state: 'open', until: Date.now() + 3_600_000 }, delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] } },
})

/** Jujuba (R$ 1,00) e Água (R$ 2,00, "bem gelada"): R$ 3,00. */
const SIMPLE = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1, note: 'bem gelada' },
  ],
})
const tradicional = PRODUCTS['acai-tradicional']
let completo = removeTopping(applyComplete(tradicional, chooseSize(tradicional, EMPTY_SELECTION, 'isopor-m').selection), 'farinha-lactea')
completo = addTopping(tradicional, completo, 'kit-kat')
let completoCart = addItem(EMPTY_CART, 'acai-tradicional', completo, 'c1').cart
completoCart = setNote(completoCart, 'c1', 'pouco gelo')
completoCart = addExtraItem(completoCart, 'jujuba', {}, 'j1').cart
const COMPLETO = serializeCart(completoCart)
const COMPLETO_TOTAL = cartTotalCents(completoCart)

const customer = (patch) => ({ name: '', phone: '', kind: null, street: '', number: '', district: '', zoneId: null, reference: '', gps: null, ...patch })
const GPS = { lat: -7.220987, lng: -37.254124 }
const PIX = { method: 'pix', changeFor: '', exact: false }
/** Um pedido pela função "pedido" de verdade (como o carrinho manda). */
async function placeOrder(draft, payment, expectedTotalCents, cart = SIMPLE) {
  const response = await fetch(`${fake.url}/functions/v1/pedido`, {
    method: 'POST',
    headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart, customer: draft, payment, expectedTotalCents }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`pedido recusado: ${JSON.stringify(body)}`)
  return body.code
}
const codes = {
  gps: await placeOrder(customer({ name: 'Ana GPS', phone: '83999990000', kind: 'entrega', street: 'Rua das Flores', number: '12A', zoneId: 'centro', reference: 'portão azul', gps: GPS }), { method: 'dinheiro', changeFor: '10', exact: false }, 600),
  retirada: await placeOrder(customer({ name: 'Bruno Retira', kind: 'retirada', street: 'Rua Que Não Vai', number: '9', gps: GPS }), PIX, 300),
  local: await placeOrder(customer({ name: 'Carla Local', kind: 'local' }), { method: 'credito', changeFor: '', exact: false }, 300),
  semGps: await placeOrder(customer({ name: 'Davi Sem GPS', kind: 'entrega', street: 'Av. Brasil', number: 'S/N', zoneId: 'centro' }), PIX, 600),
  completo: await placeOrder(customer({ name: 'Fábio Completo', phone: '(83) 98888-1111', kind: 'retirada' }), PIX, COMPLETO_TOTAL, COMPLETO),
}
// Um pedido antigo (de antes de 2026-11-20): sem as colunas do GPS, na situação antiga "pronto".
fake.db.orders.push({
  id: 'antigo-0099',
  number: 99,
  code: 'ADS-0099',
  attempt_key: 'a'.repeat(64),
  created_at: new Date(Date.now() - 60_000).toISOString(),
  status: 'pronto',
  customer_name: 'Pedido Antigo',
  customer_phone: null,
  fulfillment: 'retirada',
  address: null,
  delivery_fee: 'retirada',
  delivery_fee_cents: 0,
  delivery_zone: null,
  payment_method: 'pix',
  change_for_cents: null,
  subtotal_cents: 300,
  total_cents: 300,
  antecipado: false,
  whatsapp: '5583996999980',
  items: [{ name: 'Jujuba', quantity: 1, unit_cents: 100, total_cents: 100 }],
  cart: {},
  message: 'pedido antigo sem a parte dos itens',
})

process.env.VITE_SUPABASE_URL = fake.url
process.env.VITE_SUPABASE_ANON_KEY = PUBLIC_KEY
process.env.VITE_SELLER_EMAIL = 'vendedor@teste.local'
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-painel'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__card = (code) => __q('[data-order-card="' + code + '"]');
  window.__codes = () => [...document.querySelectorAll('[data-order-card]')].map((card) => card.dataset.orderCard);
  window.__text = (el) => el?.innerText.replace(/\\s+/g, ' ').trim() ?? null;
  window.__noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;
  window.__fakeAudio = () => {
    window.__tones = 0;
    class FakeAudio {
      constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.listeners = []; }
      addEventListener(type, listener) { this.listeners.push(listener); }
      resume() { this.state = 'running'; this.listeners.forEach((listener) => listener()); return Promise.resolve(); }
      createOscillator() { return { type: 'sine', frequency: { value: 0 }, connect: (node) => node, start: () => { window.__tones++ }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node) => node }; }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio, configurable: true });
    return true;
  };
  true;
`

const WAKE_LOCK_FAKE = `(() => {
  window.__wake = { requests: 0, releases: 0, held: 0 };
  const api = {
    request: async () => {
      window.__wake.requests++;
      window.__wake.held++;
      const listeners = [];
      const sentinel = {
        released: false,
        release: async () => {
          if (sentinel.released) return;
          sentinel.released = true;
          window.__wake.releases++;
          window.__wake.held--;
          listeners.forEach((listener) => listener());
        },
        addEventListener: (_type, listener) => listeners.push(listener),
      };
      return sentinel;
    },
  };
  Object.defineProperty(navigator, 'wakeLock', { value: api, configurable: true });
})()`
const browser = await openBrowser(join(outDir, 'edge-profile'), 9379)
// Tela acesa (2026-11-21): o Wake Lock de mentira vale em todas as páginas abertas daqui em diante.
await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: WAKE_LOCK_FAKE })
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
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
const shot = async (name) => writeFileSync(join(outDir, `${name}.png`), await browser.screenshot())
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const statusOf = (code) => fake.db.orders.find((order) => order.code === code)?.status
const q = JSON.stringify

try {
  const desktop = { width: 1280, height: 900 }
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); ${quiet}`)

  // --- Sem login ---
  await browser.goto(`${baseUrl}/pedidos`, desktop)
  await run(`${quiet}; __fakeAudio()`)
  await waitFor(`__q('[data-orders-notice]')`)
  check(
    'sem login: a página pede a senha; sem botão "Pedidos" nem pedidos',
    await run(`[__text(__q('[data-orders-notice] h2')), !!__q('[data-orders-login]'), !!__q('[data-orders-link]'), document.querySelectorAll('[data-order-card]').length, document.querySelector('meta[name="robots"]')?.content]`),
    ['Esta página é do Modo Vendedor', true, false, 0, 'noindex'],
  )
  check('sem login: nenhuma inscrição no Realtime', fake.realtime.sellerSubscriptions(), 0)
  await click(`__q('[data-orders-login]')`, 600)
  await run(`(() => { const el = __q('#senha-vendedor'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${q(SELLER_PASSWORD)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.form.requestSubmit(); return true })()`)
  check('login: o painel carrega os pedidos', await waitFor(`document.querySelectorAll('[data-order-card]').length >= 6`), true)
  await waitFor(`__q('[data-orders-link]')`)
  check('ao vivo: conectado ao Realtime', await waitFor(`__q('[data-orders-live]')?.dataset.ordersLive === 'live'`), true)
  check('uma inscrição só (faixa e página dividem), com o token do vendedor', [fake.realtime.sellerSubscriptions(), fake.realtime.stats.subscriptions.every((sub) => sub.token === SELLER_TOKEN)], [1, true])
  check(
    '"📋 Pedidos" na faixa com o selo vermelho dos novos',
    await run(`[__text(__q('[data-orders-link]')), __q('[data-orders-link]').getAttribute('aria-label'), __q('[data-orders-badge]')?.dataset.ordersBadge, getComputedStyle(__q('[data-orders-badge] span:last-child')).backgroundColor]`),
    ['📋 Pedidos (5)', 'Pedidos (5 novos)', '5', 'oklch(0.577 0.245 27.325)'],
  )

  // --- Lista e cartões ---
  check(
    'abre em "⏳ Em andamento": a fila do pedido mais antigo para o mais novo (pela hora do pedido)',
    [await run(`__q('[data-orders-filter="andamento"]').getAttribute('aria-pressed')`), await run(`__codes()`)],
    ['true', ['ADS-0099', codes.gps, codes.retirada, codes.local, codes.semGps, codes.completo]],
  )
  check('tela acesa: o painel pediu o Wake Lock uma vez e está segurando', await run(`[window.__wake.requests >= 1, window.__wake.held]`), [true, 1])
  check(
    'cada pedido em andamento mostra há quanto tempo entrou',
    await run(`__codes().map((code) => /^Há (menos de 1|\\d+) min$/.test(__text(__card(code).querySelector('[data-order-elapsed]')) ?? ''))`),
    [true, true, true, true, true, true],
  )
  check(
    'cabeçalho: #código, hora HH:MM, cliente e selo da modalidade',
    await run(`${q(Object.values(codes))}.map((code) => { const card = __card(code); return [__text(card.querySelector('h2')), /^\\d{2}:\\d{2}$/.test(__text(card.querySelector('[data-order-time]'))), card.querySelector('[data-order-customer]').firstChild.textContent, __text(card.querySelector('[data-modality]'))] })`),
    [
      [`#${codes.gps}`, true, 'Ana GPS', '🛵 Entrega'],
      [`#${codes.retirada}`, true, 'Bruno Retira', '🛍️ Retirar'],
      [`#${codes.local}`, true, 'Carla Local', '🍨 Comer no Local'],
      [`#${codes.semGps}`, true, 'Davi Sem GPS', '🛵 Entrega'],
      [`#${codes.completo}`, true, 'Fábio Completo', '🛍️ Retirar'],
    ],
  )
  check(
    'Comer no Local em dourado e roxo',
    await run(`(() => { const s = getComputedStyle(__card(${q(codes.local)}).querySelector('[data-modality]')); return [s.backgroundColor, s.color] })()`),
    ['rgb(250, 204, 21)', 'rgb(42, 8, 29)'],
  )
  check('pedido antigo aparece (Retirar, situação antiga "Pronto", lista gravada)', await run(`[__text(__card('ADS-0099').querySelector('[data-modality]')), __card('ADS-0099').querySelector('[data-status-pill]').textContent, __text(__card('ADS-0099').querySelector('[data-order-items]'))]`), ['🛍️ Retirar', 'Pronto', '1x Jujuba — R$ 1,00'])
  check(
    'entrega com GPS: endereço, bairro, referência e "📍 Abrir GPS no Mapa" do pedido, em outra aba',
    await run(`(() => { const card = __card(${q(codes.gps)}); const a = card.querySelector('[data-order-gps]'); return [[...card.querySelectorAll('[data-order-address] p')].map(__text), __text(a), a.href, a.target, a.rel] })()`),
    [['Rua das Flores, 12A', 'Bairro: Centro', 'Ref.: portão azul'], '📍 Abrir GPS no Mapa', 'https://www.google.com/maps?q=-7.220987,-37.254124', '_blank', 'noopener noreferrer'],
  )
  check('entrega sem GPS: endereço, sem botão de GPS', await run(`[!!__card(${q(codes.semGps)}).querySelector('[data-order-address]'), !!__card(${q(codes.semGps)}).querySelector('[data-order-gps]')]`), [true, false])
  check(
    'retirar e comer no local: sem endereço nem GPS (mesmo com rua e GPS mandados no pedido)',
    await run(`[${q(codes.retirada)}, ${q(codes.local)}].map((code) => [!!__card(code).querySelector('[data-order-address]'), !!__card(code).querySelector('[data-order-gps]'), __card(code).textContent.includes('Rua Que Não Vai')])`),
    [[false, false, false], [false, false, false]],
  )
  check(
    'itens organizados: Completo, "🚫 SEM" e extras pagos em destaque, acompanhamentos e observação',
    await run(`(() => { const item = __card(${q(codes.completo)}).querySelector('[data-order-item]'); return [__text(item.querySelector('p')), item.textContent.includes('✨ COMPLETO'), __text(item.querySelector('[data-item-removed]')), __text(item.querySelector('[data-item-paid]')), __text(item.querySelector('[data-item-note]')), getComputedStyle(item.querySelector('[data-item-removed]')).color] })()`),
    ['1x Açaí Tradicional R$ 19,00', true, '🚫 SEM: Farinha láctea', '➕ Extras pagos: Kit Kat (+R$ 4,00)', '📝 Observação: pouco gelo', 'oklch(0.444 0.177 26.899)'],
  )
  check('itens simples com a observação', await run(`[...__card(${q(codes.gps)}).querySelectorAll('[data-order-item]')].map((item) => __text(item))`), ['1x Jujuba R$ 1,00', '1x Água Mineral 500 ml R$ 2,00 📝 Observação: bem gelada'])
  check(
    'valores e pagamento: frete do bairro, total e "💵 Dinheiro — Troco para"',
    await run(`[[...__card(${q(codes.gps)}).querySelectorAll('dl > div:not([data-order-payment])')].map((row) => __text(row)), __text(__card(${q(codes.gps)}).querySelector('[data-order-payment]'))]`),
    [['Subtotal R$ 3,00', 'Frete (Centro) R$ 3,00', 'TOTAL R$ 6,00'], '💵 Dinheiro — Troco para R$ 10,00 (levar R$ 4,00)'],
  )
  check(
    'pagamentos: 💳 Cartão e 💠 Pix; frete grátis em comer no local e retirar',
    await run(`[__text(__card(${q(codes.local)}).querySelector('[data-order-payment]')), __text(__card(${q(codes.retirada)}).querySelector('[data-order-payment]')), __text(__card(${q(codes.local)}).querySelectorAll('dl > div')[1]), __text(__card(${q(codes.retirada)}).querySelectorAll('dl > div')[1])]`),
    ['💳 Cartão de crédito', '💠 Pix', 'Consumo no local Grátis', 'Retirada na loja Grátis'],
  )
  check(
    '"💬 Chamar Cliente no WhatsApp" com o telefone do próprio cliente; sem telefone, sem botão',
    await run(`[${q(codes.gps)}, ${q(codes.completo)}, ${q(codes.local)}].map((code) => { const a = __card(code).querySelector('[data-order-whatsapp]'); return a ? [__text(a), a.href, a.target, a.rel] : null })`),
    [['💬 Chamar Cliente no WhatsApp', 'https://wa.me/5583999990000', '_blank', 'noopener noreferrer'], ['💬 Chamar Cliente no WhatsApp', 'https://wa.me/5583988881111', '_blank', 'noopener noreferrer'], null],
  )
  check(
    'filtros rápidos com a contagem',
    await run(`[...document.querySelectorAll('[data-orders-filter]')].map((b) => __text(b))`),
    ['⏳ Em andamento 6', 'Todos 6', '🆕 Novos 5', '🍨 Preparando 0', '🛵 Saiu / Pronto 1', '✅ Concluídos 0'],
  )
  check('título da aba com os pedidos novos', await run(`document.title`), '(5) Pedidos | Açaí Doce Sabor')
  check(
    'som: antes de um toque o painel não diz "Som Ativo" e pede para ativar',
    await run(`[__text(__q('[data-orders-sound-on]')), __q('[data-orders-sound-on]').getAttribute('aria-pressed'), !!__q('[data-orders-sound-hint]')]`),
    ['🔔 Ativar som', 'false', true],
  )
  await click(`__q('[data-orders-sound-on]')`, 400)
  check('som: liberado pelo toque, "🔔 Som Ativo"', await run(`[__text(__q('[data-orders-sound-on]')), __q('[data-orders-sound-on]').getAttribute('aria-pressed'), !!__q('[data-orders-sound-hint]')]`), ['🔔 Som Ativo', 'true', false])
  await shot('1280-painel')

  // --- Fluxo de cada modalidade ---
  const advance = async (code) => {
    const label = await run(`__text(__card(${q(code)})?.querySelector('[data-order-next]'))`)
    await click(`__card(${q(code)}).querySelector('[data-order-next]')`, 700)
    // "✅ Concluir" pede confirmação (2026-11-21).
    if (await run(`!!__card(${q(code)})?.querySelector('[data-order-conclude-confirm]')`)) await click(`__card(${q(code)}).querySelector('[data-order-conclude-confirm]')`, 700)
    return [label, statusOf(code)]
  }
  const dineIn = q(codes.local)
  await advance(codes.local)
  await advance(codes.local)
  await click(`__card(${dineIn}).querySelector('[data-order-next]')`, 400)
  check(
    '"✅ Concluir" pede confirmação leve no cartão, sem gravar nada ainda',
    [await run(`__text(__card(${dineIn}).querySelector('[data-order-conclude-ask] p'))`), statusOf(codes.local), await run(`!!__card(${dineIn}).querySelector('[data-order-next]')`)],
    ['Deseja realmente concluir este pedido?', 'pronto_consumo', false],
  )
  await click(`__card(${dineIn}).querySelector('[data-order-conclude-cancel]')`, 400)
  check('"Cancelar" na confirmação: nada muda', [statusOf(codes.local), await run(`__text(__card(${dineIn}).querySelector('[data-order-next]'))`)], ['pronto_consumo', '✅ Concluir'])
  await click(`__card(${dineIn}).querySelector('[data-order-next]')`, 300)
  await click(`__card(${dineIn}).querySelector('[data-order-conclude-confirm]')`, 900)
  check(
    '"Confirmar": concluído no banco; o cartão fica alguns segundos com o aviso e o "↩ Voltar etapa"',
    [
      statusOf(codes.local),
      await run(`__text(__card(${dineIn})?.querySelector('[data-order-flash]'))`),
      await run(`__card(${dineIn})?.querySelector('[data-order-back]')?.dataset.orderBack`),
      await run(`__text(__card(${dineIn})?.querySelector('[data-order-back]'))`),
    ],
    ['concluido', '✅ Pedido concluído', 'pronto_consumo', '↩ Voltar etapa (Pronto para consumo)'],
  )
  await click(`__card(${dineIn}).querySelector('[data-order-back]')`, 900)
  check(
    '"↩ Voltar etapa": volta para "Pronto para consumo" no banco, com o aviso de etapa restaurada',
    [statusOf(codes.local), await run(`__text(__card(${dineIn}).querySelector('[data-order-flash]'))`), await run(`__text(__card(${dineIn}).querySelector('[data-order-next]'))`)],
    ['pronto_consumo', '↩ Etapa restaurada: Pronto para consumo', '✅ Concluir'],
  )
  await click(`__card(${dineIn}).querySelector('[data-order-back]')`, 900)
  check('voltar de novo: Preparando (a etapa anterior válida)', statusOf(codes.local), 'preparando')
  await click(`__card(${dineIn}).querySelector('[data-order-back]')`, 900)
  check('e de novo: Novo, onde não há mais etapa anterior', [statusOf(codes.local), await run(`!!__card(${dineIn}).querySelector('[data-order-back]')`)], ['novo', false])
  check(
    'comer no local: Aceitar / Preparar → 🍨 Pronto para Consumo → ✅ Concluir, gravado no banco',
    [await advance(codes.local), await advance(codes.local), await advance(codes.local)],
    [
      ['Aceitar / Preparar', 'preparando'],
      ['🍨 Pronto para Consumo', 'pronto_consumo'],
      ['✅ Concluir', 'concluido'],
    ],
  )
  check(
    'concluído: "✅ Pedido concluído", sem ações de preparo',
    await run(`[__text(__card(${q(codes.local)}).querySelector('[data-order-final]')), !!__card(${q(codes.local)}).querySelector('[data-order-next]'), !!__card(${q(codes.local)}).querySelector('[data-order-cancel]')]`),
    ['✅ Pedido concluído', false, false],
  )
  check('entrega: Aceitar / Preparar → 🛵 Saiu para Entrega', [await advance(codes.gps), await advance(codes.gps)], [['Aceitar / Preparar', 'preparando'], ['🛵 Saiu para Entrega', 'saiu_para_entrega']])
  check('retirar: Aceitar / Preparar → 🛍️ Pronto para Retirada', [await advance(codes.retirada), await advance(codes.retirada)], [['Aceitar / Preparar', 'preparando'], ['🛍️ Pronto para Retirada', 'pronto_retirada']])
  await click(`__q('[data-orders-filter="saiu_pronto"]')`, 300)
  check('filtro 🛵 Saiu / Pronto (na ordem da fila)', await run(`__codes()`), ['ADS-0099', codes.gps, codes.retirada])
  await click(`__q('[data-orders-filter="concluidos"]')`, 300)
  check('filtro ✅ Concluídos', await run(`__codes()`), [codes.local])
  await click(`__q('[data-orders-filter="todos"]')`, 300)

  // --- Cancelar ---
  const pickup = q(codes.retirada)
  await click(`__card(${pickup}).querySelector('[data-order-cancel]')`, 300)
  check('"❌ Cancelar" pede confirmação no cartão', await run(`__text(__card(${pickup}).querySelector('[role="group"] p'))`), `Cancelar o pedido #${codes.retirada}?`)
  await click(`__card(${pickup}).querySelector('[data-order-cancel-back]')`, 300)
  check('"Não": nada muda', [statusOf(codes.retirada), await run(`!!__card(${pickup}).querySelector('[data-order-cancel]')`)], ['pronto_retirada', true])
  await click(`__card(${pickup}).querySelector('[data-order-cancel]')`, 300)
  await click(`__card(${pickup}).querySelector('[data-order-cancel-confirm]')`, 700)
  check(
    '"Sim, cancelar": cancelado no banco, identificado no cartão, em Todos e fora de Concluídos',
    [statusOf(codes.retirada), await run(`__text(__card(${pickup}).querySelector('[data-order-final]'))`), await run(`!!__card(${pickup}).querySelector('[data-order-next]')`), await run(`__text(__q('[data-orders-filter="concluidos"]'))`)],
    ['cancelado', '❌ Pedido cancelado', false, '✅ Concluídos 1'],
  )

  // --- Busca rápida (2026-11-21) ---
  const search = async (text) => {
    await run(`(() => { const el = __q('[data-orders-search]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${q(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(250)
    return run(`__codes()`)
  }
  check('busca pelo nome, sem acento nem maiúsculas: "fabio" acha o Fábio', await search('fabio'), [codes.completo])
  check('busca por parte do nome: "davi"', await search('davi'), [codes.semGps])
  check('busca pelo código inteiro', await search(codes.gps), [codes.gps])
  check('busca por parte do código (sem o "ADS-")', await search(codes.local.slice(-4)), [codes.local])
  await click(`__q('[data-orders-filter="concluidos"]')`, 300)
  check('busca junto com o filtro: "davi" em Concluídos não acha nada, com o aviso e "Limpar busca"', [await search('davi'), await run(`__text(__q('[data-orders-empty]'))`)], [[], 'Nenhum pedido encontrado para “davi” neste filtro. Limpar busca'])
  await click(`__q('[data-orders-search-reset]')`, 300)
  check('"Limpar busca": volta a lista do filtro', [await run(`__q('[data-orders-search]').value`), await run(`__codes()`)], ['', [codes.local]])
  await click(`__q('[data-orders-filter="todos"]')`, 300)
  await search('ana')
  await click(`__q('[data-orders-search-clear]')`, 300)
  check('o ✕ da busca limpa e mostra todos de novo', (await run(`__codes()`)).length, 6)

  // --- Erro ao gravar ---
  fake.state.failOrdersPatch = true
  const noGps = q(codes.semGps)
  await click(`__card(${noGps}).querySelector('[data-order-next]')`, 900)
  check(
    'erro ao gravar: aviso no cartão, situação mantida',
    [await run(`__text(__card(${noGps}).querySelector('[role="alert"]'))`), statusOf(codes.semGps), await run(`__card(${noGps}).querySelector('[data-status-pill]').textContent`)],
    ['Não foi possível mudar a situação. Confira a internet e tente de novo.', 'novo', 'Novo'],
  )
  fake.state.failOrdersPatch = false

  // --- Realtime: INSERT na hora, com bipe; contador ---
  const before = await run(`window.__tones`)
  const started = Date.now()
  const arrived = await placeOrder(customer({ name: 'Eva Nova', kind: 'local' }), PIX, 300)
  check('pedido novo aparece sozinho em menos de 3 s (Realtime, sem recarregar)', await waitFor(`__card(${q(arrived)})`, 3000), true)
  const elapsed = Date.now() - started
  check(
    'pedido novo: bipe (duas notas), contador e título',
    await run(`[window.__tones - ${before}, __q('[data-orders-badge]')?.dataset.ordersBadge, document.title]`),
    [2, '3', '(3) Pedidos | Açaí Doce Sabor'],
  )
  console.log(`     pedido novo apareceu em ${elapsed} ms`)

  // --- Realtime: UPDATE de outro aparelho, sem bipe ---
  const tonesBeforeUpdate = await run(`window.__tones`)
  const otherDevice = await fetch(`${fake.url}/rest/v1/orders?id=eq.${fake.db.orders.find((order) => order.code === codes.semGps).id}&select=*`, {
    method: 'PATCH',
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${SELLER_TOKEN}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'preparando' }),
  })
  check('outro aparelho muda a situação', otherDevice.status, 200)
  check('UPDATE chega na hora: o cartão muda, sem bipe', [await waitFor(`__card(${noGps}).dataset.status === 'preparando'`, 3000), (await run(`window.__tones`)) - tonesBeforeUpdate], [true, 0])

  // --- Realtime: evento repetido não duplica nem toca de novo ---
  const tonesBeforeRepeat = await run(`window.__tones`)
  fake.realtime.publish('INSERT', fake.db.orders.find((order) => order.code === arrived))
  await sleep(800)
  check('INSERT repetido: um cartão só, sem bipe', [(await run(`__codes()`)).filter((code) => code === arrived).length, (await run(`window.__tones`)) - tonesBeforeRepeat], [1, 0])

  // --- Silenciado ---
  await click(`__q('[data-orders-sound-off]')`, 300)
  const tonesMuted = await run(`window.__tones`)
  const quietOrder = await placeOrder(customer({ name: 'Gil Silencioso', kind: 'retirada' }), PIX, 300)
  check('silenciado: o pedido chega, sem bipe', [await waitFor(`__card(${q(quietOrder)})`, 3000), (await run(`window.__tones`)) - tonesMuted, await run(`__q('[data-orders-sound-off]').getAttribute('aria-pressed')`)], [true, 0, 'true'])
  check('silenciado de propósito: nenhum aviso de "som bloqueado" na faixa', await run(`!!__q('[data-orders-sound-hint]')`), false)
  await click(`__q('[data-orders-sound-on]')`, 300)

  // --- Atraso (2026-11-21): só entrega, depois do tempo de entrega da loja (padrão 30–45 min) ---
  const oldOrder = (number, fulfillment, status) => ({
    ...fake.db.orders.find((order) => order.code === 'ADS-0099'),
    id: `antigo-${number}`,
    number,
    code: `ADS-${String(number).padStart(4, '0')}`,
    attempt_key: String(number).repeat(64).slice(0, 64),
    created_at: new Date(Date.now() - 2 * 60 * 60_000 - 5 * 60_000 - 30_000).toISOString(),
    status,
    fulfillment,
    delivery_fee: fulfillment === 'entrega' ? 'taxa' : fulfillment,
    customer_name: fulfillment === 'entrega' ? 'Ivo Atrasado' : 'Júlia Balcão',
  })
  fake.db.orders.push(oldOrder(97, 'entrega', 'preparando'), oldOrder(96, 'retirada', 'preparando'))
  await click(`__q('[data-orders-refresh]')`, 1200)
  await click(`__q('[data-orders-filter="andamento"]')`, 300)
  check('os pedidos antigos entram no começo da fila', (await run(`__codes()`)).slice(0, 2), ['ADS-0096', 'ADS-0097'])
  check(
    'entrega há mais de 45 min: tempo destacado como atrasado; retirada antiga: só o tempo, sem alerta (a loja não configura tempo de retirada)',
    await run(`['ADS-0097', 'ADS-0096'].map((code) => { const el = __card(code).querySelector('[data-order-elapsed]'); return [__text(el), el.hasAttribute('data-late')] })`),
    [
      ['⚠️ Há 2 h 05 min · atrasado', true],
      ['Há 2 h 05 min', false],
    ],
  )
  await shot('1280-fila-atraso')

  // --- Celulares (com a sessão) ---
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await browser.goto(`${baseUrl}/pedidos`, viewport)
    await run(quiet)
    check(`${viewport.width} px: painel abre com a sessão guardada`, await waitFor(`document.querySelectorAll('[data-order-card]').length >= 6`), true)
    check(`${viewport.width} px: sem rolagem lateral`, await run(`__noOverflow()`), true)
    await shot(`${viewport.width}-painel`)
  }

  // --- Contador em outra página ---
  await browser.goto(`${baseUrl}/pedidos`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-orders-live]')?.dataset.ordersLive === 'live'`)
  check('tela acesa no painel', await run(`window.__wake.held`), 1)
  await click(`[...document.querySelectorAll('header a')].find((a) => a.textContent.trim() === 'Cardápio')`, 800)
  check('saiu do painel (para o cardápio): a tela acesa é liberada', await run(`[window.__wake.held, window.__wake.releases >= 1]`), [0, true])
  const badgeBefore = Number(await run(`__q('[data-orders-badge]')?.dataset.ordersBadge ?? 0`))
  await placeOrder(customer({ name: 'Hugo Cardápio', kind: 'local' }), PIX, 300)
  check(
    'no cardápio: o selo da faixa conta o pedido novo na hora, sem recarregar',
    [new URL(await run(`location.href`)).pathname, await waitFor(`Number(__q('[data-orders-badge]')?.dataset.ordersBadge) === ${badgeBefore + 1}`, 3000)],
    ['/monte-seu-pedido', true],
  )

  // --- Sair do Modo Vendedor: a inscrição sai ---
  await click(`[...document.querySelectorAll('[data-seller-bar] button')].find((b) => b.textContent.includes('Sair do Modo Vendedor'))`, 1000)
  const left = await (async () => {
    for (let waited = 0; waited < 5000; waited += 100) {
      if (fake.realtime.sellerSubscriptions() === 0) return true
      await sleep(100)
    }
    return false
  })()
  check('sair do Modo Vendedor: a inscrição do Realtime é removida e o botão some', [left, await run(`!!__q('[data-orders-link]')`)], [true, false])

  const problems = browser.consoleProblems().filter((problem) => !/500|Internal Server Error/i.test(String(problem)))
  check('console sem outros erros', problems, [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  browser.close()
  await site.close()
  await fake.close()
}

console.log(`${checks - failures.length}/${checks} conferências passaram. Fotos em ${outDir}`)
if (failures.length) {
  console.log(failures.map((failure) => `FALHA ${failure}`).join('\n'))
  process.exit(1)
}
