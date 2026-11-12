import { AnimatePresence, m } from 'motion/react'
import { useId, useMemo } from 'react'
import { type IllustrationInput, composeIllustration } from './compose.ts'
import { CX, GROUND, geometryOf, sceneScale } from './geometry.ts'
import {
  ContainerBack,
  ContainerFront,
  EmptyContainer,
  Gradients,
  GroundShadow,
  type Ids,
  ToppingArt,
} from './parts.tsx'

type ProductIllustrationProps = IllustrationInput & {
  /** Descrição para leitores de tela. Ignorada quando `decorative`. */
  title: string
  /** Use quando o texto ao lado já descreve o produto, como dentro de um link. */
  decorative?: boolean
  className?: string
  /** Falso quando a ilustração já deve aparecer pronta, sem animar a entrada. */
  animateEntrance?: boolean
}

/**
 * Ilustração 2D do produto montado. Desenha somente o que foi escolhido:
 * a lista de camadas vem de `composeIllustration`.
 */
export function ProductIllustration({
  title,
  decorative = false,
  className,
  animateEntrance = true,
  ...input
}: ProductIllustrationProps) {
  const illustration = useMemo(
    () => composeIllustration(input),
    // A escolha muda por inteiro a cada ação; comparar os campos basta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [input.slug, input.sizeId, input.flavorId, input.toppings],
  )
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const ids: Ids = {
    shadow: `${rawId}-shadow`,
    plastic: `${rawId}-plastic`,
    foam: `${rawId}-foam`,
    liquid: `${rawId}-liquid`,
  }

  const g = geometryOf(illustration.shape)
  const scale = sceneScale(illustration.shape)
  const sceneKey = illustration.empty ? 'vazio' : `${input.sizeId}-${input.flavorId ?? ''}`

  return (
    <svg
      // Enquadramento: cobre do topo do copo mais alto, com os ingredientes, até a sombra.
      viewBox="26 34 188 192"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative || undefined}
      className={className}
      data-size={input.sizeId ?? undefined}
      data-empty={illustration.empty || undefined}
    >
      <Gradients ids={ids} base={illustration.base} />
      <g transform={`translate(${CX} ${GROUND}) scale(${scale}) translate(${-CX} ${-GROUND})`}>
        <m.g
          key={sceneKey}
          initial={animateEntrance ? { opacity: 0, y: 6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <GroundShadow g={g} ids={ids} />
          {illustration.empty || !illustration.base ? (
            <EmptyContainer g={g} />
          ) : (
            <>
              <ContainerBack g={g} base={illustration.base} ids={ids} />
              <AnimatePresence initial={animateEntrance}>
                {illustration.layers.map((layer) => (
                  <m.g
                    key={layer.toppingId}
                    data-topping={layer.toppingId}
                    data-quantity={layer.quantity}
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  >
                    <ToppingArt
                      g={g}
                      look={layer.look}
                      quantity={layer.quantity}
                      seed={layer.toppingId}
                    />
                  </m.g>
                ))}
              </AnimatePresence>
              <ContainerFront g={g} ids={ids} />
            </>
          )}
        </m.g>
      </g>
    </svg>
  )
}
