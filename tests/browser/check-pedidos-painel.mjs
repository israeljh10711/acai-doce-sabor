// Confere no navegador o painel de pedidos do Modo Vendedor (pedido de 2026-11-20, etapa 2), sem
// um Supabase de verdade: sobe o Supabase de mentira (com a função "pedido" gerada e o login do
// vendedor) e um segundo site na porta 5179 ligado a ele. O site da porta 5173 não muda.
// - pedidos criados pela função de verdade: entrega com GPS, entrega sem GPS, retirar e comer no
//   local, mais um pedido antigo (antes das colunas novas);
// - sem login: a página pede a senha; com login, o botão "Pedidos" na faixa;
// - selos das modalidades (Comer no Local em dourado e roxo), "Abrir GPS no Mapa" só na entrega
//   com GPS, sem endereço fora da entrega, itens, total e pagamento;
// - avançar a situação (gravada no banco), cancelar com confirmação, erro ao gravar, filtros;
// - pedido novo chegando pela atualização automática: cartão, bipe e título da aba;
// - 1280, 390 e 320 px sem rolagem lateral.
//
// Uso: node tests/browser/check-pedidos-painel.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { PUBLIC_KEY, SELLER_PASSWORD, startFakeSupabase } from './fake-supabase.mjs'
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

const fake = await startFakeSupabase()
// Loja aberta e frete por bairro no "banco".
fake.db.changes.push({
  kind: 'settings',
  id: 'loja',
  data: { override: { state: 'open', until: Date.now() + 3_600_000 }, delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] } },
})

/** Jujuba (R$ 1,00) e Água (R$ 2,00): R$ 3,00. */
const CART = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1, note: 'bem gelada' },
  ],
})
const customer = (patch) => ({ name: '', phone: '', kind: null, street: '', number: '', district: '', zoneId: null, reference: '', gps: null, ...patch })
const GPS = { lat: -7.220987, lng: -37.254124 }
/** Um pedido pela função "pedido" de verdade (como o carrinho manda). */
async function placeOrder(draft, payment, expectedTotalCents) {
  const response = await fetch(`${fake.url}/functions/v1/pedido`, {
    method: 'POST',
    headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart: CART, customer: draft, payment, expectedTotalCents }),
  })
  const body = await response.json()
  if (!body.ok) throw new Error(`pedido recusado: ${JSON.stringify(body)}`)
  return body.code
}
const PIX = { method: 'pix', changeFor: '', exact: false }
const codes = {
  gps: await placeOrder(customer({ name: 'Ana GPS', phone: '83999990000', kind: 'entrega', street: 'Rua das Flores', number: '12A', zoneId: 'centro', reference: 'portão azul', gps: GPS }), { method: 'dinheiro', changeFor: '10', exact: false }, 600),
  retirada: await placeOrder(customer({ name: 'Bruno Retira', kind: 'retirada', street: 'Rua Que Não Vai', number: '9', gps: GPS }), PIX, 300),
  local: await placeOrder(customer({ name: 'Carla Local', kind: 'local' }), { method: 'credito', changeFor: '', exact: false }, 300),
  semGps: await placeOrder(customer({ name: 'Davi Sem GPS', kind: 'entrega', street: 'Av. Brasil', number: 'S/N', zoneId: 'centro' }), PIX, 600),
}
// Um pedido antigo (de antes de 2026-11-20): sem as colunas do GPS.
fake.db.orders.push({
  id: 'antigo-0099',
  number: 99,
  code: 'ADS-0099',
  attempt_key: 'a'.repeat(64),
  created_at: new Date(Date.now() - 60_000).toISOString(),
  status: 'preparando',
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
  // Som de mentira: conta os bipes (cada bipe tem 2 tons).
  window.__fakeAudio = () => {
    window.__tones = 0;
    class FakeAudio {
      constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      resume() { return Promise.resolve(); }
      createOscillator() { return { type: 'sine', frequency: { value: 0 }, connect: (node) => node, start: () => { window.__tones++ }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node) => node }; }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeAudio, configurable: true });
    return true;
  };
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9379)
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

try {
  const desktop = { width: 1280, height: 900 }
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); ${quiet}`)

  // --- Sem login ---
  await browser.goto(`${baseUrl}/pedidos`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-orders-notice]')`)
  check(
    'sem login: a página pede a senha e não mostra pedidos',
    await run(`[__text(__q('[data-orders-notice] h2')), !!__q('[data-orders-login]'), document.querySelectorAll('[data-order-card]').length, document.querySelector('meta[name="robots"]')?.content]`),
    ['Esta página é do Modo Vendedor', true, 0, 'noindex'],
  )
  await click(`__q('[data-orders-login]')`, 600)
  await run(`(() => { const el = __q('#senha-vendedor'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(SELLER_PASSWORD)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.form.requestSubmit(); return true })()`)
  check('login: o painel carrega os pedidos', await waitFor(`document.querySelectorAll('[data-order-card]').length >= 5`), true)
  await run(`__fakeAudio()`)
  // A faixa do vendedor carrega sob demanda depois do login.
  await waitFor(`__q('[data-orders-link]')`)
  check('botão "Pedidos" na faixa do vendedor', await run(`[__text(__q('[data-orders-link]')), new URL(__q('[data-orders-link]').href).pathname]`), ['Pedidos', '/pedidos'])
  check('pediu os pedidos do dia e os em andamento', fake.db.calls.some((call) => call.path === '/rest/v1/orders' && call.search.includes('or=') && call.search.includes('order=created_at.desc')), true)

  // --- Lista e cartões ---
  check('em andamento: os 4 novos e o antigo, os mais novos primeiro', await run(`__codes()`), [codes.semGps, codes.local, codes.retirada, codes.gps, 'ADS-0099'])
  check(
    'selos das modalidades (ícone e texto)',
    await run(`${JSON.stringify(Object.values(codes))}.map((code) => __text(__card(code).querySelector('[data-modality]')))`),
    ['Entrega', 'Retirar', 'Comer no Local', 'Entrega'],
  )
  check(
    'Comer no Local em dourado e roxo',
    await run(`(() => { const s = getComputedStyle(__card(${JSON.stringify(codes.local)}).querySelector('[data-modality]')); return [s.backgroundColor, s.color] })()`),
    ['rgb(250, 204, 21)', 'rgb(42, 8, 29)'],
  )
  check('pedido antigo aparece (Retirar, sem GPS)', await run(`[__text(__card('ADS-0099').querySelector('[data-modality]')), !!__card('ADS-0099').querySelector('[data-order-gps]'), __text(__card('ADS-0099').querySelector('[data-order-items]'))]`), ['Retirar', false, '1x Jujuba — R$ 1,00'])
  check(
    'entrega com GPS: endereço e "Abrir GPS no Mapa" com o link do pedido, em outra aba',
    await run(`(() => { const card = __card(${JSON.stringify(codes.gps)}); const a = card.querySelector('[data-order-gps]'); return [__text(card.querySelector('[data-order-address] p')), __text(a), a.href, a.target, a.rel] })()`),
    ['Rua das Flores, 12A — Centro', 'Abrir GPS no Mapa', 'https://www.google.com/maps?q=-7.220987,-37.254124', '_blank', 'noopener noreferrer'],
  )
  check('entrega sem GPS: endereço, sem botão de GPS', await run(`[!!__card(${JSON.stringify(codes.semGps)}).querySelector('[data-order-address]'), !!__card(${JSON.stringify(codes.semGps)}).querySelector('[data-order-gps]')]`), [true, false])
  check(
    'retirar e comer no local: sem endereço nem GPS (mesmo com rua e GPS mandados no pedido)',
    await run(`[${JSON.stringify(codes.retirada)}, ${JSON.stringify(codes.local)}].map((code) => [!!__card(code).querySelector('[data-order-address]'), !!__card(code).querySelector('[data-order-gps]'), __card(code).innerText.includes('Rua Que Não Vai')])`),
    [[false, false, false], [false, false, false]],
  )
  check(
    'itens como na comanda, com a observação',
    await run(`[...__card(${JSON.stringify(codes.gps)}).querySelectorAll('[data-order-items] li')].map((li) => li.textContent.trim()).filter(Boolean)`),
    ['1️⃣ 1x Jujuba — R$ 1,00', '2️⃣ 1x Água Mineral 500 ml — R$ 2,00', '📝 Observação: bem gelada'],
  )
  check(
    'valores e pagamento da entrega: frete do bairro, total e troco',
    await run(`[...__card(${JSON.stringify(codes.gps)}).querySelectorAll('dl > div')].map((row) => __text(row))`),
    ['Subtotal R$ 3,00', 'Frete (Centro) R$ 3,00', 'TOTAL R$ 6,00', 'Pagamento Dinheiro: troco para R$ 10,00 (levar R$ 4,00)'],
  )
  check(
    'comer no local: consumo grátis e cartão sem maquininha',
    await run(`[...__card(${JSON.stringify(codes.local)}).querySelectorAll('dl > div')].map((row) => __text(row))`),
    ['Subtotal R$ 3,00', 'Consumo no local Grátis', 'TOTAL R$ 3,00', 'Pagamento Cartão de crédito'],
  )
  check('cliente com o WhatsApp dele', await run(`__card(${JSON.stringify(codes.gps)}).querySelector('a[href^="https://wa.me/"]')?.href`), 'https://wa.me/5583999990000')
  check(
    'filtros com a contagem',
    await run(`[...document.querySelectorAll('[data-orders-filter]')].map((b) => __text(b))`),
    ['Em andamento 5', 'Novos 4', 'Confirmados 0', 'Preparando 1', 'Prontos 0', 'Saiu para entrega 0', 'Concluídos 0', 'Cancelados 0', 'Todos 5'],
  )
  check('título da aba com os pedidos novos', await run(`document.title`), '(4) Pedidos | Açaí Doce Sabor')
  await shot('1280-painel')

  // --- Situação: comer no local até concluir ---
  const local = JSON.stringify(codes.local)
  const steps = []
  for (const expected of ['confirmado', 'preparando', 'pronto', 'concluido']) {
    const label = await run(`__text(__card(${local})?.querySelector('[data-order-next]'))`)
    await click(`__card(${local}).querySelector('[data-order-next]')`, 700)
    steps.push([label, statusOf(codes.local)])
    if (expected === 'concluido') break
    steps.at(-1).push(await run(`__card(${local}).querySelector('[data-status-pill]').textContent.trim()`))
  }
  check(
    'comer no local: Confirmar → Preparando → Pronto → Concluído, gravado no banco',
    steps,
    [
      ['Confirmar', 'confirmado', 'Confirmado'],
      ['Preparando', 'preparando', 'Preparando'],
      ['Pronto', 'pronto', 'Pronto'],
      ['Concluído', 'concluido'],
    ],
  )
  check('concluído sai de "Em andamento" e aparece em "Concluídos"', await run(`!!__card(${local})`), false)
  await click(`__q('[data-orders-filter="concluido"]')`, 400)
  check('filtro Concluídos', await run(`__codes()`), [codes.local])
  await click(`__q('[data-orders-filter="andamento"]')`, 400)

  // --- Entrega: depois de pronto, "Saiu para entrega" ---
  const gps = JSON.stringify(codes.gps)
  for (let i = 0; i < 3; i++) await click(`__card(${gps}).querySelector('[data-order-next]')`, 700)
  check('entrega pronta: próximo passo "Saiu para entrega"', [statusOf(codes.gps), await run(`__text(__card(${gps}).querySelector('[data-order-next]'))`)], ['pronto', 'Saiu para entrega'])
  await click(`__card(${gps}).querySelector('[data-order-next]')`, 700)
  check('saiu para entrega gravado; depois, Concluído', [statusOf(codes.gps), await run(`__text(__card(${gps}).querySelector('[data-order-next]'))`)], ['saiu_para_entrega', 'Concluído'])

  // --- Cancelar com confirmação ---
  const pickup = JSON.stringify(codes.retirada)
  await click(`__card(${pickup}).querySelector('[data-order-cancel]')`, 300)
  check('cancelar pede confirmação no cartão', await run(`__text(__card(${pickup}).querySelector('[role="group"] p'))`), `Cancelar o pedido ${codes.retirada}?`)
  await click(`__card(${pickup}).querySelector('[data-order-cancel-back]')`, 300)
  check('"Não": nada muda', [statusOf(codes.retirada), await run(`!!__card(${pickup}).querySelector('[data-order-cancel]')`)], ['novo', true])
  await click(`__card(${pickup}).querySelector('[data-order-cancel]')`, 300)
  await click(`__card(${pickup}).querySelector('[data-order-cancel-confirm]')`, 700)
  check('"Sim, cancelar": cancelado no banco e fora de "Em andamento"', [statusOf(codes.retirada), await run(`!!__card(${pickup})`)], ['cancelado', false])

  // --- Erro ao gravar ---
  fake.state.failOrdersPatch = true
  const noGps = JSON.stringify(codes.semGps)
  await click(`__card(${noGps}).querySelector('[data-order-next]')`, 700)
  check(
    'erro ao gravar: aviso no cartão, situação mantida',
    [await run(`__text(__card(${noGps}).querySelector('[role="alert"]'))`), statusOf(codes.semGps), await run(`__card(${noGps}).querySelector('[data-status-pill]').textContent.trim()`)],
    ['Não foi possível mudar a situação. Confira a internet e tente de novo.', 'novo', 'Novo'],
  )
  fake.state.failOrdersPatch = false

  // --- Pedido novo pela atualização automática ---
  const arrived = await placeOrder(customer({ name: 'Eva Nova', kind: 'local' }), PIX, 300)
  check('pedido novo aparece sozinho (atualização a cada 15 s)', await waitFor(`__card(${JSON.stringify(arrived)})`, 20_000), true)
  check(
    'aviso do pedido novo: bipe duplo, anúncio e título da aba',
    await run(`[window.__tones, __text(__q('[data-orders-announcement]')), document.title]`),
    // "Novos" agora: o sem GPS (a mudança dele falhou) e o que acabou de chegar.
    [2, `Novo pedido: ${arrived} (Comer no Local).`, '(2) Pedidos | Açaí Doce Sabor'],
  )
  await click(`__q('[data-orders-sound]')`, 300)
  check('som desligado pelo botão (fica guardado no aparelho)', await run(`[__q('[data-orders-sound]').dataset.ordersSound, localStorage.getItem('acai_doce_sabor_pedidos_som_v1')]`), ['desligado', '0'])
  await click(`__q('[data-orders-sound]')`, 300)
  await click(`__q('[data-orders-filter="todos"]')`, 400)
  check('filtro Todos', (await run(`__codes()`)).length, 6)
  await click(`__q('[data-orders-filter="cancelado"]')`, 400)
  check('filtro Cancelados', await run(`__codes()`), [codes.retirada])
  check('computador: sem rolagem lateral', await run(`__noOverflow()`), true)

  // --- Celulares ---
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await browser.goto(`${baseUrl}/pedidos`, viewport)
    await run(quiet)
    check(`${viewport.width} px: painel abre com a sessão guardada`, await waitFor(`document.querySelectorAll('[data-order-card]').length >= 3`), true)
    check(`${viewport.width} px: sem rolagem lateral`, await run(`__noOverflow()`), true)
    check(
      `${viewport.width} px: rótulo e valor do pagamento sem se sobrepor`,
      await run(`[...document.querySelectorAll('[data-order-card] dl > div:last-child')].every((row) => { const [dt, dd] = row.children; const label = document.createRange(); label.selectNodeContents(dt); return label.getBoundingClientRect().right <= dd.getBoundingClientRect().left + 0.5 })`),
      true,
    )
    await shot(`${viewport.width}-painel`)
  }

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
