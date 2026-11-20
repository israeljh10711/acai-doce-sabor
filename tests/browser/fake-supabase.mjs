// Supabase de mentira, para conferir o registro dos pedidos sem um projeto de verdade (pedido de
// 2026-11-17). Roda na própria máquina:
// - um banco na memória com as rotas da API REST que o site e a função usam (catalog_changes,
//   orders e a função proximo_numero_pedido), com as mesmas regras de acesso do SQL: o site lê o
//   cardápio com a chave pública; só a chave de servidor lê e grava pedidos;
// - a função "pedido" de verdade: o arquivo gerado supabase/functions/pedido/index.ts (o mesmo que
//   se cola no painel), carregado com um "Deno" de mentira.
//
// Uso: const fake = await startFakeSupabase({ port }); ... fake.db.changes.push(...); fake.close()
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PUBLIC_KEY = 'sb_publishable_teste'
export const SERVER_KEY = 'sb_secret_teste'
const BUNDLE = join(process.cwd(), 'supabase', 'functions', 'pedido', 'index.ts')

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer, accept-profile, content-profile',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

export function createFakeDatabase() {
  return { changes: [], orders: [], sequence: 0, calls: [] }
}

const pick = (row, columns) => (columns.length === 0 || columns[0] === '' ? row : Object.fromEntries(columns.map((column) => [column, row[column]])))

/** As rotas REST que o site e a função usam, com as regras de acesso do SQL. */
function rest(db, method, url, headers, body) {
  const key = headers.apikey
  if (!key) return { status: 401, body: { message: 'No API key found in request' } }
  if (key !== PUBLIC_KEY && key !== SERVER_KEY) return { status: 401, body: { message: 'Invalid API key' } }
  const server = key === SERVER_KEY
  const select = (url.searchParams.get('select') ?? '').split(',')

  if (url.pathname === '/rest/v1/catalog_changes' && method === 'GET') {
    return { status: 200, body: db.changes.map(({ kind, id, data }) => pick({ kind, id, data }, select)) }
  }
  if (url.pathname === '/rest/v1/orders' && method === 'GET') {
    // Sem política para visitantes: a leitura vem vazia, como no Supabase.
    if (!server) return { status: 200, body: [] }
    const attempt = (url.searchParams.get('attempt_key') ?? '').replace(/^eq\./, '')
    const limit = Number(url.searchParams.get('limit') ?? 1000)
    return { status: 200, body: db.orders.filter((order) => order.attempt_key === attempt).slice(0, limit).map((order) => pick(order, select)) }
  }
  if (url.pathname === '/rest/v1/orders' && method === 'POST') {
    if (!server) return { status: 401, body: { message: 'new row violates row-level security policy for table "orders"' } }
    const row = JSON.parse(body)
    // on_conflict=attempt_key com ignore-duplicates: a mesma chave não grava de novo.
    if (db.orders.some((order) => order.attempt_key === row.attempt_key)) return { status: 201, body: [] }
    const stored = { id: randomUUID(), created_at: new Date().toISOString(), status: 'novo', ...row }
    db.orders.push(stored)
    return { status: 201, body: [pick(stored, select)] }
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
  const state = { failFunction: false }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    const headers = Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name.toLowerCase(), String(value)]))
    const body = await readBody(request)
    db.calls.push({ method: request.method, path: url.pathname, apikey: headers.apikey ?? null, authorization: headers.authorization ?? null })
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
      const replyHeaders = Object.fromEntries(reply.headers.entries())
      response.writeHead(reply.status, replyHeaders).end(Buffer.from(await reply.arrayBuffer()))
      return
    }
    const result = rest(db, request.method, url, headers, body)
    response.writeHead(result.status, { ...CORS, 'Content-Type': 'application/json' }).end(JSON.stringify(result.body))
  })
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
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
