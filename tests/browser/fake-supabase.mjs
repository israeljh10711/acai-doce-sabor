// Supabase de mentira, para conferir o registro dos pedidos sem um projeto de verdade (pedido de
// 2026-11-17). Roda na própria máquina:
// - um banco na memória com as rotas da API REST que o site e a função usam (catalog_changes,
//   orders e a função proximo_numero_pedido), com as mesmas regras de acesso do SQL: o site lê o
//   cardápio com a chave pública; só a chave de servidor lê e grava pedidos;
// - o login do vendedor e o painel de pedidos (2026-11-20): o vendedor lê os pedidos e muda só a
//   situação, como no SQL; e o Realtime (fake-realtime.mjs) avisa as mudanças em orders na hora;
// - a função "pedido" de verdade: o arquivo gerado supabase/functions/pedido/index.ts (o mesmo que
//   se cola no painel), carregado com um "Deno" de mentira;
// - o acompanhamento do cliente (2026-11-20): a sessão anônima (signup, renovação e /auth/v1/user),
//   o histórico order_events com o gatilho, a função adicionar_itens_pedido e o Realtime de
//   order_events só para o dono (como o RLS);
// - o cardápio do banco (cardápio dinâmico, 2026-11-21): catalogo_publico() com o RLS (o visitante
//   recebe só o visível e não arquivado; o vendedor e a chave de servidor recebem tudo), começando
//   pela semente tirada do cardápio do código; `fake.setCatalog` troca o cardápio e avisa o Realtime
//   de catalog_meta.
//
// Uso: const fake = await startFakeSupabase({ port }); ... fake.db.changes.push(...); fake.close()
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { attachFakeRealtime } from './fake-realtime.mjs'

const { baseCatalogRecords } = await import(pathToFileURL(join(process.cwd(), 'src', 'features', 'catalog', 'baseRecords.ts')).href)
const { recordsToDatabase } = await import(pathToFileURL(join(process.cwd(), 'src', 'services', 'catalogRepository.ts')).href)

/** O cardápio da semente, no formato de catalogo_publico() (uma cópia nova a cada banco). */
export const seedCatalog = () => JSON.parse(JSON.stringify(recordsToDatabase(baseCatalogRecords())))

/** catalogo_publico() com o RLS de quem chama: o visitante só vê o público. */
export function catalogFor(catalog, everything) {
  if (everything) return catalog
  const categories = catalog.categories.filter((category) => category.visible && category.archived_at === null)
  const visibleCategory = new Set(categories.map((category) => category.id))
  const products = catalog.products.filter((product) => product.visible && product.archived_at === null && visibleCategory.has(product.category_id))
  const visibleProduct = new Set(products.map((product) => product.id))
  const ofProduct = (rows) => rows.filter((row) => visibleProduct.has(row.product_id))
  return {
    ...catalog,
    categories,
    products,
    variants: ofProduct(catalog.variants),
    choices: ofProduct(catalog.choices),
    choice_options: ofProduct(catalog.choice_options),
    product_groups: ofProduct(catalog.product_groups),
    options: catalog.options.filter((option) => option.archived_at === null),
    offers: ofProduct(catalog.offers).filter((offer) => offer.status === 'ativa' && (!offer.ends_at || Date.parse(offer.ends_at) > Date.now())),
  }
}

export const PUBLIC_KEY = 'sb_publishable_teste'
export const SERVER_KEY = 'sb_secret_teste'
/** Login do vendedor (painel de pedidos, 2026-11-20): a senha e o token que o "Auth" devolve. */
export const SELLER_PASSWORD = 'senha-teste'
export const SELLER_TOKEN = 'token-do-vendedor-teste'
const ORDER_STATUSES = ['novo', 'confirmado', 'preparando', 'pronto', 'pronto_retirada', 'pronto_consumo', 'saiu_para_entrega', 'concluido', 'cancelado']
/** A situação que só vale numa modalidade (orders_status_modalidade_check, 2026-11-20). */
const STATUS_ONLY_FOR = { saiu_para_entrega: 'entrega', pronto_retirada: 'retirada', pronto_consumo: 'local' }
const BUNDLE = join(process.cwd(), 'supabase', 'functions', 'pedido', 'index.ts')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer, accept-profile, content-profile',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

export function createFakeDatabase() {
  return { changes: [], orders: [], events: [], sequence: 0, eventSequence: 0, calls: [], customers: new Map(), refreshTokens: new Map(), catalog: seedCatalog() }
}

const pick = (row, columns) => (columns.length === 0 || columns[0] === '' || columns[0] === '*' ? row : Object.fromEntries(columns.map((column) => [column, row[column]])))

/** Filtros simples do PostgREST que a função usa: `coluna=eq.valor` e `coluna=gte.valor`. */
function matchesFilters(row, params) {
  for (const [name, raw] of params) {
    if (['select', 'order', 'limit', 'or', 'on_conflict'].includes(name)) continue
    const dot = raw.indexOf('.')
    const op = raw.slice(0, dot)
    const value = raw.slice(dot + 1)
    const actual = row[name] === null || row[name] === undefined ? null : String(row[name])
    if (op === 'eq' && actual !== value) return false
    if (op === 'gte' && (actual === null || actual < value)) return false
  }
  return true
}

/** O id do usuário dono do token (a sessão anônima do cliente ou o vendedor); token inválido: null. */
export function tokenUser(db, token) {
  if (!token) return null
  if (token === SELLER_TOKEN) return 'vendedor-teste'
  return db.customers.get(token) ?? null
}

/** O gatilho registrar_evento_pedido (e o lote de itens da função SQL): um evento no histórico. */
function addEvent(db, order, kind, source) {
  db.eventSequence += 1
  const event = { id: db.eventSequence, order_id: order.id, customer_user_id: order.customer_user_id ?? null, kind, status: order.status, source, created_at: new Date().toISOString() }
  db.events.push(event)
  db.onEvent?.(event)
  return event
}

/** A função SQL adicionar_itens_pedido (20261120200000_acompanhamento_cliente.sql), na memória. */
function addItemsRpc(db, args) {
  const { p_order_id, p_customer_user_id, p_attempt_key, p_batch, p_subtotal_cents, p_change_for_cents, p_change_set } = args
  if (!(p_subtotal_cents > 0) || String(p_attempt_key ?? '').length !== 64 || typeof p_batch !== 'object' || p_batch === null || Array.isArray(p_batch)) {
    return { ok: false, reason: 'pedido-invalido' }
  }
  const order = db.orders.find((candidate) => candidate.id === p_order_id)
  if (!order || !order.customer_user_id || order.customer_user_id !== p_customer_user_id) return { ok: false, reason: 'nao-encontrado' }
  if ((order.additions ?? []).some((batch) => batch.attempt_key === p_attempt_key)) {
    return { ok: true, repeated: true, subtotal_cents: order.subtotal_cents, total_cents: order.total_cents, change_for_cents: order.change_for_cents }
  }
  if (!['novo', 'preparando'].includes(order.status)) return { ok: false, reason: 'situacao', status: order.status }
  const total = order.total_cents + p_subtotal_cents
  const change = order.payment_method === 'dinheiro' && p_change_set ? p_change_for_cents : order.change_for_cents
  if (order.payment_method === 'dinheiro' && change !== null && change !== undefined && change < total) return { ok: false, reason: 'troco', total_cents: total }
  const at = new Date().toISOString()
  order.additions = [...(order.additions ?? []), { ...p_batch, attempt_key: p_attempt_key, created_at: at, subtotal_cents: p_subtotal_cents }]
  order.subtotal_cents += p_subtotal_cents
  order.total_cents = total
  if (order.payment_method === 'dinheiro') order.change_for_cents = change
  order.updated_at = at
  db.onChange?.('UPDATE', order)
  addEvent(db, order, 'itens', 'cliente')
  return { ok: true, repeated: false, subtotal_cents: order.subtotal_cents, total_cents: total, change_for_cents: change ?? null }
}

/** As rotas REST que o site e a função usam, com as regras de acesso do SQL. */
function rest(db, method, url, headers, body, state = {}) {
  const key = headers.apikey
  if (!key) return { status: 401, body: { message: 'No API key found in request' } }
  if (key !== PUBLIC_KEY && key !== SERVER_KEY) return { status: 401, body: { message: 'Invalid API key' } }
  const server = key === SERVER_KEY
  const bearer = (headers.authorization ?? '').replace(/^Bearer /, '')
  // O vendedor logado: chave pública no apikey e o token dele no Authorization.
  const seller = bearer === SELLER_TOKEN
  const select = (url.searchParams.get('select') ?? '').split(',')

  // Sessão anônima do cliente (2026-11-20): só com "Allow anonymous sign-ins" ligado.
  if (url.pathname === '/auth/v1/signup' && method === 'POST') {
    if (!state.anonymousSignIn) return { status: 422, body: { code: 'anonymous_provider_disabled', msg: 'Anonymous sign-ins are disabled' } }
    const id = randomUUID()
    const access = `cliente-${randomUUID()}`
    const refresh = `renovar-${randomUUID()}`
    db.customers.set(access, id)
    db.refreshTokens.set(refresh, id)
    return { status: 200, body: { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id, is_anonymous: true } } }
  }
  if (url.pathname === '/functions/v1/conta' && method === 'POST') {
    const data = JSON.parse(body || '{}')
    if (data.action !== 'seller' || data.password !== SELLER_PASSWORD) return { status: 401, body: { message: 'Identificador ou senha incorretos.' } }
    return { status: 200, body: { access_token: SELLER_TOKEN, refresh_token: 'refresh-teste', expires_in: 3600, token_type: 'bearer' } }
  }
  if (url.pathname === '/auth/v1/token' && method === 'POST') {
    const data = JSON.parse(body || '{}')
    const grant = url.searchParams.get('grant_type')
    if (grant === 'refresh_token' && db.refreshTokens.has(data.refresh_token)) {
      const id = db.refreshTokens.get(data.refresh_token)
      const access = `cliente-${randomUUID()}`
      db.customers.set(access, id)
      return { status: 200, body: { access_token: access, refresh_token: data.refresh_token, expires_in: 3600, token_type: 'bearer', user: { id, is_anonymous: true } } }
    }
    const valid = grant === 'refresh_token' ? data.refresh_token === 'refresh-teste' : data.password === SELLER_PASSWORD
    if (!valid) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } }
    return { status: 200, body: { access_token: SELLER_TOKEN, refresh_token: 'refresh-teste', expires_in: 3600, token_type: 'bearer' } }
  }
  if (url.pathname === '/auth/v1/user' && method === 'GET') {
    const id = tokenUser(db, bearer)
    return id ? { status: 200, body: { id, is_anonymous: id !== 'vendedor-teste' } } : { status: 401, body: { message: 'invalid JWT' } }
  }
  if (url.pathname === '/auth/v1/logout' && method === 'POST') return { status: 204, body: null }
  if (url.pathname === '/rest/v1/sellers' && method === 'GET') {
    return { status: 200, body: seller ? [{ user_id: 'vendedor-teste' }] : [] }
  }
  // Painel do vendedor (2026-11-20): o vendedor lê todos os pedidos e muda só a situação.
  if (url.pathname === '/rest/v1/orders' && method === 'GET' && seller) {
    const rows = db.orders.filter((order) => matchesFilters(order, url.searchParams)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return { status: 200, body: rows.map((order) => pick(order, select)) }
  }
  if (url.pathname === '/rest/v1/orders' && method === 'PATCH') {
    if (!seller) return { status: 401, body: { message: 'permission denied for table orders' } }
    if (state.failOrdersPatch) return { status: 500, body: { message: 'erro de teste' } }
    const change = JSON.parse(body || '{}')
    // "grant update (status)": mudar outra coluna é recusado pelo banco.
    if (Object.keys(change).join() !== 'status' || !ORDER_STATUSES.includes(change.status)) {
      return { status: 403, body: { message: 'permission denied for table orders' } }
    }
    const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
    const order = db.orders.find((candidate) => candidate.id === id)
    if (!order) return { status: 200, body: [] }
    const only = STATUS_ONLY_FOR[change.status]
    if (only && order.fulfillment !== only) return { status: 400, body: { message: 'new row for relation "orders" violates check constraint "orders_status_modalidade_check"' } }
    const changed = order.status !== change.status
    order.status = change.status
    order.updated_at = new Date().toISOString()
    db.onChange?.('UPDATE', order)
    // O gatilho registrar_evento_pedido: a situação nova vai para o histórico do cliente.
    if (changed) addEvent(db, order, 'status', 'vendedor')
    return { status: 200, body: [pick(order, select[0] === '*' ? [] : select)] }
  }

  if (url.pathname === '/rest/v1/rpc/catalogo_publico' && method === 'POST') {
    if (state.failCatalog) return { status: 503, body: { message: 'Fora do ar (Supabase de mentira)' } }
    return { status: 200, body: catalogFor(db.catalog, server || seller) }
  }
  if (url.pathname === '/rest/v1/catalog_changes' && method === 'GET') {
    return { status: 200, body: db.changes.map(({ kind, id, data }) => pick({ kind, id, data }, select)) }
  }
  if (url.pathname === '/rest/v1/orders' && method === 'GET') {
    // Sem política para visitantes (nem para o cliente: ele consulta pela função): vazio.
    if (!server) return { status: 200, body: [] }
    const limit = Number(url.searchParams.get('limit') ?? 1000)
    let rows = db.orders.filter((order) => matchesFilters(order, url.searchParams))
    if ((url.searchParams.get('order') ?? '').startsWith('created_at.desc')) rows = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    return { status: 200, body: rows.slice(0, limit).map((order) => pick(order, select)) }
  }
  if (url.pathname === '/rest/v1/orders' && method === 'POST') {
    if (!server) return { status: 401, body: { message: 'new row violates row-level security policy for table "orders"' } }
    const row = JSON.parse(body)
    // on_conflict=attempt_key com ignore-duplicates: a mesma chave não grava de novo.
    if (db.orders.some((order) => order.attempt_key === row.attempt_key)) return { status: 201, body: [] }
    const now = new Date().toISOString()
    const stored = { id: randomUUID(), created_at: now, updated_at: now, status: 'novo', additions: [], customer_user_id: null, ...row }
    db.orders.push(stored)
    db.onChange?.('INSERT', stored)
    addEvent(db, stored, 'status', 'cliente')
    return { status: 201, body: [pick(stored, select)] }
  }
  // O histórico (2026-11-20): só a função (chave de servidor) lê por aqui.
  if (url.pathname === '/rest/v1/order_events' && method === 'GET') {
    // RLS: a função (chave de servidor) e o vendedor leem; o cliente lê pela função.
    if (!server && !seller) return { status: 200, body: [] }
    const rows = db.events.filter((event) => matchesFilters(event, url.searchParams)).sort((a, b) => a.id - b.id)
    return { status: 200, body: rows.map((event) => pick(event, select)) }
  }
  if (url.pathname === '/rest/v1/rpc/adicionar_itens_pedido' && method === 'POST') {
    if (!server) return { status: 401, body: { message: 'permission denied for function adicionar_itens_pedido' } }
    if (state.failRpc) return { status: 500, body: { message: 'erro de teste' } }
    return { status: 200, body: addItemsRpc(db, JSON.parse(body || '{}')) }
  }
  if (url.pathname === '/rest/v1/rpc/proximo_numero_pedido' && method === 'POST') {
    if (!server) return { status: 401, body: { message: 'permission denied for function proximo_numero_pedido' } }
    db.sequence += 1
    return { status: 200, body: db.sequence }
  }
  return { status: 404, body: { message: `rota não existe no Supabase de mentira: ${method} ${url.pathname}` } }
}

let bundleHandler = null
const fakeEnv = {}

/** Carrega o arquivo gerado da função com um Deno de mentira (uma vez por processo). */
async function loadFunction() {
  if (bundleHandler) return bundleHandler
  globalThis.Deno = {
    env: { get: (name) => fakeEnv[name] },
    serve: (handler) => {
      bundleHandler = handler
    },
  }
  await import(pathToFileURL(BUNDLE).href)
  if (!bundleHandler) throw new Error('O arquivo da função não chamou Deno.serve.')
  return bundleHandler
}

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })

/**
 * Sobe o Supabase de mentira. `env` muda o ambiente da função (para testar a chave antiga ou a
 * falta de configuração); `failFunction` faz a função responder 503 (servidor fora do ar).
 */
export async function startFakeSupabase({ port = 0, db = createFakeDatabase(), env = {} } = {}) {
  const handler = await loadFunction()
  const state = { failFunction: false, failOrdersPatch: false, failRpc: false, anonymousSignIn: true, loseReply: false, failCatalog: false }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const headers = Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), String(value)]))
    const body = await readBody(request)
    db.calls.push({ method: request.method, path: url.pathname, search: url.search, apikey: headers.apikey ?? null, authorization: headers.authorization ?? null })
    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS).end()
      return
    }
    if (url.pathname === '/functions/v1/pedido') {
      if (state.failFunction) {
        response.writeHead(503, { ...CORS, 'Content-Type': 'text/plain' }).end('Fora do ar (Supabase de mentira)')
        return
      }
      const reply = await handler(new Request(`http://127.0.0.1${url.pathname}`, { method: request.method, headers, body: request.method === 'GET' ? undefined : body }))
      // A resposta perdida no caminho (2026-11-20): a função gravou, mas o site não recebe a resposta.
      if (state.loseReply) {
        response.writeHead(503, { ...CORS, 'Content-Type': 'text/plain' }).end('Resposta perdida (Supabase de mentira)')
        return
      }
      const replyHeaders = Object.fromEntries(reply.headers.entries())
      response.writeHead(reply.status, replyHeaders).end(Buffer.from(await reply.arrayBuffer()))
      return
    }
    const result = rest(db, request.method, url, headers, body, state)
    if (result.body === null) {
      response.writeHead(result.status, CORS).end()
      return
    }
    response.writeHead(result.status, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(result.body))
  })
  // Realtime (painel ao vivo, 2026-11-20): as mudanças em orders vão para quem se inscreveu.
  const realtime = attachFakeRealtime(server, { isPublicKey: (key) => key === PUBLIC_KEY, sellerToken: SELLER_TOKEN, userOf: (token) => tokenUser(db, token) })
  db.onChange = (type, row) => realtime.publish(type, row)
  // Acompanhamento do cliente (2026-11-20): cada evento novo vai só para o dono (e o vendedor).
  db.onEvent = (event) => realtime.publish('INSERT', event, 'order_events')
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}`
  // O ambiente que o Supabase põe na função: o endereço do projeto e a chave de servidor.
  for (const name of Object.keys(fakeEnv)) delete fakeEnv[name]
  Object.assign(fakeEnv, { SUPABASE_URL: url, SUPABASE_SECRET_KEYS: JSON.stringify({ default: SERVER_KEY }) }, env)
  return {
    url,
    db,
    state,
    env: fakeEnv,
    realtime,
    /** Troca o cardápio do banco (a revisão sobe) e avisa quem ouve catalog_meta, como o gatilho. */
    setCatalog(next) {
      db.catalog = { ...next, revision: (db.catalog.revision ?? 0) + 1 }
      realtime.publish('UPDATE', { id: 1, revision: db.catalog.revision }, 'catalog_meta')
    },
    close: () => {
      realtime.closeAll()
      return new Promise((resolve) => server.close(resolve))
    },
  }
}
