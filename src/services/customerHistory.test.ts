import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listCustomerHistory, loadCustomerAddress, removeCustomerAddress, saveCustomerAddress } from './customerHistory.ts'

const session = vi.hoisted(() => ({ userId: vi.fn(), account: vi.fn(), token: vi.fn() }))
vi.mock('../features/tracking/trackingRuntime.ts', () => ({ getCustomerSession: () => session }))
vi.mock('../features/seller/sellerBackend.ts', () => ({ supabaseConfig: () => ({ url: 'https://loja.test', key: 'publica' }) }))

const request = vi.fn<typeof fetch>()
beforeEach(() => {
  vi.clearAllMocks()
  session.userId.mockReturnValue('cliente-A')
  session.account.mockReturnValue('83999999999')
  session.token.mockResolvedValue('token-A')
  vi.stubGlobal('fetch', request)
})
afterEach(() => vi.unstubAllGlobals())

describe('dados da conta', () => {
  it('envia apenas os campos do endereço e o UUID da conta atual', async () => {
    const address = { street: ' Rua A ', number: '1', district: 'Centro', zoneId: null, reference: '', gps: { lat: 1, lng: 2 } }
    request.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await saveCustomerAddress(address)
    const [path, init] = request.mock.calls[0]
    expect(path).toBe('https://loja.test/rest/v1/customer_addresses?on_conflict=user_id')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token-A', apikey: 'publica' })
    expect(JSON.parse(String(init?.body))).toEqual({ user_id: 'cliente-A', street: 'Rua A', number: '1', district: 'Centro', zone_id: null, reference: '' })
  })

  it('lê o endereço salvo e remove somente o da conta atual', async () => {
    request.mockResolvedValueOnce(Response.json([{ street: 'Rua A', number: '1', district: 'Centro', zone_id: 'centro', reference: '' }]))
    expect(await loadCustomerAddress()).toEqual({ street: 'Rua A', number: '1', district: 'Centro', zoneId: 'centro', reference: '' })
    request.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await removeCustomerAddress()
    expect(request.mock.calls[1][0]).toContain('user_id=eq.cliente-A')
    expect(request.mock.calls[1][1]?.method).toBe('DELETE')
  })

  it('devolve o carrinho original e os acréscimos, sem filtrar por telefone ou data', async () => {
    const carts = [{ v: 2, items: [{ id: 'a' }] }, { v: 2, items: [{ id: 'b' }] }]
    const items = [{ name: 'Item', quantity: 2 }]
    request.mockResolvedValueOnce(Response.json([{
      id: 'pedido', code: 'ADS-1', created_at: '2020-01-01', status: 'concluido', fulfillment: 'retirada', total_cents: 2300, carts, items,
    }]))
    expect(await listCustomerHistory(20)).toEqual([{
      id: 'pedido', code: 'ADS-1', createdAt: '2020-01-01', status: 'concluido', fulfillment: 'retirada', totalCents: 2300,
      carts: carts.map(cart => JSON.stringify(cart)), items,
    }])
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ p_offset: 20 })
  })

  it('o visitante não acessa os dados e a troca de conta descarta a leitura em andamento', async () => {
    session.account.mockReturnValue(null)
    await expect(loadCustomerAddress()).rejects.toThrow('Entre novamente')
    expect(request).not.toHaveBeenCalled()
    session.account.mockReturnValue('83999999999')
    request.mockImplementationOnce(async () => {
      session.userId.mockReturnValue('cliente-B')
      return Response.json([])
    })
    await expect(listCustomerHistory()).rejects.toThrow('Entre novamente')
  })
})
