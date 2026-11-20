/**
 * Entrada HTTP da função `pedido` (pedido de 2026-11-17): aceita só POST com JSON, responde à
 * pré-verificação do navegador (CORS) e devolve a resposta das regras (`orderServer.ts`).
 * Recusa pelas regras é 200 com o motivo; erro do banco ou da configuração é 500 (o site oferece
 * "Enviar mesmo assim pelo WhatsApp").
 */
import { type OrderDeps, handleOrder } from './orderServer.ts'

/** Tamanho máximo do corpo do pedido (o carrinho vem como texto). */
export const MAX_BODY = 250_000

export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } })

/** SHA-256 em hexadecimal (Web Crypto: Deno, Node e navegador em HTTPS). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** O banco montado só no primeiro uso: entrada recusada pelas regras nem chega a ele. */
function lazyDeps(getDeps: () => OrderDeps): OrderDeps {
  let deps: OrderDeps | null = null
  const get = () => (deps ??= getDeps())
  return {
    readChanges: () => get().readChanges(),
    findOrder: (attemptKey) => get().findOrder(attemptKey),
    nextNumber: () => get().nextNumber(),
    insertOrder: (row) => get().insertOrder(row),
    now: () => get().now(),
    sha256: (text) => get().sha256(text),
  }
}

/**
 * `getDeps` monta o banco na hora do pedido (a falta de configuração vira 500 com o motivo no log,
 * e não uma função que nem sobe).
 */
export function createOrderHandler(getDeps: () => OrderDeps, log: (message: string) => void = () => {}) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
    if (request.method !== 'POST') return json(405, { ok: false, reason: 'pedido-invalido' })
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (declared > MAX_BODY) return json(413, { ok: false, reason: 'pedido-invalido' })
    const text = await request.text()
    if (text.length > MAX_BODY) return json(413, { ok: false, reason: 'pedido-invalido' })
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return json(400, { ok: false, reason: 'pedido-invalido' })
    }
    try {
      return json(200, await handleOrder(raw, lazyDeps(getDeps)))
    } catch (error) {
      log(`Falha ao registrar o pedido: ${error instanceof Error ? error.message : String(error)}`)
      return json(500, { ok: false, reason: 'erro-servidor' })
    }
  }
}
