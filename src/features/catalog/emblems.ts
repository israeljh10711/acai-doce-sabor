/**
 * Emblema de cada gaveta (ícone e selo), no botão que abre a gaveta. Os itens têm foto desde
 * 2026-11-15; o emblema ficou só nas gavetas.
 */
import type { Drawer, EmblemIcon } from './extras.ts'

export type Emblem = { icon: EmblemIcon; seal: string; tone: 'acai' | 'gold' }

export const drawerEmblem = (drawer: Drawer): Emblem => ({ icon: drawer.icon, seal: drawer.seal, tone: 'acai' })
