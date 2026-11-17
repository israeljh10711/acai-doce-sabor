/**
 * Disponibilidade dos produtos do personalizador (esgotado em 1 toque, pedido de 2026-11-17).
 * Os 4 produtos principais têm o próprio "disponível/esgotado"; o Pote 1 L Montado e a Barca
 * seguem o item da seção que abre o personalizador deles.
 */
import { EXTRA_ITEMS } from './extras.ts'
import { PRODUCTS, type ProductSlug } from './menu.ts'

export function isProductAvailable(slug: ProductSlug): boolean {
  if (PRODUCTS[slug]?.available === false) return false
  return !EXTRA_ITEMS.some((item) => item.action.type === 'customizer' && item.action.product === slug && item.available === false)
}
