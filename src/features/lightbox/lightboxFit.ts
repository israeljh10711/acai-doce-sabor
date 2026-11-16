/**
 * Contas da foto ampliada, sem React (testadas em `lightboxFit.test.ts`).
 */

/** Espaço da foto na tela: 92% da largura e 75% da altura (pedido de 2026-11-16). */
export const LIGHTBOX_AREA = { width: 0.92, height: 0.75 } as const

/** O botão "Ampliar" e o toque duplo alternam entre 1x e 2x. */
export const ZOOM_SCALE = 2

/** Uma foto nunca aparece maior que o dobro da largura real dela (ficaria borrada). */
export const MAX_UPSCALE = 2

type Size = { width: number; height: number }

/**
 * Tamanho da foto sem zoom: o maior que cabe na área, mantendo a proporção da foto, até o dobro
 * da largura real (`realWidth`, quando o arquivo carregado é uma cópia de outro tamanho).
 */
export function fitSize(natural: Size, screen: Size, realWidth: number = natural.width): Size {
  const ratio = natural.height / natural.width
  const width = Math.min(screen.width * LIGHTBOX_AREA.width, (screen.height * LIGHTBOX_AREA.height) / ratio, realWidth * MAX_UPSCALE)
  return { width: Math.round(width), height: Math.round(width * ratio) }
}

/** Tamanho ampliado (2x). */
export const zoomedSize = (fit: Size): Size => ({ width: fit.width * ZOOM_SCALE, height: fit.height * ZOOM_SCALE })

/**
 * Rolagem da área ampliada que deixa no centro o ponto tocado (`point`, em frações da foto: 0 a 1).
 * Sem ponto (botão "Ampliar"), o centro da foto.
 */
export function zoomScroll(zoomed: Size, view: Size, point: { x: number; y: number } = { x: 0.5, y: 0.5 }): { left: number; top: number } {
  const clamp = (value: number, max: number) => Math.round(Math.min(Math.max(value, 0), Math.max(max, 0)))
  return {
    left: clamp(point.x * zoomed.width - view.width / 2, zoomed.width - view.width),
    top: clamp(point.y * zoomed.height - view.height / 2, zoomed.height - view.height),
  }
}
