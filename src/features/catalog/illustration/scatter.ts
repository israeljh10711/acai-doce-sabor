/**
 * Espalha pontos dentro de uma elipse, sempre do mesmo jeito para a mesma semente.
 * Serve para posicionar granola, paçoca e outros pedaços sobre o açaí: a mesma
 * escolha desenha sempre a mesma montagem, sem pedaços amontoados.
 */

export type Point = {
  x: number
  y: number
  /** Rotação em graus, de 0 a 359. */
  r: number
}

export type Ellipse = { cx: number; cy: number; rx: number; ry: number }

/** Número pseudoaleatório entre 0 (incluso) e 1 (exclusivo), a partir de um texto. */
export function seededRandom(seed: string): () => number {
  // FNV-1a para virar o texto em número; mulberry32 para a sequência.
  let state = 2166136261
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i)
    state = Math.imul(state, 16777619)
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export function scatter(seed: string, count: number, area: Ellipse): Point[] {
  const random = seededRandom(seed)
  const offset = random() * Math.PI * 2
  const points: Point[] = []

  // Espiral de girassol com um pouco de variação: cobre a área por igual.
  for (let i = 0; i < count; i++) {
    const distance = Math.sqrt((i + random()) / count)
    const angle = offset + i * GOLDEN_ANGLE + (random() - 0.5) * 0.6
    points.push({
      x: area.cx + area.rx * distance * Math.cos(angle),
      y: area.cy + area.ry * distance * Math.sin(angle),
      r: Math.floor(random() * 360),
    })
  }
  return points
}
