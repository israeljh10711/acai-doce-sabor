// Confere no navegador a finalização do pedido pelo site (pedido de 2026-11-17, opção A; desde
// 2026-11-20, 100% no site, sem WhatsApp), sem um Supabase de verdade: sobe o Supabase de mentira
// (tests/browser/fake-supabase.mjs, com a função "pedido" gerada) e um segundo site na porta 5175
// ligado a ele. O site da porta 5173 não muda.
// - "Finalizar pedido": a sessão anônima é criada, o pedido é gravado ligado a ela e o site vai para
//   o acompanhamento com "✅ Pedido recebido com sucesso!"; nenhum WhatsApp abre; o carrinho esvazia;
// - o token vai só no Authorization (nunca na URL) e o aparelho guarda só id, código e situação;
// - o mesmo carrinho finalizado de novo é outro pedido; toque duplo grava um só;
// - preço mudado no banco: "Os preços mudaram" e nada gravado; finalizar de novo grava;
// - resposta perdida (o servidor gravou, o site não soube): aviso, e "Tentar de novo" mostra o mesmo
//   pedido, sem gravar outro; servidor fora do ar: aviso e "Tentar de novo", nada de WhatsApp;
// - esgotado e loja fechada no banco: o motivo, e o carrinho mostra o que mudou;
// - Comer no Local e entrega com GPS: a modalidade, o frete, as coordenadas e o link gravados;
// - login anônimo desligado no Supabase: o pedido é gravado, sem acompanhamento ao vivo (avisado);
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
  window.__finalize = () => __q('[data-finalize]');
  window.__set = (el, text) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  };
  // GPS e Nominatim de mentira (pedido de 2026-11-20): nunca o GPS do computador nem a internet.
  window.__fakeGps = () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (success) => setTimeout(() => success({ coords: { latitude: -7.2209871234, longitude: -37.2541239876 }, timestamp: Date.now() }), 50) },
    });
    const realFetch = window.fetch;
    window.fetch = (input, init) =>
      String(input).startsWith('https://nominatim.openstreetmap.org/')
        ? Promise.resolve(new Response(JSON.stringify({ address: { road: 'Rua Francisco Tota', suburb: 'Centro' } }), { status: 200 }))
        : realFetch(input, init);
    return true;
  };
  // Nenhuma aba deve abrir: o window.open de mentira só conta.
  window.__stubTabs = () => {
    if (window.__tabsStubbed) return true;
    window.__tabsStubbed = true;
    window.__tabs = [];
    window.open = (url) => { window.__tabs.push(url ?? ''); return null };
    return true;
  };
  window.__values = () => __q('[data-order-values]')?.innerText.replace(/\\s+/g, ' ') ?? '';
  window.__cartItems = () => JSON.parse(localStorage.getItem('acai-doce-sabor:carrinho') ?? '{"items":[]}').items.length;
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
const finalize = () => click(`__finalize()`, 300)
/** Chegou ao acompanhamento do pedido com o recado de sucesso. */
const placed = (code) => waitFor(`location.pathname === '/acompanhar/${code}' && __q('[data-order-success="pedido"]')?.textContent.includes('✅ Pedido recebido com sucesso!')`)

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
/** Abre o carrinho com os dois itens (o carrinho esvazia a cada pedido confirmado). */
const openCart = async (viewport) => {
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); ${quiet}`)
  await browser.goto(`${baseUrl}/carrinho`, viewport)
  await run(quiet)
  await waitFor(`__q('[data-order-values]')`)
  await run(`__stubTabs()`)
}
/** Nome (fica guardado na aba), retirada e Pix. */
const fillRetirada = async (who) => {
  await name(who)
  await click(`__q('input[type="radio"][value="retirada"]')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
}
const functionCalls = () => fake.db.calls.filter((call) => call.path === '/functions/v1/pedido')

try {
  const desktop = { width: 1280, height: 900 }
  fake.db.changes.push(OPEN_NOW)
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); ${quiet}`)
  await openCart(desktop)
  check(
    'carrinho no site ligado ao Supabase: R$ 3,00, "Finalizar pedido" e o aviso de que vai direto para a loja',
    await run(`[__values(), __finalize()?.textContent.trim(), __q('[data-finalize-hint]')?.textContent.includes('O pedido vai direto para a loja, sem sair do site')]`),
    ['Subtotal R$ 3,00 Entrega escolha abaixo TOTAL R$ 3,00', 'Finalizar pedido', true],
  )

  // --- Finalizado ---
  await fillRetirada('Cliente Teste')
  await finalize()
  check('vai para /acompanhar/ADS-0001 com "✅ Pedido recebido com sucesso!"', await placed('ADS-0001'), true)
  check('nenhum WhatsApp aberto e o carrinho esvaziou', await run(`[__tabs.length, __cartItems()]`), [0, 0])
  const session = await run(`JSON.parse(localStorage.getItem('acai_doce_sabor_cliente_sessao_v1'))`)
  const first = fake.db.orders[0]
  check(
    'gravado uma vez, ligado à sessão anônima criada agora',
    [fake.db.orders.length, first?.customer_name, first?.total_cents, first?.customer_user_id === session?.userId, fake.db.customers.size],
    [1, 'Cliente Teste', 300, true, 1],
  )
  check(
    'a função recebe o token da sessão no Authorization, e ele nunca vai na URL',
    [functionCalls().at(-1)?.authorization === `Bearer ${session?.accessToken}`, fake.db.calls.some((call) => call.search.includes(String(session?.accessToken)))],
    [true, false],
  )
  check(
    'o aparelho guarda só id, código, data, situação e modalidade do pedido (sem token, nome ou telefone)',
    await run(`(() => { const list = JSON.parse(localStorage.getItem('acai_doce_sabor_meus_pedidos_v1')); return [list.length, Object.keys(list[0]).sort().join(','), JSON.stringify(list).includes('Cliente Teste')] })()`),
    [1, 'code,createdAt,demo,fulfillment,id,status,tracked', false],
  )
  check('linha do tempo: "Pedido recebido" agora, o resto ainda não', await waitFor(`__q('[data-step="recebido"]')?.dataset.stepState === 'current' && __q('[data-step="fim"]')?.dataset.stepState === 'pending'`), true)
  check('ao vivo: inscrição no Realtime de order_events filtrada pela sessão', await waitFor(`__q('[data-live="live"]')`), true)
  check(
    'a inscrição do cliente usa o token dele e o filtro customer_user_id',
    fake.realtime.customerSubscriptions().map((sub) => [sub.token === session.accessToken, sub.filters[0]?.table, sub.filters[0]?.filter]),
    [[true, 'order_events', `customer_user_id=eq.${session.userId}`]],
  )
  check(
    'resumo: os itens, Retirar, o total e o Pix',
    await run(`(() => { const s = __q('[data-order-summary]').innerText; return [s.includes('Jujuba'), s.includes('Água Mineral 500 ml'), !!__q('[data-order-summary] [data-modality="retirada"]'), __q('[data-order-total]').textContent, __q('[data-order-payment]').textContent] })()`),
    [true, true, true, 'R$ 3,00', '💠 Pix'],
  )
  check('"💬 Dúvidas? Falar no WhatsApp" é só um link (abre a conversa só se o cliente tocar)', await run(`(() => { const a = __q('[data-support-whatsapp]'); const u = new URL(a.href); return [a.tagName, u.origin + u.pathname, u.searchParams.get('text')] })()`), [
    'A',
    'https://wa.me/5583996999980',
    'Olá! Tenho uma dúvida sobre o pedido #ADS-0001.',
  ])

  // --- Recarregar: o recado não repete, o pedido continua ---
  await browser.goto(`${baseUrl}/acompanhar/ADS-0001`, desktop)
  check('recarregar: sem o recado de novo, com a linha do tempo', [await waitFor(`__q('[data-tracking-timeline]')`), await run(`!!__q('[data-order-success]')`)], [true, false])

  // --- O mesmo carrinho de novo é outro pedido (a tentativa anterior foi confirmada) ---
  await openCart(desktop)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await finalize()
  check(
    'o mesmo carrinho finalizado de novo: ADS-0002, a mesma sessão (sem criar outra)',
    [await placed('ADS-0002'), fake.db.orders.length, fake.db.orders[1]?.customer_user_id === session.userId, fake.db.customers.size],
    [true, 2, true, 1],
  )

  // --- Toque duplo no botão: um registro só ---
  await openCart(desktop)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await run(`(() => { const button = __finalize(); button.click(); button.click(); return true })()`)
  check('toque duplo: grava uma vez (ADS-0003)', [await placed('ADS-0003'), fake.db.orders.length], [true, 3])

  // --- Preço mudado no banco (o site ainda mostra o antigo) ---
  await openCart(desktop)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  fake.db.changes.push({ kind: 'items', id: 'jujuba', data: { priceCents: 150 } })
  await finalize()
  check(
    '"Os preços mudaram": o total certo, nada gravado, e o site continua no carrinho',
    [await waitFor(`__q('[data-order-rejected]')?.textContent.includes('Os preços mudaram: o total agora é R$ 3,50')`), fake.db.orders.length, await run(`location.pathname`)],
    [true, 3, '/carrinho'],
  )
  check('o carrinho relê o cardápio e mostra o total novo', await waitFor(`__values().includes('TOTAL R$ 3,50')`), true)
  await finalize()
  check('finalizar de novo com o total novo grava ADS-0004', await placed('ADS-0004'), true)

  // --- Resposta perdida: o servidor gravou, mas o site não recebeu a resposta ---
  await openCart(desktop)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  fake.state.loseReply = true
  await finalize()
  check(
    'resposta perdida: "Não foi possível confirmar o pedido agora", sem confirmação falsa, carrinho intacto',
    [await waitFor(`__q('[data-order-failed]')?.textContent.includes('Não foi possível confirmar o pedido agora.')`), await run(`[location.pathname, !!__q('[data-order-success]'), __cartItems()]`), fake.db.orders.length],
    [true, ['/carrinho', false, 2], 5],
  )
  check('sem "Enviar pelo WhatsApp" na falha: só "Tentar de novo"', await run(`[!!__q('[data-order-retry]'), document.body.textContent.includes('Enviar mesmo assim')]`), [true, false])
  fake.state.loseReply = false
  await click(`__q('[data-order-retry]')`, 300)
  check('"Tentar de novo" mostra o pedido que já tinha sido gravado (ADS-0005), sem gravar outro', [await placed('ADS-0005'), fake.db.orders.length], [true, 5])

  // --- Servidor fora do ar ---
  await openCart(desktop)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  fake.state.failFunction = true
  await finalize()
  check(
    'servidor fora: aviso e "Tentar de novo", nada gravado, nenhuma aba aberta',
    [await waitFor(`__q('[data-order-failed]')`), fake.db.orders.length, await run(`__tabs.length`)],
    [true, 5, 0],
  )
  fake.state.failFunction = false
  await click(`__q('[data-order-retry]')`, 300)
  check('servidor de volta: "Tentar de novo" grava ADS-0006', await placed('ADS-0006'), true)

  // --- Esgotado e loja fechada no banco ---
  await openCart(desktop)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  fake.db.changes.push({ kind: 'items', id: 'agua-mineral-500-ml', data: { available: false } })
  await finalize()
  check('esgotado no banco: "Esgotou: Água Mineral 500 ml"', await waitFor(`__q('[data-order-rejected]')?.textContent.includes('Esgotou: Água Mineral 500 ml')`), true)
  check('o carrinho relê e marca a água como esgotada', await waitFor(`__q('[data-cart-problem]')?.textContent.includes('Esgotado')`), true)
  fake.db.changes.pop()

  fake.db.changes.splice(0, fake.db.changes.length, { kind: 'settings', id: 'loja', data: { closedOrders: 'bloquear', override: { state: 'closed', until: Date.now() + 3_600_000 } } })
  await openCart(desktop)
  // O site leu "fechada" ao abrir: o botão já vem bloqueado, e nada vai para o servidor.
  check('loja fechada com bloqueio: botão desligado no site', await run(`[__finalize()?.disabled, __finalize()?.textContent.trim()]`), [true, 'Loja fechada: pedidos bloqueados'])
  fake.db.changes.splice(0, fake.db.changes.length, OPEN_NOW)

  // --- Comer no Local e entrega com GPS gravados pela função (pedido de 2026-11-20) ---
  const zones = { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }] }
  fake.db.changes.splice(0, fake.db.changes.length, { ...OPEN_NOW, data: { ...OPEN_NOW.data, delivery: zones } })
  await openCart(desktop)
  await name('Cliente Local')
  await click(`__q('input[type="radio"][value="local"]')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await finalize()
  await placed('ADS-0007')
  const local = fake.db.orders.at(-1)
  check(
    'comer no local gravado: modalidade "local", frete zero, sem endereço nem GPS',
    [local.customer_name, local.fulfillment, local.delivery_fee, local.delivery_fee_cents, local.address, local.customer_lat, local.customer_lng, local.maps_url, local.total_cents],
    ['Cliente Local', 'local', 'local', 0, null, null, null, null, 300],
  )
  const localText = local.message.split('\n')
  check(
    'comanda gravada pelo servidor: comer no local, com o código',
    [localText[1], localText.includes('• *Modalidade:* 🍨 COMER NO LOCAL (Deixar pronto para chegada)'), localText.includes('🍨 *Consumo no local:* Grátis (R$ 0,00)')],
    [`🔖 *Pedido:* ${local.code}`, true, true],
  )
  check('acompanhamento de Comer no Local: o "pronto" certo na linha do tempo', await waitFor(`__q('[data-step="pronto"]')?.textContent.includes('🍨 Seu pedido está pronto para consumo')`), true)

  await openCart(desktop)
  await run(`__fakeGps()`)
  await name('Cliente GPS')
  await click(`__q('input[type="radio"][value="entrega"]')`)
  await run(`__set(__q('[data-field="number"]'), '12')`)
  await run(`__set(__q('[data-field="zone"]'), 'centro')`)
  await click(`__q('[data-gps-capture]')`, 600)
  await waitFor(`__q('[data-gps="anexado"]') && __q('[data-field="street"]').value`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await finalize()
  await placed('ADS-0008')
  const delivered = fake.db.orders.at(-1)
  check(
    'entrega com GPS gravada: coordenadas, link, frete do bairro e a rua sugerida pelo GPS',
    [delivered.customer_name, delivered.fulfillment, delivered.delivery_fee, delivered.delivery_fee_cents, delivered.address, delivered.customer_lat, delivered.customer_lng, delivered.maps_url, delivered.total_cents],
    ['Cliente GPS', 'entrega', 'taxa', 300, { street: 'Rua Francisco Tota', number: '12', district: 'Centro', reference: null }, -7.220987, -37.254124, 'https://www.google.com/maps?q=-7.220987,-37.254124', 600],
  )
  check('a comanda gravada leva o mesmo link do GPS', delivered.message.split('\n').includes(`• *Localização GPS:* ${delivered.maps_url}`), true)
  check(
    'o cliente vê o endereço e a entrega, mas nunca o GPS nem o telefone',
    await run(`(() => { const s = __q('[data-order-summary]').innerText; return [s.includes('Rua Francisco Tota, 12'), s.includes('Frete (Centro)'), s.includes('-7.22'), s.includes('google.com/maps')] })()`),
    [true, true, false, false],
  )
  fake.db.changes.splice(0, fake.db.changes.length, OPEN_NOW)

  // --- Login anônimo desligado no Supabase: o pedido é gravado, sem acompanhamento ao vivo ---
  fake.state.anonymousSignIn = false
  await run(`localStorage.removeItem('acai_doce_sabor_cliente_sessao_v1'); true`)
  await openCart(desktop)
  await name('Cliente Sem Sessão')
  await click(`__q('input[type="radio"][value="retirada"]')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await finalize()
  check(
    'sem a sessão anônima: o pedido é gravado e a tela avisa que não há acompanhamento ao vivo',
    [await placed('ADS-0009'), await waitFor(`__q('[data-tracking-untracked]')`), fake.db.orders.at(-1)?.customer_user_id],
    [true, true, null],
  )
  fake.state.anonymousSignIn = true

  // --- Celular ---
  await openCart({ width: 390, height: 844 })
  await click(`__q('input[type="radio"][value="retirada"]')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await finalize()
  check('celular: confirmado e sem rolagem lateral no acompanhamento', [await placed('ADS-0010'), await run(`document.documentElement.scrollWidth`)], [true, 390])

  // O 503 da função fora do ar e o 422 do login anônimo desligado aparecem no console (esperado); o resto, não.
  const problems = browser.consoleProblems().filter((problem) => !/503|Service Unavailable|422/i.test(String(problem)))
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
