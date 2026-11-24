import { describe, expect, it } from 'vitest'
import { createAccountHandler, type AccountConfig } from '../../supabase/functions/conta/handler.ts'
import { customerIdentifier, providerPassword } from '../../supabase/functions/conta/credentials.ts'

const config: AccountConfig = { url: 'https://teste.invalid', secret: 'a'.repeat(32), serviceKey: 'chave-privada', publicKey: 'chave-publica', sellerEmail: 'vendedor@teste.invalid' }
const body = (value: unknown, status = 200) => Response.json(value, { status })
const token = (user: unknown) => ({ user, access_token: 'e30.' + btoa(JSON.stringify({ session_id: 'sessao' })) + '.sig', refresh_token: 'refresh', expires_in: 3600 })
type Route = (path: string, args: Record<string, unknown>, init: RequestInit) => Response

function setup(routes: Route) {
  const calls: string[] = []
  const handler = createAccountHandler(() => config, async (input, init = {}) => {
    const path = new URL(String(input)).pathname
    calls.push(path)
    if (path.endsWith('/conta_devolver_tentativa')) return body(null)
    return routes(path, init.body ? JSON.parse(String(init.body)) : {}, init)
  })
  const submit = (data: unknown) => handler(new Request('https://site.invalid/conta', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }))
  return { calls, submit }
}

describe('acesso limitado no servidor', () => {
  it('normaliza nomes e telefones sem aceitar e-mail ou identificadores ambíguos', () => {
    expect(customerIdentifier(' JoAo_12 ')).toBe('joao_12')
    expect(customerIdentifier(' Joa\u0303o   da Silva ')).toBe('joão da silva')
    expect(customerIdentifier('JOÃO DA SILVA')).toBe('joão da silva')
    expect(customerIdentifier('(11) 91234-5678')).toBe('+5511912345678')
    expect(customerIdentifier('+55 11 91234-5678')).toBe('+5511912345678')
    expect(customerIdentifier('cliente@loja.com')).toBeNull()
    expect(customerIdentifier('123abc')).toBeNull()
  })
  it('cadastra no Auth com metadado protegido e credencial distinta da digitada', async () => {
    let credential = ''
    const { submit, calls } = setup((path, args, init) => {
      if (path.endsWith('conta_reservar_tentativa')) return body(-1)
      if (path.endsWith('admin/users')) {
        expect(new Headers(init.headers).get('apikey')).toBe(config.serviceKey)
        expect(args.app_metadata).toEqual({ customer_account: true, customer_identifier: 'cliente' })
        expect(args.email).toMatch(/^[a-f0-9]{48}@cliente\.invalid$/)
        credential = String(args.password)
        expect(credential).not.toBe('senha1234')
        return body({})
      }
      expect(args.password).toBe(credential)
      return body(token({ id: 'uid', app_metadata: { customer_account: true, customer_identifier: 'cliente' } }))
    })
    expect((await submit({ action: 'signup', identifier: 'Cliente', password: 'senha1234' })).status).toBe(200)
    expect(calls.filter(path => path.endsWith('conta_reservar_tentativa'))).toHaveLength(2)
  })
  it('recusa a tentativa antes do provedor quando a cota acaba ou o banco falha', async () => {
    for (const action of ['signin', 'signup', 'seller']) {
      const limited = setup(() => body(480))
      const response = await limited.submit({ action, identifier: 'cliente', password: 'senha1234' })
      expect(response.status).toBe(429)
      expect(response.headers.get('Retry-After')).toBe('480')
      expect(limited.calls).toHaveLength(1)
      const offline = setup(() => body({}, 500))
      expect((await offline.submit({ action, identifier: 'cliente', password: 'senha1234' })).status).toBe(503)
      expect(offline.calls).toHaveLength(1)
    }
  })
  it('converte o vendedor legado após validação e só libera sessão aprovada', async () => {
    const derived = await providerPassword(config.secret, 'seller', config.sellerEmail, 'senha-antiga')
    let updated = false
    const { submit, calls } = setup((path, args) => {
      if (path.endsWith('conta_reservar_tentativa')) return body(-7)
      if (path.endsWith('conta_reservar_conversao') || path.endsWith('conta_autorizar_vendedor')) return body(true)
      if (path.endsWith('admin/users/vendedor')) {
        expect(args).toEqual({ password: derived, app_metadata: { seller_password_version: 1 } })
        updated = true
        return body({})
      }
      if (args.password !== (updated ? derived : 'senha-antiga')) return body({}, 400)
      return body(token({ id: 'vendedor', email: config.sellerEmail, app_metadata: updated ? { seller_password_version: 1 } : {} }))
    })
    expect((await submit({ action: 'seller', password: 'senha-antiga' })).status).toBe(200)
    expect(calls).toContain('/rest/v1/rpc/conta_autorizar_vendedor')
    expect(calls.filter(path => path.endsWith('conta_devolver_tentativa'))).toHaveLength(2)
  })
})
