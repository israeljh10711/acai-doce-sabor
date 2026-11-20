import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { type AddressGuess, GPS_ERROR_TEXT, type GpsPoint, gpsMapsUrl, locate, reverseGeocode } from './gps.ts'

const reveal = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18 },
} as const

/**
 * Botão "📍 Usar minha localização atual" da entrega (pedido de 2026-11-20).
 *
 * Pede a posição só no toque, um pedido por vez. Com o ponto, mostra o selo verde, o link para
 * conferir o pino e "Remover GPS", e pede ao Nominatim uma sugestão de endereço (uma consulta por
 * captura). A sugestão só vale para a captura atual: depois de remover ou capturar de novo, a
 * resposta atrasada é ignorada. Qualquer falha mostra a mesma mensagem amigável e o endereço
 * escrito continua valendo. O ponto nunca vai para log nem para o armazenamento da aba.
 */
export function GpsLocation({
  gps,
  onCapture,
  onRemove,
  onAddress,
}: {
  gps: GpsPoint | null
  onCapture: (point: GpsPoint) => void
  onRemove: () => void
  onAddress: (guess: AddressGuess) => void
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  // Um toque por vez (o estado só muda no desenho seguinte) e o número da captura em vigor.
  const busy = useRef(false)
  const captureId = useRef(0)

  // Saiu da entrega no meio da busca: a resposta atrasada não preenche nada.
  useEffect(
    () => () => {
      captureId.current++
      busy.current = false
    },
    [],
  )

  const capture = async () => {
    if (busy.current) return
    busy.current = true
    const id = ++captureId.current
    setState('loading')
    const result = await locate(globalThis.navigator?.geolocation, globalThis.isSecureContext !== false)
    if (id !== captureId.current) return
    busy.current = false
    if (!result.ok) {
      setState('error')
      return
    }
    setState('idle')
    onCapture(result.point)
    const guess = await reverseGeocode(result.point, (input, init) => fetch(input, init))
    if (guess && id === captureId.current) onAddress(guess)
  }

  const remove = () => {
    captureId.current++
    busy.current = false
    setState('idle')
    onRemove()
  }

  const loading = state === 'loading'

  return (
    <div data-gps={gps ? 'anexado' : state} className="flex flex-col gap-2">
      <AnimatePresence initial={false} mode="wait">
        {gps ? (
          <m.div key="anexado" {...reveal} className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-700/30">
            <p role="status" className="font-bold text-emerald-900">
              ✅ Localização GPS anexada ao pedido
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900">
              Confira o endereço abaixo: ele também vai no pedido, junto com o ponto do GPS.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <a
                data-gps-map=""
                href={gpsMapsUrl(gps)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-bold text-acai-800 underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                Conferir pino no mapa
              </a>
              <button
                type="button"
                data-gps-remove=""
                onClick={remove}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                Remover GPS
              </button>
            </div>
          </m.div>
        ) : (
          <m.div key="botao" {...reveal}>
            <button
              type="button"
              data-gps-capture=""
              onClick={() => void capture()}
              disabled={loading}
              aria-busy={loading || undefined}
              className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-acai-800/25 bg-acai-800/10 px-3 py-2.5 font-bold text-acai-800 transition hover:bg-acai-800/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-wait"
            >
              {loading && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-acai-800/30 border-t-acai-800 motion-reduce:animate-none" />}
              {loading ? 'Buscando sua localização...' : '📍 Usar minha localização atual'}
            </button>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">Opcional: ajuda o entregador a achar o local. O endereço abaixo continua valendo.</p>
          </m.div>
        )}
      </AnimatePresence>
      {state === 'error' && !gps && (
        <p data-gps-error="" role="alert" className="text-sm font-bold text-red-800">
          {GPS_ERROR_TEXT}
        </p>
      )}
    </div>
  )
}
