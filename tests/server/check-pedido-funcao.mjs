// Confere o arquivo da função "pedido" que se cola no Supabase (supabase/functions/pedido/index.ts),
// pedido de 2026-11-17:
// - o arquivo está atualizado com o código (gerado de novo e comparado);
// - rodando com um Deno e um Supabase de mentira (tests/browser/fake-supabase.mjs), por HTTP:
//   pré-verificação do navegador, pedido gravado com ADS-0001, repetido sem duplicar, total errado,
//   esgotado, loja fechada com bloqueio, chave antiga e falta de configuração.
//
// Uso: node tests/server/check-pedido-funcao.mjs
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { PUBLIC_KEY, SERVER_KEY, seedCatalog, startFakeSupabase } from '../browser/fake-supabase.mjs'

const failures = []
let checks = 0
function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

// --- O arquivo colado no Supabase é o do código atual ---
const BUNDLE = join(process.cwd(), 'supabase', 'functions', 'pedido', 'index.ts')
const temp = mkdtempSync(join(tmpdir(), 'pedido-'))
try {
  await build({ configFile: join(process.cwd(), 'vite.pedido.config.ts'), logLevel: 'silent', build: { outDir: temp } })
  check(
    'arquivo da função atualizado (se falhar: rode npm run build:pedido)',
    readFileSync(join(temp, 'index.ts'), 'utf8') === readFileSync(BUNDLE, 'utf8'),
    true,
  )
} finally {
  rmSync(temp, { recursive: true, force: true })
}

const fake = await startFakeSupabase()
const endpoint = `${fake.url}/functions/v1/pedido`
const call = async (body, init = {}) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUBLIC_KEY },
    body: JSON.stringify(body),
    ...init,
  })
  return { status: response.status, body: await response.json().catch(() => null), cors: response.headers.get('access-control-allow-origin') }
}

/** Loja aberta pelo interruptor (a conferência roda a qualquer hora do dia). */
const OPEN_NOW = { kind: 'settings', id: 'loja', data: { override: { state: 'open', until: Date.now() + 3_600_000 } } }
/** Jujuba (R$ 1,00) e 2 águas (R$ 2,00 cada): R$ 5,00. */
const cart = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 2, note: 'bem gelada' },
  ],
})
const customer = { name: 'Cliente Teste', phone: '', kind: 'retirada', street: '', number: '', district: '', zoneId: null, reference: '' }
const order = (patch = {}) => ({ cart, customer, payment: { method: 'pix', changeFor: '', exact: false }, expectedTotalCents: 500, ...patch })

try {
  fake.db.changes.push(OPEN_NOW)

  const preflight = await fetch(endpoint, { method: 'OPTIONS' })
  check('pré-verificação do navegador: 204 com CORS', [preflight.status, preflight.headers.get('access-control-allow-origin')], [204, '*'])

  const first = await call(order())
  check('pedido certo: ADS-0001, com CORS', [first.status, first.body?.ok, first.body?.code, first.body?.totalCents, first.body?.whatsapp, first.cors], [
    200,
    true,
    'ADS-0001',
    500,
    '5583996999980',
    '*',
  ])
  const lines = (first.body?.message ?? '').split('\n')
  check('comanda do servidor com o código, os itens e a observação', [lines[1], lines.includes('2️⃣ *2x Água Mineral 500 ml* — *R$ 4,00*'), lines.includes('   📝 *Observação:* bem gelada')], [
    '🔖 *Pedido:* ADS-0001',
    true,
    true,
  ])
  check(
    'gravado no banco com a chave de servidor (só no apikey) e os dados do pedido',
    [fake.db.orders.length, fake.db.orders[0]?.customer_name, fake.db.orders[0]?.total_cents, fake.db.orders[0]?.status, fake.db.orders[0]?.items?.[1]?.note],
    [1, 'Cliente Teste', 500, 'novo', 'bem gelada'],
  )
  const serverCalls = fake.db.calls.filter((entry) => entry.path.startsWith('/rest/v1/orders') || entry.path.startsWith('/rest/v1/rpc'))
  check('a função usa a chave de servidor, sem Bearer (chave nova)', [serverCalls.every((entry) => entry.apikey === SERVER_KEY), serverCalls.some((entry) => entry.authorization)], [true, false])

  const again = await call(order())
  check('o mesmo pedido de novo: mesmo código, sem gravar outro', [again.body?.code, again.body?.repeated, fake.db.orders.length], ['ADS-0001', true, 1])

  // Pedido novo (outra pessoa) com o total errado. O mesmo pedido já gravado volta com o código dele.
  const wrongTotal = await call(order({ expectedTotalCents: 100, customer: { ...customer, name: 'Total Errado' } }))
  check('total diferente: recusa com o total certo, sem gravar', [wrongTotal.body, fake.db.orders.length], [{ ok: false, reason: 'total-mudou', totalCents: 500, items: [{ name: 'Jujuba', quantity: 1, totalCents: 100 }, { name: 'Água Mineral 500 ml', quantity: 2, totalCents: 400 }] }, 1])
  const sameAgain = await call(order({ expectedTotalCents: 100 }))
  check('pedido já gravado, mandado de novo com outro total: volta o gravado', [sameAgain.body?.code, sameAgain.body?.repeated], ['ADS-0001', true])

  const cash = await call(order({ payment: { method: 'dinheiro', changeFor: '', exact: true } }))
  check('pedido mudado (outro pagamento): ADS-0002', [cash.body?.code, fake.db.orders.length], ['ADS-0002', 2])

  // Esgotado pelo vendedor no painel: o cardápio do banco (catalogo_publico, 2026-11-21).
  const soldOutCatalog = seedCatalog()
  soldOutCatalog.products = soldOutCatalog.products.map((product) => (product.id === 'jujuba' ? { ...product, available: false } : product))
  fake.setCatalog(soldOutCatalog)
  const soldOut = await call(order({ payment: { method: 'credito', changeFor: '', exact: false } }))
  check('item esgotado no banco: recusa com o nome', soldOut.body, { ok: false, reason: 'esgotado', detail: 'Jujuba' })
  fake.setCatalog(seedCatalog())

  fake.db.changes.splice(0, fake.db.changes.length, {
    kind: 'settings',
    id: 'loja',
    data: { closedOrders: 'bloquear', override: { state: 'closed', until: Date.now() + 3_600_000 } },
  })
  const closed = await call(order({ payment: { method: 'debito', changeFor: '', exact: false } }))
  check('loja fechada com bloqueio: recusa', closed.body?.reason, 'loja-fechada')
  fake.db.changes.splice(0, fake.db.changes.length, OPEN_NOW)

  check('corpo que não é JSON: 400', (await call(undefined, { body: '{nada' })).status, 400)

  // Chave antiga (service_role, um JWT): vai também como Bearer.
  delete fake.env.SUPABASE_SECRET_KEYS
  fake.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJchave-antiga'
  const before = fake.db.calls.length
  const legacy = await call(order({ payment: { method: 'pix', changeFor: '', exact: false }, customer: { ...customer, name: 'Outra Pessoa' } }))
  const legacyCalls = fake.db.calls.slice(before).filter((entry) => entry.path.startsWith('/rest/v1/'))
  check('chave antiga: apikey e Bearer (o Supabase de mentira recusa a chave, a função responde 500)', [legacy.status, legacyCalls[0]?.authorization], [500, 'Bearer eyJchave-antiga'])

  // Sem configuração: 500, e o site oferece o envio sem registro.
  delete fake.env.SUPABASE_SERVICE_ROLE_KEY
  check('função sem a chave de servidor: 500', (await call(order())).status, 500)
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  await fake.close()
}

console.log(`${checks} conferências`)
if (failures.length > 0) {
  console.log(`FALHAS (${failures.length}):`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
