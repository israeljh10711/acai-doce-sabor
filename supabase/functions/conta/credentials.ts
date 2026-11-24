const encoder = new TextEncoder()

export function customerIdentifier(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 180) return null
  const id = raw.normalize('NFC').trim().replace(/\p{Zs}+/gu, ' ').toLocaleLowerCase('pt-BR').normalize('NFC')
  if (/^\p{L}[\p{L}\p{M}\p{N} ._'-]{2,59}$/u.test(id)) return id
  if (!/^\+?[\d() -]+$/.test(id)) return null
  const digits = id.replace(/\D/g, '')
  const national = /^(?:55)\d{10,11}$/.test(digits) ? digits.slice(2) : digits
  return /^[1-9]{2}[2-9]\d{7,8}$/.test(national) ? '+55' + national : null
}

export function validPassword(value: unknown, min: number): value is string {
  return typeof value === 'string' && value.length <= 72 && [...value].length >= min && encoder.encode(value).length <= 72
}

// O provedor guarda o bcrypt dessa credencial; o segredo só existe no servidor.
export async function derive(secret: string, ...parts: string[]): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(parts)))
  return Array.from(new Uint8Array(mac), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function providerPassword(secret: string, role: string, id: string, password: string): Promise<string> {
  return 'aA1!' + await derive(secret, 'password-v1', role, id, password)
}
