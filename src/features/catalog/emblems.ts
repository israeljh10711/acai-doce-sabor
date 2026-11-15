/**
 * Emblema dos itens sem foto (ícone e selo) e se um produto do personalizador tem foto.
 */
import { findCategoryBySlug } from './categories.ts'
import { type EmblemIcon, type ExtraItem, drawerById, extraForProduct } from './extras.ts'
import type { ExtraProductSlug, ProductSlug } from './menu.ts'

export type Emblem = { icon: EmblemIcon; seal: string; tone: 'acai' | 'gold' }

/** Ícone e selo do item: os dele, ou os da gaveta. Ofertas (selo ou preço riscado) em dourado. */
export function emblemOf(item: ExtraItem): Emblem {
  const drawer = drawerById(item.drawer)
  return {
    icon: item.icon ?? drawer.icon,
    seal: item.seal ?? drawer.seal,
    tone: item.badge || item.originalPriceCents ? 'gold' : 'acai',
  }
}

/** O produto tem foto de verdade (para mostrar "Ver foto" e o aviso de imagem ilustrativa). */
export function hasProductPhoto(slug: ProductSlug): boolean {
  return findCategoryBySlug(slug) !== undefined || extraForProduct(slug as ExtraProductSlug).image !== null
}
