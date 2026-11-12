/**
 * Medidas da cena da ilustração, no espaço de 240 x 240, com o recipiente apoiado em GROUND.
 */
import type { ContainerShape } from './looks.ts'
import type { Ellipse } from './scatter.ts'

export const CX = 120
export const GROUND = 214

export type Geometry = {
  shape: ContainerShape
  rimY: number
  /** Altura do monte de açaí (ou da espuma do milk-shake) acima da borda. */
  domeH: number
  /** Inclinação da borda: altura da elipse da boca. */
  rimRy: number
  /** Área de cima do monte, onde os ingredientes ficam. */
  surface: Ellipse
}

export function geometryOf(shape: ContainerShape): Geometry {
  const rimY = GROUND - shape.height
  const domeH = shape.top * (shape.kind === 'shake' ? 0.3 : 0.6)
  return {
    shape,
    rimY,
    domeH,
    rimRy: shape.top * 0.2,
    surface: { cx: CX, cy: rimY - domeH * 0.42, rx: shape.top * 0.7, ry: Math.max(domeH * 0.42, 5) },
  }
}

/** Escala da cena: aproxima os potes pequenos sem apagar a diferença de tamanho. */
export function sceneScale(shape: ContainerShape): number {
  const total = shape.height + shape.top * 0.6
  return Math.min(1.5, Math.max(1, Math.sqrt(150 / total)))
}
