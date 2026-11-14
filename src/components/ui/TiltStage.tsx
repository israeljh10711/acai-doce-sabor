import {
  type MotionValue,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'motion/react'
import { type CSSProperties, type PointerEvent, type ReactNode, createContext, useContext } from 'react'

type Tilt = { x: MotionValue<number>; y: MotionValue<number> }

const TiltContext = createContext<Tilt | null>(null)

const SPRING = { stiffness: 140, damping: 18, mass: 0.6 }

/**
 * Palco com profundidade: inclina de leve na direção do ponteiro (mouse ou dedo) e desloca as
 * camadas de `Depth` em velocidades diferentes, como numa foto com relevo.
 * - No toque, só o arraste para os lados inclina; o arraste vertical continua rolando a página.
 * - Quem pediu menos movimento no aparelho vê a foto parada.
 */
export function TiltStage({
  enabled,
  maxDegrees = 7,
  className = 'absolute inset-0',
  children,
}: {
  enabled: boolean
  maxDegrees?: number
  className?: string
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const active = enabled && !reduceMotion
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)
  const x = useSpring(rawX, SPRING)
  const y = useSpring(rawY, SPRING)
  const rotateY = useTransform(x, (value) => value * maxDegrees * 2)
  const rotateX = useTransform(y, (value) => -value * maxDegrees * 2)

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (!active) return
    const box = event.currentTarget.getBoundingClientRect()
    rawX.set(Math.max(-0.5, Math.min(0.5, (event.clientX - box.left) / box.width - 0.5)))
    rawY.set(Math.max(-0.5, Math.min(0.5, (event.clientY - box.top) / box.height - 0.5)))
  }
  const settle = () => {
    rawX.set(0)
    rawY.set(0)
  }

  return (
    <TiltContext.Provider value={active ? { x, y } : null}>
      <div
        className={className}
        style={active ? { perspective: 900, touchAction: 'pan-y' } : undefined}
        onPointerMove={follow}
        onPointerLeave={settle}
        onPointerCancel={settle}
        onPointerUp={(event) => event.pointerType !== 'mouse' && settle()}
      >
        <m.div className="absolute inset-0" style={active ? { rotateX, rotateY } : undefined}>
          {children}
        </m.div>
      </div>
    </TiltContext.Provider>
  )
}

/** Camada que acompanha a inclinação: quanto maior a profundidade, mais ela se desloca. */
export function Depth({
  depth,
  className,
  style,
  children,
}: {
  depth: number
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const tilt = useContext(TiltContext)
  const still = useMotionValue(0)
  const x = useTransform(tilt?.x ?? still, (value) => `${value * depth * 4}%`)
  const y = useTransform(tilt?.y ?? still, (value) => `${value * depth * 4}%`)
  return (
    <m.div className={className} style={tilt ? { ...style, x, y } : style}>
      {children}
    </m.div>
  )
}
