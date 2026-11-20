import { describe, expect, it } from 'vitest'
import { EMPTY_CART, addExtraItem, serializeCart } from '../cart/cart.ts'
import { EMPTY_CUSTOMER } from '../checkout/delivery.ts'
import { type OrderSubmission, orderFunctionUrl, submitOrder } from './orderService.ts'

const CONFIG = { url: 'https://abc.supabase.co/', key: 'sb_publishable_x' }
const submission = (): OrderSubmission => ({
  cart: addExtraItem(EMPTY_CART, 'jujuba', {}, 'j1').cart,
  customer: { ...EMPTY_CUSTOMER, name: 'Maria', kind: 'retirada' },
  payment: { method: 'pix', changeFor: '', exact: false },
  expectedTotalCents: 100,
})

/** `fetch` falso que guarda a chamada e responde o que for pedido. */
function replying(reply: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchImpl = ((url: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    return reply()
  }) as typeof fetch
  return { fetchImpl, calls }
}
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))

describe('registro do pedido pelo site (opção A, pedido de 2026-11-17)', () => {
  it('manda o carrinho como o site guarda, o cliente, o pagamento e o total que o cliente viu', async () => {
    const { fetchImpl, calls } = replying(() =>
      json({ ok: true, id: 'uuid-7', code: 'ADS-0007', createdAt: '2026-11-20T18:00:00.000Z', tracked: false, message: 'comanda', totalCents: 100, whatsapp: '5583996999980', repeated: false }),
    )
    const result = await submitOrder(submission(), CONFIG, fetchImpl)
    expect(result).toEqual({ kind: 'registered', id: 'uuid-7', code: 'ADS-0007', createdAt: '2026-11-20T18:00:00.000Z', tracked: false, totalCents: 100, repeated: false })
    expect(calls[0].url).toBe('https://abc.supabase.co/functions/v1/pedido')
    expect(calls[0].init.method).toBe('POST')
    expect((calls[0].init.headers as Record<string, string>).apikey).toBe('sb_publishable_x')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      op: 'criar',
      cart: serializeCart(submission().cart),
      customer: submission().customer,
      payment: submission().payment,
      expectedTotalCents: 100,
    })
    expect(orderFunctionUrl({ url: 'https://abc.supabase.co', key: 'k' })).toBe('https://abc.supabase.co/functions/v1/pedido')
  })

  it('pedido 100% no site (2026-11-20): a tentativa e a sessão do cliente vão junto; o token nunca vai na URL', async () => {
    const { fetchImpl, calls } = replying(() =>
      json({ ok: true, id: 'uuid-8', code: 'ADS-0008', createdAt: '2026-11-20T18:00:00.000Z', tracked: true, totalCents: 100, repeated: true }),
    )
    const result = await submitOrder({ ...submission(), attemptId: 'tentativa-0000000001' }, { ...CONFIG, token: 'token-da-sessao' }, fetchImpl)
    expect(result).toMatchObject({ kind: 'registered', id: 'uuid-8', tracked: true, repeated: true })
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer token-da-sessao')
    expect(JSON.parse(String(calls[0].init.body)).attemptId).toBe('tentativa-0000000001')
    expect(calls[0].url).not.toContain('token')
  })

  it('função antiga (sem id na resposta): registrado, mas sem acompanhamento', async () => {
    const { fetchImpl } = replying(() => json({ ok: true, code: 'ADS-0009', message: 'comanda', totalCents: 100, whatsapp: '5583996999980', repeated: false }))
    expect(await submitOrder(submission(), { ...CONFIG, token: 't' }, fetchImpl)).toEqual({
      kind: 'registered',
      id: null,
      code: 'ADS-0009',
      createdAt: null,
      tracked: false,
      totalCents: 100,
      repeated: false,
    })
  })

  it('chave anon antiga (um JWT) vai também como Bearer', async () => {
    const { fetchImpl, calls } = replying(() => json({ ok: false, reason: 'total-mudou', totalCents: 150 }))
    await submitOrder(submission(), { url: 'https://abc.supabase.co', key: 'eyJanon' }, fetchImpl)
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer eyJanon')
  })

  it('recusa das regras: volta o motivo para o cliente corrigir', async () => {
    expect(await submitOrder(submission(), CONFIG, replying(() => json({ ok: false, reason: 'total-mudou', totalCents: 150 })).fetchImpl)).toEqual({
      kind: 'rejected',
      reason: 'total-mudou',
      totalCents: 150,
    })
    expect(await submitOrder(submission(), CONFIG, replying(() => json({ ok: false, reason: 'esgotado', detail: 'Jujuba' })).fetchImpl)).toEqual({
      kind: 'rejected',
      reason: 'esgotado',
      detail: 'Jujuba',
    })
  })

  it('servidor fora do ar, resposta estranha, sem internet ou demora: falha (o site oferece tentar de novo)', async () => {
    expect(await submitOrder(submission(), CONFIG, replying(() => json({ ok: false, reason: 'erro-servidor' }, 500)).fetchImpl)).toEqual({ kind: 'failed', why: 'servidor' })
    expect(await submitOrder(submission(), CONFIG, replying(() => Promise.resolve(new Response('<html>', { status: 200 }))).fetchImpl)).toEqual({ kind: 'failed', why: 'resposta' })
    expect(await submitOrder(submission(), CONFIG, replying(() => json({ ok: false, reason: 'pedido-invalido' })).fetchImpl)).toEqual({ kind: 'failed', why: 'resposta' })
    expect(await submitOrder(submission(), CONFIG, replying(() => Promise.reject(new TypeError('Failed to fetch'))).fetchImpl)).toEqual({ kind: 'failed', why: 'rede' })
    const hanging = ((_url: RequestInfo | URL, init: RequestInit = {}) =>
      new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError'))))) as typeof fetch
    expect(await submitOrder(submission(), CONFIG, hanging, 30)).toEqual({ kind: 'failed', why: 'tempo' })
  })
})
