import { AnimatePresence, m } from 'motion/react'
import { type CSSProperties, useId, useMemo } from 'react'
import { type ComposerInput, type PlacedImage, composeLayers } from './layout.ts'
import { Depth, TiltStage } from './TiltStage.tsx'
import { SURFACES, image } from './visuals.ts'

type ProductPhotoComposerProps = ComposerInput & {
  className?: string
  /** Inclina com o ponteiro ou o dedo. */
  tilt?: boolean
  /** Imagens da primeira dobra: carregar já, sem esperar a rolagem. */
  priority?: boolean
}

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
const pop = {
  initial: { opacity: 0, scale: 0.7 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.7 },
  transition: { type: 'spring', stiffness: 320, damping: 24 },
} as const

const pct = (value: number) => `${(value * 100).toFixed(2)}%`

/**
 * Foto do pedido montada em camadas, vista de cima: recipiente, açaí (ou batido, ou milk-shake),
 * ingredientes em setores, peças soltas, cremes, caldas e peças inteiras por cima.
 * As camadas vêm de `composeLayers`: só o que o cliente escolheu.
 * Decorativa (`aria-hidden`): quem usa descreve o pedido em texto ao lado.
 */
export function ProductPhotoComposer({
  slug,
  sizeId,
  flavorId,
  toppings,
  className = '',
  tilt = false,
  priority = false,
}: ProductPhotoComposerProps) {
  const composition = useMemo(
    () => composeLayers({ slug, sizeId, flavorId, toppings }),
    [slug, sizeId, flavorId, toppings],
  )
  const uid = useId().replace(/:/g, '')
  const { container, surface } = composition
  const surfaceInset = pct((1 - container.surface) / 2)
  const loading = priority ? 'eager' : 'lazy'

  return (
    <div
      aria-hidden="true"
      data-composer=""
      data-container={container.kind}
      data-empty={composition.empty ? '' : undefined}
      className={`relative aspect-square select-none ${className}`}
    >
      <TiltStage enabled={tilt}>
        <div className="absolute inset-0 grid place-items-center">
          <m.div
            className="composer-box relative aspect-square w-full"
            initial={false}
            animate={{ scale: container.scale }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          >
            <ContainerBack kind={container.kind} loading={loading} surface={surface} />

            <Depth depth={0.5} className="absolute" style={{ inset: surfaceInset }}>
              <div className="composer-surface absolute inset-0 overflow-hidden rounded-full" data-surface={surface.kind}>
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: `url(${SURFACES[surface.kind].src})`, backgroundSize: pct(SURFACES[surface.kind].scale) }}
                />
                {surface.tint && (
                  <>
                    <div className="absolute inset-0 mix-blend-multiply" style={{ backgroundColor: surface.tint }} />
                    <div className="absolute inset-0 opacity-40 mix-blend-soft-light" style={{ backgroundColor: surface.tint }} />
                  </>
                )}

                <div className="composer-lift absolute inset-0">
                  <AnimatePresence>
                    {composition.sectors.map((sector) => (
                      <m.div
                        key={sector.id}
                        data-layer="sector"
                        data-topping={sector.toppingId}
                        className="composer-sector"
                        style={
                          {
                            '--sector-start': `${sector.start}deg`,
                            '--sector-sweep': `${sector.sweep}deg`,
                            backgroundImage: sector.src ? `url(${sector.src})` : undefined,
                            backgroundSize: sector.src ? pct(sector.scale) : undefined,
                          } as CSSProperties
                        }
                        {...fade}
                      />
                    ))}
                    {composition.patches.map((patch) => (
                      <m.div
                        key={patch.id}
                        data-layer="patch"
                        data-topping={patch.toppingId}
                        className="composer-patch"
                        style={{
                          left: pct(patch.x),
                          top: pct(patch.y),
                          width: pct(patch.size),
                          backgroundImage: `url(${patch.src})`,
                          backgroundSize: pct(patch.scale / patch.size),
                        }}
                        {...pop}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                <AnimatePresence>
                  {composition.scatter.map((piece) => (
                    <Piece key={piece.id} piece={piece} layer="scatter" loading={loading} />
                  ))}
                  {composition.dollops.map((dollop) => (
                    <m.div
                      key={dollop.id}
                      data-layer="dollop"
                      data-topping={dollop.toppingId}
                      className="composer-dollop"
                      style={{ left: pct(dollop.x), top: pct(dollop.y), width: pct(dollop.size) }}
                      {...pop}
                    >
                      <div className="composer-dollop-cream" style={{ backgroundImage: `url(${dollop.src})` }} />
                    </m.div>
                  ))}
                </AnimatePresence>

                <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
                  <defs>
                    <filter id={`${uid}-sombra`} x="-5%" y="-5%" width="110%" height="110%">
                      <feGaussianBlur stdDeviation="0.6" />
                    </filter>
                  </defs>
                  <AnimatePresence>
                    {composition.drizzles.map((drizzle) => (
                      <m.g key={drizzle.id} data-layer="drizzle" data-topping={drizzle.toppingId} {...fade}>
                        <path
                          d={drizzle.d}
                          fill="none"
                          stroke={drizzle.shade}
                          strokeWidth={drizzle.width + 0.9}
                          strokeLinecap="round"
                          opacity={0.6}
                          filter={`url(#${uid}-sombra)`}
                          transform="translate(0.5 1)"
                        />
                        <m.path
                          d={drizzle.d}
                          fill="none"
                          stroke={drizzle.color}
                          strokeWidth={drizzle.width}
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.9, ease: 'easeOut' }}
                        />
                        <path
                          d={drizzle.d}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={drizzle.width * 0.28}
                          strokeLinecap="round"
                          opacity={0.55}
                          transform="translate(-0.35 -0.45)"
                        />
                      </m.g>
                    ))}
                  </AnimatePresence>
                </svg>

                <div className="composer-gloss" />
              </div>
            </Depth>

            <ContainerFront kind={container.kind} />

            {/* Peças inteiras (cereja, Kit Kat, BIS, canudinho) podem passar da borda. */}
            <Depth depth={1.2} className="pointer-events-none absolute" style={{ inset: surfaceInset }}>
              <AnimatePresence>
                {composition.pieces.map((piece) => (
                  <Piece key={piece.id} piece={piece} layer="piece" loading={loading} />
                ))}
              </AnimatePresence>
            </Depth>
          </m.div>
        </div>
      </TiltStage>
    </div>
  )
}

function Piece({ piece, layer, loading }: { piece: PlacedImage; layer: string; loading: 'eager' | 'lazy' }) {
  const position = { left: pct(piece.x), top: pct(piece.y) }
  return (
    <m.img
      src={piece.src}
      alt=""
      draggable={false}
      loading={loading}
      decoding="async"
      data-layer={layer}
      data-topping={piece.toppingId}
      className="composer-piece"
      style={{ ...position, width: pct(piece.size * Math.min(1, piece.aspect)), aspectRatio: piece.aspect, rotate: piece.rotate }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1, ...position }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
    />
  )
}

function ContainerBack({
  kind,
  loading,
  surface,
}: {
  kind: string
  loading: 'eager' | 'lazy'
  surface: { kind: keyof typeof SURFACES; tint: string | null }
}) {
  if (kind === 'copo') {
    // Copo transparente: a parede deixa ver o que está dentro, mais claro e embaçado.
    return (
      <div
        className="composer-base composer-base-copo"
        style={{
          backgroundImage: `url(${SURFACES[surface.kind].src})`,
          backgroundSize: pct(SURFACES[surface.kind].scale * 0.94),
          backgroundColor: surface.tint ?? undefined,
          backgroundBlendMode: surface.tint ? 'multiply' : undefined,
        }}
      />
    )
  }
  if (kind === 'isopor') {
    return (
      <img
        src={image('containers/isopor.webp')}
        alt=""
        draggable={false}
        loading={loading}
        decoding="async"
        width={1024}
        height={1024}
        className="composer-isopor absolute inset-0 size-full"
      />
    )
  }
  return <div className={`composer-base composer-base-${kind}`} />
}

function ContainerFront({ kind }: { kind: string }) {
  return <div className={`composer-rim composer-rim-${kind}`} />
}
