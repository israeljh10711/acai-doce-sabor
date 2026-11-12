/**
 * Enquadramento da câmera para cada recipiente. Aproxima os recipientes pequenos, mas não
 * tanto que o pote de 150 ml pareça do tamanho do isopor GG.
 */
import type { CategorySlug } from '../catalog/categories.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { domeGeometry, measuresFor } from './dome.ts'

export const FOV = 30
/** Espaço acima do monte para cereja, canudinho e barras. */
const TOPPING_ROOM = 0.035

function fitDistance(slug: CategorySlug, sizeId: string): { distance: number; targetY: number } {
  const m = measuresFor(slug, sizeId)
  if (!m) throw new Error(`Sem medidas para ${slug} ${sizeId}`)
  const dome = domeGeometry(slug, sizeId)
  const height = dome.top + dome.height + TOPPING_ROOM
  const width = 2 * (m.raioBoca + 0.004)
  const span = Math.max(height, width * 1.1)
  return {
    distance: (span * 0.5 * 1.3) / Math.tan(((FOV / 2) * Math.PI) / 180),
    targetY: height * 0.46,
  }
}

export function framingFor(slug: CategorySlug, sizeId: string): { distance: number; targetY: number } {
  const own = fitDistance(slug, sizeId)
  const largest = Math.max(...PRODUCTS[slug].sizes.map((size) => fitDistance(slug, size.id).distance))
  return { distance: own.distance * (largest / own.distance) ** 0.3, targetY: own.targetY }
}
