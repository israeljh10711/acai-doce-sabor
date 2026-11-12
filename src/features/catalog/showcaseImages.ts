/**
 * Imagens de vitrine: renders do Blender (Cycles), feitos com os mesmos modelos e a mesma
 * montagem do personalizador 3D (assets/blender/scripts/vitrine.py). Fundo transparente:
 * a cor de trás vem da página.
 */
import oca480 from '../../assets/showcase/acai-oca-480.webp'
import oca960 from '../../assets/showcase/acai-oca-960.webp'
import tradicional480 from '../../assets/showcase/acai-tradicional-480.webp'
import tradicional960 from '../../assets/showcase/acai-tradicional-960.webp'
import destaque800 from '../../assets/showcase/destaque-800.webp'
import destaque1386 from '../../assets/showcase/destaque-1386.webp'
import shake480 from '../../assets/showcase/milk-shake-480.webp'
import shake960 from '../../assets/showcase/milk-shake-960.webp'
import type { CategorySlug } from './categories.ts'

/** Proporção dos renders dos cartões (largura x altura). */
export const SHOWCASE_SIZE = { width: 960, height: 720 }

export const SHOWCASE_IMAGES: Readonly<Record<CategorySlug, { src: string; srcSet: string }>> = {
  'acai-oca': { src: oca480, srcSet: `${oca480} 480w, ${oca960} 960w` },
  'acai-tradicional': { src: tradicional480, srcSet: `${tradicional480} 480w, ${tradicional960} 960w` },
  'milk-shake': { src: shake480, srcSet: `${shake480} 480w, ${shake960} 960w` },
}

/** Os três produtos juntos, no destaque do topo da página inicial. */
export const HERO_IMAGE = {
  src: destaque800,
  srcSet: `${destaque800} 800w, ${destaque1386} 1386w`,
  width: 1386,
  height: 948,
  alt: 'Ilustração de açaí no copo com camadas de creme, açaí no isopor com adicionais e milk-shake de morango',
}
