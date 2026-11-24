import { customerIdentifier, derive, providerPassword, validPassword } from './credentials.ts'

export type AccountConfig = { url: string; serviceKey: string; publicKey: string; secret: string; sellerEmail: string }
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After',
  'Cache-Control': 'no-store',
}
const reply = (status: number, body: unknown, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } })
const denied = () => reply(401, { message: 'Identificador ou senha incorretos.' })
const unavailable = () => reply(503, { message: 'Acesso temporariamente indisponível. Tente novamente.' })
const tooMany = (seconds: number) => reply(429, { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }, { 'Retry-After': String(seconds) })

export function createAccountHandler(config: () => AccountConfig, send: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (request.method !== 'POST') return reply(405, {}, { Allow: 'POST, OPTIONS' })
    if (Number(request.headers.get('content-length')) > 2048 || !request.headers.get('content-type')?.includes('application/json')) return reply(400, {})
    try {
      // Também limita corpos enviados sem Content-Length.
      const reader = request.body?.getReader()
      if (!reader) return reply(400, {})
      const decoder = new TextDecoder()
      let raw = '', length = 0
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > 2048) { await reader.cancel(); return reply(413, {}) }
        raw += decoder.decode(value, { stream: true })
      }
      let data
      try { data = JSON.parse(raw + decoder.decode()) } catch { return reply(400, {}) }
      if (!data || typeof data !== 'object') return reply(400, {})
      const { action, password } = data
      if (!['signup', 'signin', 'seller', 'seller-password'].includes(action)) return reply(400, {})
      const seller = action === 'seller' || action === 'seller-password'
      const min = action === 'signup' || action === 'seller-password' ? 8 : 1
      if (!validPassword(password, min)) return reply(400, { message: 'Use uma senha de até 72 bytes e pelo menos ' + min + ' caracteres.' })
      const { url, serviceKey, publicKey, secret, sellerEmail } = config()
      if (!url || !serviceKey || !publicKey || secret.length < 32 || (seller && !sellerEmail)) return unavailable()
      const id = seller ? sellerEmail.trim().toLowerCase() : customerIdentifier(data.identifier)
      if (!id) return reply(400, { message: 'Digite um nome de 3 a 60 caracteres começando por letra, ou um telefone com DDD.' })
      const role = seller ? 'seller' : 'customer'
      const privileged = { apikey: serviceKey, ...(serviceKey.startsWith('eyJ') ? { Authorization: 'Bearer ' + serviceKey } : {}), 'Content-Type': 'application/json' }
      const publicHeaders = { apikey: publicKey, 'Content-Type': 'application/json' }
      const tickets: { chave: string; janela: number }[] = []
      const reserve = async (label: string, key: string, limit: number) => {
        const chave = await derive(secret, role, action, label, key)
        const res = await send(url + '/rest/v1/rpc/conta_reservar_tentativa', {
          method: 'POST', headers: privileged,
          body: JSON.stringify({ chave, limite: limit, segundos: 900 }),
        })
        if (!res.ok) throw new Error()
        const wait = await res.json()
        if (!Number.isInteger(wait)) throw new Error()
        if (wait < 0) tickets.push({ chave, janela: -wait })
        return Math.max(0, wait)
      }
      // A plataforma substitui cf-connecting-ip. Em instalações locais, o balde é compartilhado.
      const ip = request.headers.get('cf-connecting-ip') || 'local'
      const ipWait = await reserve('ip', ip, action === 'signup' ? 10 : 30)
      if (ipWait) return tooMany(ipWait)
      const accountWait = await reserve('account', id, 8)
      if (accountWait) return tooMany(accountWait)
      const email = seller ? id : (await derive(secret, 'email-v1', id)).slice(0, 48) + '@cliente.invalid'
      const credential = await providerPassword(secret, role, id, password)
      if (action === 'seller-password') {
        const token = request.headers.get('Authorization') ?? ''
        if (!/^Bearer [^ ]+$/.test(token)) return denied()
        const authHeaders = { ...publicHeaders, Authorization: token }
        const userRes = await send(url + '/auth/v1/user', { headers: authHeaders })
        if (!userRes.ok) return denied()
        const user = await userRes.json()
        if (user.email !== email || user.app_metadata?.seller_password_version !== 1) return denied()
        const allowed = await send(url + '/rest/v1/rpc/is_seller', { method: 'POST', headers: authHeaders, body: '{}' })
        if (!allowed.ok || await allowed.json() !== true) return denied()
        const changed = await send(url + '/auth/v1/user', { method: 'PUT', headers: authHeaders, body: JSON.stringify({ password: credential }) })
        return changed.ok ? reply(200, { ok: true }) : reply(400, { message: 'Não foi possível alterar a senha.' })
      }
      if (action === 'signup') {
        const created = await send(url + '/auth/v1/admin/users', { method: 'POST', headers: privileged, body: JSON.stringify({
          email, password: credential, email_confirm: true,
          app_metadata: { customer_account: true, customer_identifier: id },
        }) })
        if (!created.ok) {
          if (created.status >= 500 || created.status === 401 || created.status === 403) return unavailable()
          return reply(400, { message: 'Não foi possível criar essa conta. Tente entrar ou use outro identificador.' })
        }
      }
      const authenticate = (pass: string) => send(url + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: publicHeaders, body: JSON.stringify({ email, password: pass }), signal: AbortSignal.timeout(12000),
      })
      let auth = await authenticate(credential)
      if (action === 'seller' && auth.status === 400) {
        const legacy = await authenticate(password)
        if (legacy.status === 429) return tooMany(900)
        if (!legacy.ok) return legacy.status >= 500 ? unavailable() : denied()
        const old = await legacy.json()
        if (old.user?.email !== id || old.user.app_metadata?.seller_password_version === 1) return denied()
        const claim = await send(url + '/rest/v1/rpc/conta_reservar_conversao', {
          method: 'POST', headers: privileged, body: JSON.stringify({ vendedor: old.user.id }),
        })
        if (!claim.ok || await claim.json() !== true) return unavailable()
        const update = await send(url + '/auth/v1/admin/users/' + encodeURIComponent(old.user.id), {
          method: 'PUT', headers: privileged, signal: AbortSignal.timeout(12000),
          body: JSON.stringify({ password: credential, app_metadata: { seller_password_version: 1 } }),
        })
        if (!update.ok) return unavailable()
        auth = await authenticate(credential)
      }
      if (auth.status === 429) return tooMany(900)
      if (auth.status >= 500) return unavailable()
      if (!auth.ok) return denied()
      const session = await auth.json()
      const metadata = session.user?.app_metadata
      const valid = seller ? metadata?.seller_password_version === 1 : metadata?.customer_account === true && metadata?.customer_identifier === id
      if (!valid) return denied()
      if (seller) {
        // Token recém-emitido pela URL fixa do Auth; a RPC também verifica UID e auth.sessions.
        const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        const sessionId = JSON.parse(atob(payload)).session_id
        const accepted = await send(url + '/rest/v1/rpc/conta_autorizar_vendedor', {
          method: 'POST', headers: privileged, body: JSON.stringify({ sessao: sessionId, vendedor: session.user.id }),
        })
        if (!accepted.ok || await accepted.json() !== true) return denied()
      }
      if (action !== 'signup') await Promise.allSettled(tickets.map(ticket => send(url + '/rest/v1/rpc/conta_devolver_tentativa', {
        method: 'POST', headers: privileged, body: JSON.stringify(ticket),
      })))
      return reply(200, session)
    } catch {
      return unavailable()
    }
  }
}
