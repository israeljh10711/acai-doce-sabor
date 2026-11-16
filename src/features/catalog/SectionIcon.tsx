import type { ComponentType } from 'react'
import {
  Candy,
  Crown,
  CupSoda,
  Gift,
  GlassWater,
  IceCreamBowl,
  IceCreamCone,
  Popsicle,
  Sailboat,
} from '../../components/ui/icons.tsx'
import type { EmblemIcon } from './extras.ts'

const ICONS: Record<EmblemIcon, ComponentType<{ className?: string }>> = {
  crown: Crown,
  iceCreamBowl: IceCreamBowl,
  cupSoda: CupSoda,
  iceCreamCone: IceCreamCone,
  gift: Gift,
  sailboat: Sailboat,
  popsicle: Popsicle,
  glassWater: GlassWater,
  candy: Candy,
}

/**
 * Ícone de uma seção do cardápio (pedido de 2026-11-16: desenhos, não emojis, para aparecer igual
 * em todo celular). É decorativo: o nome da seção está sempre ao lado.
 */
export function SectionIcon({ icon, className = 'size-5' }: { icon: EmblemIcon; className?: string }) {
  const Icon = ICONS[icon]
  return <Icon className={className} />
}
