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
 * Monta o link que abre uma conversa no WhatsApp, com a mensagem já preenchida
 * quando informada. O link só abre a conversa: quem envia é a pessoa.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const url = `https://wa.me/${toWhatsAppNumber(phone)}`
  return message ? `${url}?text=${encodeURIComponent(message)}` : url
}
