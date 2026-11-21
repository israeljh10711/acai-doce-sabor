/**
 * Ícone de cada um dos 4 produtos principais na navegação do cardápio (barra lateral, menu do
 * celular e botões da barra fixa). As 5 seções do catálogo têm o ícone em `DRAWERS` (`extras.ts`).
 */
import type { CategorySlug } from './categories.ts'
import type { EmblemIcon } from './extras.ts'

export const CATEGORY_ICONS: Readonly<Partial<Record<CategorySlug, EmblemIcon>>> = {
  'acai-oca': 'crown',
  'acai-tradicional': 'iceCreamBowl',
  'acai-batido': 'cupSoda',
  'milk-shake': 'iceCreamCone',
}
