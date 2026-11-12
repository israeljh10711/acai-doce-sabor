/**
 * Miniaturas dos ingredientes, para os cartões dos personalizadores: cada ingrediente numa
 * tigelinha, renderizado no Blender com os mesmos modelos 3D do site
 * (assets/blender/scripts/miniaturas.py). Nenhuma foto de terceiros.
 */
const images = import.meta.glob<string>('../../assets/ingredientes/*.webp', { eager: true, import: 'default' })

export function toppingImage(id: string): string | undefined {
  return images[`../../assets/ingredientes/${id}.webp`]
}
