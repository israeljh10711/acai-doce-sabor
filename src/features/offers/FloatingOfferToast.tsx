import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { ArrowRight, Bell, Close } from '../../components/ui/icons.tsx'
import type { OfferNotification } from './offerNotifications.ts'
import { OFFER_TIMING, type OfferSnapshot } from './offerScheduler.ts'

type FloatingOfferToastProps = {
  offer: OfferNotification | undefined
  snapshot: OfferSnapshot
  onAccept: (offer: OfferNotification) => void
  onDismiss: () => void
  /** Ponteiro, dedo ou foco no cartão: a contagem para. */
  onHold: (held: boolean) => void
  onReactivate: () => void
}

/**
 * Notificação flutuante de oferta (pedido de 2026-11-15), no estilo de aviso de aplicativo:
 * embaixo, de lado a lado no celular, e no canto inferior direito do computador. O cartão
 * inteiro leva à compra; o X fecha. A barra dourada mostra os 8 segundos e para junto com a
 * contagem. Não é anunciada para leitores de tela (seria uma interrupção a cada poucos
 * segundos): fica num `aside` nomeado.
 */
export function FloatingOfferToast({ offer, snapshot, onAccept, onDismiss, onHold, onReactivate }: FloatingOfferToastProps) {
  const reduceMotion = useReducedMotion()
  const bar = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  // Cada fonte de pausa separada: o cartão só volta a contar quando nenhuma está ativa.
  const holds = useRef({ hover: false, press: false, focus: false })

  const hold = (source: keyof typeof holds.current, value: boolean) => {
    holds.current[source] = value
    onHold(Object.values(holds.current).some(Boolean))
  }

  // Barra de tempo: recomeça a cada oferta e para junto com a contagem.
  useEffect(() => {
    holds.current = { hover: false, press: false, focus: false }
    const element = bar.current
    if (!element || !offer || typeof element.animate !== 'function') return
    animation.current = element.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], {
      duration: OFFER_TIMING.visibleMs,
      easing: 'linear',
      fill: 'forwards',
    })
    return () => {
      animation.current?.cancel()
      animation.current = null
    }
  }, [snapshot.showKey, offer])

  useEffect(() => {
    const current = animation.current
    if (!current) return
    if (snapshot.held && current.playState === 'running') current.pause()
    else if (!snapshot.held && current.playState === 'paused') current.play()
  }, [snapshot.held])

  return (
    <>
      <AnimatePresence>
        {offer && (
          <m.aside
            key={snapshot.showKey}
            aria-label="Oferta"
            data-offer={offer.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
            onPointerEnter={(event) => event.pointerType === 'mouse' && hold('hover', true)}
            onPointerLeave={(event) => event.pointerType === 'mouse' && hold('hover', false)}
            onPointerDown={(event) => event.pointerType !== 'mouse' && hold('press', true)}
            onPointerUp={(event) => event.pointerType !== 'mouse' && hold('press', false)}
            onPointerCancel={() => hold('press', false)}
            onFocus={() => hold('focus', true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hold('focus', false)
            }}
            className="fixed inset-x-3 bottom-24 z-40 overflow-hidden rounded-2xl border border-l-4 border-acai-800/15 border-l-gold-400 bg-white shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:w-[390px]"
          >
            <div className="flex items-center justify-between gap-2 pt-1.5 pr-1 pl-3">
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-gold-400 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide text-acai-950 uppercase">
                <span aria-hidden="true">{offer.badge.emoji}</span>
                <span className="truncate">{offer.badge.text}</span>
              </span>
              <button
                type="button"
                aria-label="Fechar oferta"
                onClick={(event) => {
                  event.stopPropagation()
                  onDismiss()
                }}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-acai-800 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-acai-800"
              >
                <Close className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onAccept(offer)}
              className="flex w-full cursor-pointer items-start gap-3 px-3 pb-3 text-left focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-acai-800"
            >
              {/* Miniatura da foto do cardápio: enfeite, o nome da oferta está ao lado. */}
              <img
                src={offer.photo.src}
                alt=""
                width={48}
                height={48}
                decoding="async"
                data-offer-photo={offer.photo.fit}
                className={`size-12 shrink-0 rounded-xl bg-white ring-1 ring-line ${offer.photo.fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-tight font-extrabold text-acai-800 sm:text-base">{offer.title}</span>
                <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-soft">{offer.subtitle}</span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="nums leading-tight">
                    {offer.oldPriceText && (
                      <>
                        <span className="sr-only">De </span>
                        <s className="mr-1.5 text-xs text-ink-soft">{offer.oldPriceText}</s>
                        <span className="sr-only"> por </span>
                      </>
                    )}
                    <strong className="text-sm font-black whitespace-nowrap text-acai-800">{offer.priceText}</strong>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-acai-800 px-3 py-1.5 text-xs font-bold text-white">
                    Aproveitar
                    <ArrowRight className="size-3.5" />
                  </span>
                </span>
              </span>
            </button>

            {/* Barra de tempo: some para quem pediu menos movimento no aparelho. */}
            <div aria-hidden="true" className="h-1 bg-gold-100 motion-reduce:hidden">
              <div ref={bar} data-offer-bar className="h-full origin-left bg-gold-400" />
            </div>
          </m.aside>
        )}
      </AnimatePresence>

      {snapshot.stopped && !snapshot.blocked && (
        <button
          type="button"
          onClick={onReactivate}
          className="fixed right-3 bottom-24 z-40 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-acai-800 shadow-lift ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 md:right-6 md:bottom-6"
        >
          <Bell className="size-4" />
          Ver ofertas
        </button>
      )}
    </>
  )
}
