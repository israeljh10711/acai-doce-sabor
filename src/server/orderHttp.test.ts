import { describe, expect, it } from 'vitest'
import { createOrderHandler } from './orderHttp.ts'
import type { OrderDeps } from './orderServer.ts'

/** Banco que não deve ser chamado (entrada recusada antes). */
const untouched = (): OrderDeps => {
  throw new Error('não devia chegar ao banco')
}

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://abc.supabase.co/functions/v1/pedido', { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...headers } })

describe('entrada HTTP da função pedido', () => {
  it('pré-verificação do navegador (OPTIONS): 204 com CORS', async () => {
    const response = await createOrderHandler(untouched)(new Request('https://abc.supabase.co/functions/v1/pedido', { method: 'OPTIONS' }))
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('apikey')
  })

  it('outro método: 405; corpo que não é JSON: 400; corpo grande demais: 413 (sempre com CORS)', async () => {
    const handler = createOrderHandler(untouched)
    const get = await handler(new Request('https://abc.supabase.co/functions/v1/pedido'))
    expect([get.status, get.headers.get('Access-Control-Allow-Origin')]).toEqual([405, '*'])
    const bad = await handler(post('{nada'))
    expect([bad.status, await bad.json()]).toEqual([400, { ok: false, reason: 'pedido-invalido' }])
    const big = await handler(post(JSON.stringify({ cart: 'x'.repeat(300_000) })))
    expect(big.status).toBe(413)
  })

  it('pedido recusado pelas regras: 200 com o motivo', async () => {
    const response = await createOrderHandler(untouched)(post(JSON.stringify({ cart: 1 })))
    expect([response.status, await response.json()]).toEqual([200, { ok: false, reason: 'pedido-invalido' }])
  })

  it('erro do banco ou da configuração: 500, e o motivo vai para o log da função', async () => {
    const logged: string[] = []
    const failing = (): OrderDeps => {
      throw new Error('SUPABASE_URL ausente')
    }
    const response = await createOrderHandler(failing, (message) => logged.push(message))(
      post(JSON.stringify({ cart: '{"v":2,"items":[]}', customer: {}, payment: {}, expectedTotalCents: 0 })),
    )
    expect([response.status, await response.json()]).toEqual([500, { ok: false, reason: 'erro-servidor' }])
    expect(logged.join(' ')).toContain('SUPABASE_URL ausente')
  })
})
