import { m, useReducedMotion } from 'motion/react'
import { type PointerEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Close, ZoomIn, ZoomOut } from '../../components/ui/icons.tsx'
import { ILLUSTRATIVE_NOTICE } from '../catalog/notices.ts'
import { fitSize, zoomScroll, zoomedSize } from './lightboxFit.ts'
import type { LightboxImage } from './lightboxImages.ts'

type Size = { width: number; height: number }

/**
 * Foto ampliada em tela cheia (pedido de 2026-11-16): fundo escuro, nome e preço em cima, a foto
 * no meio (até 92% da largura e 75% da altura da tela) e, embaixo, "Ampliar" (2x) e a descrição.
 * Toque duplo também amplia; ampliada, a foto rola com o dedo e arrasta com o mouse. Fecha no X,
 * no Esc ou num toque no fundo escuro, e o foco volta para quem abriu.
 */
export function ImageLightboxModal({ image, onClose }: { image: LightboxImage | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const photo = useRef<HTMLImageElement>(null)
  const reduceMotion = useReducedMotion()
  const [fit, setFit] = useState<Size | null>(null)
  const [zoomed, setZoomed] = useState(false)
  // Ponto tocado (frações da foto) para centralizar depois de ampliar.
  const pendingPoint = useRef<{ x: number; y: number } | null>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)

  // Abre e fecha a janela com a foto; trava a rolagem da página enquanto ela está aberta.
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (image && !element.open) {
      element.showModal()
      document.documentElement.style.overflow = 'hidden'
    } else if (!image && element.open) {
      element.close()
    }
  }, [image])

  // Nova foto: volta para 1x e mede de novo quando ela carregar.
  const [shownSrc, setShownSrc] = useState<string | null>(null)
  if ((image?.src ?? null) !== shownSrc) {
    setShownSrc(image?.src ?? null)
    setZoomed(false)
    setFit(null)
  }

  // Tamanho da foto, medido só na primeira carga. As cópias do srcset têm a mesma proporção, mas o
  // tamanho que o navegador informa muda com o `sizes` (que muda ao ampliar) e vem arredondado:
  // medir de novo a cada troca de cópia deixava a foto em pé 1 ou 2 px fora do dobro.
  const natural = useRef<{ src: string; size: Size } | null>(null)

  const measure = () => {
    const element = photo.current
    if (!element?.naturalWidth || !image) return
    if (natural.current?.src !== image.src) {
      natural.current = { src: image.src, size: { width: element.naturalWidth, height: element.naturalHeight } }
    }
    const { size } = natural.current
    const next = fitSize(size, { width: window.innerWidth, height: window.innerHeight }, image.width ?? size.width)
    // Mesmo tamanho: nada muda (assim a troca de cópia não tira do lugar a foto já ampliada).
    setFit((current) => (current?.width === next.width && current.height === next.height ? current : next))
  }

  // Girar o celular ou mudar o tamanho da janela recalcula o tamanho da foto.
  useEffect(() => {
    if (!image) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })

  useLayoutEffect(() => {
    const view = scroller.current
    if (!view || !fit) return
    if (zoomed) {
      const target = zoomScroll(zoomedSize(fit), { width: view.clientWidth, height: view.clientHeight }, pendingPoint.current ?? undefined)
      view.scrollLeft = target.left
      view.scrollTop = target.top
    }
    pendingPoint.current = null
  }, [zoomed, fit])

  const toggleZoom = (point?: { x: number; y: number }) => {
    if (!fit) return
    pendingPoint.current = point ?? null
    setZoomed((value) => !value)
  }

  const close = () => dialog.current?.close()

  const size = fit && (zoomed ? zoomedSize(fit) : fit)

  const onPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!zoomed || event.pointerType !== 'mouse' || !scroller.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, left: scroller.current.scrollLeft, top: scroller.current.scrollTop }
  }
  const onPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const start = drag.current
    if (!start || !scroller.current) return
    scroller.current.scrollLeft = start.left - (event.clientX - start.x)
    scroller.current.scrollTop = start.top - (event.clientY - start.y)
  }
  const endDrag = () => {
    drag.current = null
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="foto-ampliada-titulo"
      data-lightbox={image?.id}
      onClose={() => {
        document.documentElement.style.overflow = ''
        onClose()
      }}
      // Toque no fundo escuro (fora da foto, do nome e dos botões) fecha.
      onClick={(event) => {
        if ((event.target as HTMLElement).dataset.lightboxBackdrop !== undefined) close()
      }}
      className="m-0 size-full max-h-none max-w-none overflow-hidden overscroll-contain bg-black/90 p-0 text-white backdrop-blur-sm backdrop:bg-transparent"
    >
      {image && (
        <m.div
          key={image.id}
          data-lightbox-backdrop=""
          initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex size-full flex-col items-center justify-center gap-3 px-4 py-4"
        >
          <div className="flex w-full max-w-[min(92vw,42rem)] items-center gap-3">
            <h2 id="foto-ampliada-titulo" className="min-w-0 flex-1 font-display text-lg leading-tight font-black text-balance sm:text-xl">
              {image.title}
            </h2>
            {image.price && (
              <span className="nums shrink-0 rounded-full bg-orchid-400 px-3 py-1 text-sm font-extrabold whitespace-nowrap text-acai-950">
                {image.price}
              </span>
            )}
            <button
              type="button"
              aria-label="Fechar imagem"
              onClick={close}
              className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orchid-400"
            >
              <Close className="size-5" />
            </button>
          </div>

          <div
            ref={scroller}
            data-lightbox-view=""
            className={`max-h-[75vh] max-w-[92vw] overscroll-contain rounded-2xl shadow-2xl ${zoomed ? 'overflow-auto' : 'overflow-hidden'}`}
          >
            <img
              ref={photo}
              src={image.src}
              srcSet={image.srcSet}
              sizes={size ? `${size.width}px` : '92vw'}
              alt={image.alt}
              decoding="async"
              draggable={false}
              onLoad={measure}
              onDoubleClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect()
                toggleZoom({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height })
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={size ? { width: size.width, height: size.height } : undefined}
              className={`block rounded-2xl bg-white object-contain select-none ${
                size ? 'max-w-none' : 'max-h-[75vh] max-w-[92vw] opacity-0'
              } ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
            />
          </div>

          <button
            type="button"
            onClick={() => toggleZoom()}
            disabled={!fit}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-acai-800 transition hover:bg-orchid-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orchid-400 disabled:opacity-60"
          >
            {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
            {zoomed ? 'Reduzir' : 'Ampliar'}
          </button>

          <div data-lightbox-backdrop="" className="max-w-[min(92vw,42rem)] text-center text-sm leading-snug">
            {image.description && <p className="text-white">{image.description}</p>}
            <p className="mt-1 text-xs text-white/75">
              {ILLUSTRATIVE_NOTICE} Toque duas vezes na foto para {zoomed ? 'reduzir' : 'ampliar'}.
            </p>
          </div>
        </m.div>
      )}
    </dialog>
  )
}
