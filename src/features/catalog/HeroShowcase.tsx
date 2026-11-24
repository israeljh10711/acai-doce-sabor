import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { TiltStage } from '../../components/ui/TiltStage.tsx'
import { ArrowLeft, Rotate } from '../../components/ui/icons.tsx'

// Contornos na composição de 600 × 480. A tigela fica à frente dos dois copos.
const products = [
  {
    id: 'oca',
    name: 'Açaí Oca',
    src: '/images/campanha/destaque-oca.webp',
    contour: 'polygon(1% 21%, 8% 12%, 44% 4%, 56% 19%, 57% 31%, 51% 54%, 39% 78%, 27% 84%, 10% 78%, 2% 35%)',
  },
  {
    id: 'milkshake',
    name: 'Milk-shake de chocolate',
    src: '/images/produtos/milkshake-960.webp',
    contour: 'polygon(61% 22%, 65% 8%, 74% 0%, 85% 0%, 93% 7%, 100% 24%, 96% 38%, 92% 76%, 77% 82%, 67% 71%)',
  },
  {
    id: 'tradicional',
    name: 'Açaí Tradicional',
    src: '/images/campanha/destaque-tradicional.webp',
    contour: 'polygon(30% 61%, 35% 52%, 46% 46%, 58% 44%, 70% 47%, 80% 56%, 86% 68%, 85% 79%, 77% 93%, 66% 100%, 49% 100%, 40% 93%, 32% 82%, 29% 72%)',
  },
] as const

type Product = typeof products[number]

export function HeroShowcase() {
  const [selected, setSelected] = useState<Product | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const dragStart = useRef<{ pointer: number; x: number; y: number } | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const back = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const control = selected ? back.current : opener.current
    control?.focus({ preventScroll: true })
  }, [selected])

  function open(product: Product, button: HTMLButtonElement) {
    dragStart.current = null
    opener.current = button
    setLoaded(false)
    setFailed(false)
    setSelected(product)
  }

  function followDrag(event: PointerEvent<HTMLButtonElement>, product: Product) {
    const start = dragStart.current
    if (!start || start.pointer !== event.pointerId) return
    const dx = Math.abs(event.clientX - start.x)
    const dy = Math.abs(event.clientY - start.y)
    if (dy > 12 && dy > dx) dragStart.current = null
    else if (dx > 18 && dx > dy) open(product, event.currentTarget)
  }

  return (
    <div
      className="mx-auto w-full max-w-[34rem]"
      role="group"
      aria-label="Vitrine interativa"
      onKeyDown={(event) => { if (event.key === 'Escape') setSelected(null) }}
    >
      <TiltStage enabled maxDegrees={9} className="relative aspect-5/4 touch-pan-y select-none">
        <img
          src="/images/campanha/acai-e-milkshake-600.webp"
          srcSet="/images/campanha/acai-e-milkshake-600.webp 600w, /images/campanha/acai-e-milkshake-1080.webp 1080w"
          sizes="(min-width: 72rem) 33rem, (min-width: 64rem) 46vw, (min-width: 36rem) 34rem, calc(100vw - 2rem)"
          width={600}
          height={480}
          fetchPriority="high"
          draggable={false}
          alt="Açaí Oca à esquerda, tigela de açaí tradicional à frente e milk-shake de chocolate à direita."
          aria-hidden={selected !== null}
          className={`pointer-events-none block size-full drop-shadow-xl transition-opacity duration-200 ${selected && loaded ? 'opacity-0' : ''}`}
        />
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            hidden={selected !== null}
            aria-label={`Ver ${product.name} inteiro`}
            style={{ clipPath: product.contour }}
            className="absolute inset-0 cursor-zoom-in touch-pan-y hover:bg-white/5 focus-visible:bg-white/25"
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return
              dragStart.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => followDrag(event, product)}
            onPointerUp={() => { dragStart.current = null }}
            onPointerCancel={() => { dragStart.current = null }}
            onClick={(event) => open(product, event.currentTarget)}
          />
        ))}
        {selected && (
          <img
            key={selected.id}
            src={selected.src}
            alt={selected.name}
            draggable={false}
            data-item={selected.id}
            data-ready={loaded}
            onLoad={() => setLoaded(true)}
            onError={() => { setFailed(true); setSelected(null) }}
            className="showcase-detail absolute inset-0 m-auto h-[94%] w-[92%] cursor-grab object-contain drop-shadow-xl active:cursor-grabbing"
          />
        )}
      </TiltStage>
      <div className="mt-3 flex min-h-12 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        {selected ? (
          <>
            <span className="font-bold" role="status">{selected.name}</span>
            <button ref={back} type="button" onClick={() => setSelected(null)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-white/50 px-4 font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2">
              <ArrowLeft className="size-4" /> Ver os três
            </button>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 text-white/90" role="status">
            <Rotate className="size-4" />
            {failed ? 'A foto não carregou. Toque para tentar de novo.' : 'Toque ou arraste um produto para ver de perto.'}
          </span>
        )}
      </div>
    </div>
  )
}
