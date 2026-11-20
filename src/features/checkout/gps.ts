/**
 * Localização GPS na entrega (pedido de 2026-11-20): opcional, só depois do toque do cliente,
 * e um complemento do endereço escrito, nunca um substituto.
 *
 * O ponto vai com 6 casas decimais (cerca de 11 cm): precisão de sobra para achar a casa, e o
 * mesmo número no carrinho, na comanda e no banco. Regras puras, testadas sem aparelho.
 */

export type GpsPoint = { lat: number; lng: number }

const round6 = (value: number) => Math.round(value * 1e6) / 1e6

/**
 * Confere o ponto vindo do aparelho ou do pedido: números finitos, dentro do mapa, e não o
 * (0, 0) que alguns aparelhos devolvem quando falham. Fora disso, `null`.
 */
export function parseGpsPoint(raw: unknown): GpsPoint | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const { lat, lng } = raw as Record<string, unknown>
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const point = { lat: round6(lat), lng: round6(lng) }
  if (point.lat === 0 && point.lng === 0) return null
  // -0 vira 0 no texto do link de qualquer jeito; aqui também, para o banco e a comanda baterem.
  return { lat: point.lat + 0, lng: point.lng + 0 }
}

/** O ponto no Google Maps: `https://www.google.com/maps?q=LAT,LNG`. */
export function gpsMapsUrl({ lat, lng }: GpsPoint): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

/** O que o cliente lê em qualquer falha: nada técnico, e o caminho manual (texto do pedido). */
export const GPS_ERROR_TEXT = 'Não foi possível obter sua localização automaticamente. Você pode preencher seu endereço manualmente abaixo.'

export type LocateFailure = 'sem-suporte' | 'inseguro' | 'negado' | 'indisponivel' | 'tempo'
export type LocateResult = { ok: true; point: GpsPoint } | { ok: false; why: LocateFailure }

/** Alta precisão, até 15 s depois da permissão, e sempre uma posição nova (nunca uma guardada). */
const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }

/**
 * Pede a posição ao aparelho. Chamar só depois do toque do cliente. Nunca lança erro.
 * `secure`: a página está em https ou localhost (o navegador só libera a localização assim).
 * `guardMs`: o tempo limite do navegador não conta a espera pela permissão; se o cliente nunca
 * responder à pergunta, desiste depois de `guardMs`.
 */
export function locate(
  geo: Pick<Geolocation, 'getCurrentPosition'> | undefined,
  secure: boolean,
  guardMs = 30_000,
): Promise<LocateResult> {
  if (!secure) return Promise.resolve({ ok: false, why: 'inseguro' })
  if (!geo) return Promise.resolve({ ok: false, why: 'sem-suporte' })
  return new Promise((resolve) => {
    const guard = setTimeout(() => resolve({ ok: false, why: 'tempo' }), guardMs)
    const finish = (result: LocateResult) => {
      clearTimeout(guard)
      resolve(result)
    }
    try {
      geo.getCurrentPosition(
        (position) => {
          const point = parseGpsPoint({ lat: position.coords.latitude, lng: position.coords.longitude })
          finish(point ? { ok: true, point } : { ok: false, why: 'indisponivel' })
        },
        (error) => finish({ ok: false, why: error.code === 1 ? 'negado' : error.code === 3 ? 'tempo' : 'indisponivel' }),
        GEO_OPTIONS,
      )
    } catch {
      finish({ ok: false, why: 'indisponivel' })
    }
  })
}

/** Rua, número e bairro sugeridos pelo ponto. Uma sugestão: o cliente confere e corrige. */
export type AddressGuess = { street: string | null; number: string | null; district: string | null }

/** Consulta do endereço aproximado no Nominatim (OpenStreetMap), em português. */
export function nominatimUrl({ lat, lng }: GpsPoint): string {
  return `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** O primeiro campo com texto, limpo e no tamanho do campo do carrinho. */
function firstText(address: Record<string, unknown>, keys: readonly string[], max: number): string | null {
  for (const key of keys) {
    const value = address[key]
    if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim().slice(0, max)
  }
  return null
}

/** Lê a resposta do Nominatim. Sem rua nem bairro, não há o que sugerir. */
export function parseNominatim(body: unknown): AddressGuess | null {
  if (!isRecord(body) || !isRecord(body.address)) return null
  const { address } = body
  const guess = {
    street: firstText(address, ['road', 'pedestrian', 'footway', 'path'], 80),
    number: firstText(address, ['house_number'], 12),
    district: firstText(address, ['suburb', 'neighbourhood', 'quarter', 'city_district'], 60),
  }
  return guess.street || guess.district ? guess : null
}

/**
 * Uma consulta por captura, com tempo limite. Qualquer falha (servidor, internet, demora,
 * resposta estranha) devolve `null`: o pedido segue com o GPS e o endereço escrito.
 */
export async function reverseGeocode(point: GpsPoint, fetchImpl: typeof fetch, timeoutMs = 6_000): Promise<AddressGuess | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(nominatimUrl(point), { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!response.ok) return null
    return parseNominatim(await response.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
