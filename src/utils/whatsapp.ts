const BRAZIL_COUNTRY_CODE = '55'

/**
 * Converte um telefone brasileiro para o formato dos links do WhatsApp:
 * só dígitos, com o código do país. Ex.: "(83) 99699-9980" -> "5583996999980".
 */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  // Um número nacional tem 10 ou 11 dígitos (DDD + número). Só tratamos o "55"
  // inicial como código do país quando sobram dígitos além disso, porque 55
  // também é um DDD válido.
  const hasCountryCode = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11
  const national = hasCountryCode ? digits.slice(BRAZIL_COUNTRY_CODE.length) : digits

  if (national.length !== 10 && national.length !== 11) {
    throw new RangeError(`Telefone inválido, esperado DDD + número: "${phone}"`)
  }

  return BRAZIL_COUNTRY_CODE + national
}

/**
 * Telefone brasileiro escrito como as pessoas leem: "(83) 99699-9980" (celular) ou
 * "(83) 3333-1234" (fixo). Aceita com ou sem o código do país. `null` se não for um telefone.
 */
export function formatBrazilPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const national = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11 ? digits.slice(BRAZIL_COUNTRY_CODE.length) : digits
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`
  return null
}

/**
 * Monta o link que abre uma conversa no WhatsApp, com a mensagem já preenchida
 * quando informada. O link só abre a conversa: quem envia é a pessoa.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const url = `https://wa.me/${toWhatsAppNumber(phone)}`
  return message ? `${url}?text=${encodeURIComponent(message)}` : url
}
