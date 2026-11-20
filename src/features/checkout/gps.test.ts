import { describe, expect, it } from 'vitest'
import { type GpsPoint, gpsMapsUrl, locate, nominatimUrl, parseGpsPoint, parseNominatim, reverseGeocode } from './gps.ts'

describe('ponto do GPS (pedido de 2026-11-20)', () => {
  it('aceita latitude e longitude válidas, com 6 casas (cerca de 11 cm)', () => {
    expect(parseGpsPoint({ lat: -7.2209871234, lng: -37.2541239876 })).toEqual({ lat: -7.220987, lng: -37.254124 })
    expect(parseGpsPoint({ lat: 90, lng: -180 })).toEqual({ lat: 90, lng: -180 })
    expect(parseGpsPoint({ lat: -7.5, lng: 0 })).toEqual({ lat: -7.5, lng: 0 })
  })

  it('recusa valores fora do mapa, não numéricos, incompletos ou o (0, 0) dos aparelhos com erro', () => {
    for (const raw of [
      { lat: 91, lng: 10 },
      { lat: 10, lng: -180.5 },
      { lat: Number.NaN, lng: 10 },
      { lat: Number.POSITIVE_INFINITY, lng: 10 },
      { lat: '-7.2', lng: '-37.2' },
      { lat: -7.2 },
      { lng: -37.2 },
      { lat: 0, lng: 0 },
      null,
      'texto',
      [-7.2, -37.2],
    ]) {
      expect(parseGpsPoint(raw)).toBeNull()
    }
  })

  it('link do Google Maps com as coordenadas, sem arredondar além das 6 casas', () => {
    expect(gpsMapsUrl({ lat: -7.220987, lng: -37.254124 })).toBe('https://www.google.com/maps?q=-7.220987,-37.254124')
    expect(gpsMapsUrl({ lat: -7.5, lng: 0 })).toBe('https://www.google.com/maps?q=-7.5,0')
  })
})

type Answer = { coords: { latitude: number; longitude: number } } | { code: number }

/** Geolocalização de mentira: responde como o aparelho (ou nunca responde) e guarda as opções. */
function fakeGeo(answer: Answer | 'nunca' | 'lanca') {
  const calls: PositionOptions[] = []
  const geo = {
    getCurrentPosition(success: PositionCallback, failure?: PositionErrorCallback | null, options?: PositionOptions) {
      calls.push(options ?? {})
      if (answer === 'lanca') throw new Error('bloqueado')
      if (answer === 'nunca') return
      if ('code' in answer) failure?.({ code: answer.code, message: 'x', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
      else success({ coords: answer.coords, timestamp: 0 } as GeolocationPosition)
    },
  }
  return { geo, calls }
}

describe('captura do GPS (pedido de 2026-11-20)', () => {
  it('sucesso: o ponto do aparelho, com alta precisão, tempo limite e sem posição guardada', async () => {
    const { geo, calls } = fakeGeo({ coords: { latitude: -7.2209871234, longitude: -37.2541239876 } })
    expect(await locate(geo, true)).toEqual({ ok: true, point: { lat: -7.220987, lng: -37.254124 } })
    expect(calls).toEqual([{ enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }])
  })

  it('permissão negada, GPS desligado (sem posição) e tempo esgotado', async () => {
    expect(await locate(fakeGeo({ code: 1 }).geo, true)).toEqual({ ok: false, why: 'negado' })
    expect(await locate(fakeGeo({ code: 2 }).geo, true)).toEqual({ ok: false, why: 'indisponivel' })
    expect(await locate(fakeGeo({ code: 3 }).geo, true)).toEqual({ ok: false, why: 'tempo' })
  })

  it('aparelho sem geolocalização, página sem https e navegador que bloqueia a chamada', async () => {
    expect(await locate(undefined, true)).toEqual({ ok: false, why: 'sem-suporte' })
    const { geo, calls } = fakeGeo({ coords: { latitude: -7.2, longitude: -37.2 } })
    expect(await locate(geo, false)).toEqual({ ok: false, why: 'inseguro' })
    expect(calls).toHaveLength(0)
    expect(await locate(fakeGeo('lanca').geo, true)).toEqual({ ok: false, why: 'indisponivel' })
  })

  it('aparelho que devolve um ponto inválido: não anexa nada', async () => {
    expect(await locate(fakeGeo({ coords: { latitude: 0, longitude: 0 } }).geo, true)).toEqual({ ok: false, why: 'indisponivel' })
  })

  it('pergunta de permissão ignorada (o navegador nunca responde): desiste sozinho', async () => {
    expect(await locate(fakeGeo('nunca').geo, true, 30)).toEqual({ ok: false, why: 'tempo' })
  })
})

const POINT: GpsPoint = { lat: -7.220987, lng: -37.254124 }
const NOMINATIM = {
  place_id: 1,
  display_name: 'Rua Francisco Tota, Centro, Teixeira, Paraíba, Brasil',
  address: { house_number: '12', road: 'Rua Francisco Tota', suburb: 'Centro', city: 'Teixeira', state: 'Paraíba', country_code: 'br' },
}
const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('endereço aproximado pelo Nominatim (pedido de 2026-11-20)', () => {
  it('uma consulta com o ponto, em português, e o endereço lido', async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input))
      return reply(NOMINATIM)()
    }
    expect(await reverseGeocode(POINT, fetchImpl)).toEqual({ street: 'Rua Francisco Tota', number: '12', district: 'Centro' })
    expect(urls).toEqual([nominatimUrl(POINT)])
    expect(nominatimUrl(POINT)).toBe(
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=-7.220987&lon=-37.254124&zoom=18&addressdetails=1&accept-language=pt-BR',
    )
  })

  it('lê o bairro de outros campos e aceita resposta sem número', () => {
    expect(parseNominatim({ address: { road: 'Av. Brasil', neighbourhood: 'Bela Vista' } })).toEqual({ street: 'Av. Brasil', number: null, district: 'Bela Vista' })
    expect(parseNominatim({ address: { pedestrian: 'Calçadão', quarter: 'Alto' } })).toEqual({ street: 'Calçadão', number: null, district: 'Alto' })
  })

  it('resposta sem endereço, com erro ou estranha: nada', () => {
    for (const body of [{ error: 'Unable to geocode' }, { address: {} }, { address: { city: 'Teixeira' } }, null, 'texto', []]) {
      expect(parseNominatim(body)).toBeNull()
    }
  })

  it('erro do servidor, internet caída, resposta que não é JSON ou demora: nada, sem lançar erro', async () => {
    expect(await reverseGeocode(POINT, reply({ error: 'x' }, 500))).toBeNull()
    expect(await reverseGeocode(POINT, async () => Promise.reject(new TypeError('Failed to fetch')))).toBeNull()
    expect(await reverseGeocode(POINT, async () => new Response('<html>', { status: 200 }))).toBeNull()
    const slow: typeof fetch = (_input, init) =>
      new Promise((_resolve, rejectFetch) => init?.signal?.addEventListener('abort', () => rejectFetch(new DOMException('abort', 'AbortError'))))
    expect(await reverseGeocode(POINT, slow, 20)).toBeNull()
  })
})
