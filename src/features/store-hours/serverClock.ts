/**
 * Relógio corrigido pelo servidor.
 *
 * O relógio do aparelho pode estar errado. Toda resposta HTTP traz o cabeçalho `Date` com a
 * hora do servidor; com ela calculamos a diferença para o relógio local e passamos a somar
 * essa diferença. Sem rede (ou sem o cabeçalho), vale o relógio do aparelho.
 */

let offsetMs = 0
let lastSync = 0
let pending: Promise<boolean> | null = null

/** Agora, em milissegundos, já corrigido pelo servidor quando possível. */
export function serverNow(): number {
  return Date.now() + offsetMs
}

/** A Vercel envia a hora atual em Date, inclusive em cache HIT. Age é a idade do arquivo. */
export function serverTimeFromDateHeader(date: string | null): number | null {
  if (!date) return null
  const parsed = Date.parse(date)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Diferença entre o servidor e o relógio local. Supõe que a resposta foi gerada no meio
 * da viagem de ida e volta. O cabeçalho só tem segundos inteiros: soma meio segundo, a
 * média do que foi cortado.
 */
export function clockOffset(serverMs: number, sentAt: number, receivedAt: number): number {
  const roundTrip = Math.max(0, receivedAt - sentAt)
  return serverMs + 500 + roundTrip / 2 - receivedAt
}

/** Pergunta a hora ao servidor (o próprio site). Devolve se conseguiu. */
export function syncServerClock(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (pending) return pending
  pending = (async () => {
    try {
      const sentAt = Date.now()
      const response = await fetchImpl(import.meta.env.BASE_URL, { method: 'HEAD', cache: 'no-store' })
      const receivedAt = Date.now()
      const serverMs = serverTimeFromDateHeader(response.headers.get('date'))
      if (serverMs === null) return false
      offsetMs = clockOffset(serverMs, sentAt, receivedAt)
      lastSync = receivedAt
      return true
    } catch {
      return false
    } finally {
      pending = null
    }
  })()
  return pending
}

/** Milissegundos desde a última sincronização bem-sucedida (infinito se nunca houve). */
export function sinceLastSync(): number {
  return lastSync === 0 ? Number.POSITIVE_INFINITY : Date.now() - lastSync
}
