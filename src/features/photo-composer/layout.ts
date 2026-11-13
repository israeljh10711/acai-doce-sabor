/**
 * Montagem da foto do pedido, vista de cima: decide as camadas a partir das escolhas.
 *
 * Função pura e determinística: a mesma escolha gera sempre a mesma foto. Só entram os
 * ingredientes escolhidos, na ordem em que foram escolhidos, e todos eles aparecem.
 *
 * Coordenadas: `x` e `y` vão de 0 a 1 dentro do círculo do açaí (0,5 é o centro); tamanhos são
 * frações do diâmetro do açaí; ângulos seguem o CSS (0° em cima, sentido horário).
 */
import type { CategorySlug } from '../catalog/categories.ts'
import { type ContainerKind, PRODUCTS, getTopping } from '../catalog/menu.ts'
import {
  BATIDO_FLAVOR_TOPPINGS,
  CONTAINERS,
  SHAKE_COLORS,
  SIZE_SCALE,
  SPRITES,
  SURFACE_OF,
  type SpriteName,
  type SurfaceKind,
  TOPPING_VISUALS,
  type ToppingVisual,
  lookOf,
} from './visuals.ts'

export type ComposerInput = {
  slug: CategorySlug
  sizeId: string | null
  flavorId: string | null
  toppings: Readonly<Record<string, number>>
}

export type SectorLayer = {
  id: string
  toppingId: string
  start: number
  sweep: number
  src: string | null
  scale: number
}
export type PlacedImage = {
  id: string
  toppingId: string
  src: string
  x: number
  y: number
  size: number
  aspect: number
  rotate: number
}
export type PatchLayer = { id: string; toppingId: string; src: string; scale: number; x: number; y: number; size: number }
export type DollopLayer = { id: string; toppingId: string; src: string; x: number; y: number; size: number }
export type DrizzleLayer = { id: string; toppingId: string; color: string; shade: string; d: string; width: number }

export type Composition = {
  container: { kind: ContainerKind; scale: number; surface: number }
  surface: { kind: SurfaceKind; tint: string | null }
  /** Nenhum tamanho escolhido: recipiente sem complementos. */
  empty: boolean
  sectors: SectorLayer[]
  scatter: PlacedImage[]
  patches: PatchLayer[]
  dollops: DollopLayer[]
  pieces: PlacedImage[]
  drizzles: DrizzleLayer[]
  /** Ingredientes presentes na foto, na ordem em que foram escolhidos. */
  shown: string[]
}

/** Prefixo dos complementos que vêm do sabor do batido (não são ingredientes escolhidos). */
export const FLAVOR_PREFIX = 'sabor:'

type Entry = { toppingId: string; visual: ToppingVisual; quantity: number }

/* ---------- Números pseudoaleatórios estáveis ---------- */

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Sequência de Halton: pontos bem espalhados, sem amontoar. */
function halton(index: number, base: number): number {
  let result = 0
  let fraction = 1 / base
  let i = index
  while (i > 0) {
    result += fraction * (i % base)
    i = Math.floor(i / base)
    fraction /= base
  }
  return result
}

const round = (value: number, digits = 4) => Number(value.toFixed(digits))

/** Ponto dentro do círculo do açaí: ângulo CSS (graus) e raio (0 no centro, 1 na borda). */
function polar(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180
  return { x: round(0.5 + 0.5 * radius * Math.sin(rad)), y: round(0.5 - 0.5 * radius * Math.cos(rad)) }
}

/* ---------- Setores ---------- */

/** Quanto do açaí os setores cobrem: um ingrediente cobre uma parte; quatro ou mais, tudo. */
export function sectorCoverage(count: number): number {
  return count === 0 ? 0 : Math.min(360, 140 + 75 * (count - 1))
}

const FIRST_SECTOR_AT = 300

function sectorsFor(entries: Entry[]) {
  const weights = entries.map((entry) => Math.min(3, entry.quantity))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const coverage = sectorCoverage(entries.length)
  let start = FIRST_SECTOR_AT
  return entries.map((entry, index) => {
    const sweep = (coverage * weights[index]) / total
    const sector = { entry, start: round(start % 360, 3), sweep: round(sweep, 3) }
    start += sweep
    return sector
  })
}

function scatterIn(entry: Entry, sprite: SpriteName, size: number, perTurn: number, start: number, sweep: number): PlacedImage[] {
  const sprites = SPRITES[sprite]
  const seed = hash(entry.toppingId) % 97
  const count = Math.max(4, Math.min(22, Math.round((perTurn * sweep) / 360)))
  const pad = Math.min(8, sweep / 6)
  const placed: PlacedImage[] = []
  for (let i = 0; i < count; i++) {
    const u = halton(i + 1 + seed, 2)
    const v = halton(i + 1 + seed, 3)
    const angle = start + pad + u * (sweep - 2 * pad)
    // Mais peças longe do centro: o espaço do setor cresce com o raio.
    const radius = Math.sqrt(0.04 + v * (0.74 - 0.04))
    const { x, y } = polar(angle, radius)
    const piece = sprites[i % sprites.length]
    placed.push({
      id: `${entry.toppingId}-${i}`,
      toppingId: entry.toppingId,
      src: piece.src,
      x,
      y,
      size: round(size * (0.88 + 0.24 * halton(i + 7, 5))),
      aspect: piece.aspect,
      rotate: Math.round(halton(i + seed + 3, 7) * 360),
    })
  }
  // Quem está mais embaixo na foto fica por cima.
  return placed.sort((a, b) => a.y - b.y)
}

/* ---------- Peças inteiras e cremes ---------- */

/** Lugares das peças inteiras: [ângulo, raio, rotação extra]. */
const PIECE_SLOTS: Readonly<Record<string, readonly [number, number, number][]>> = {
  cereja: [
    [0, 0, 0],
    [150, 0.3, 40],
    [270, 0.3, -30],
  ],
  'kit-kat': [
    [60, 0.48, 100],
    [240, 0.48, 100],
    [150, 0.5, 100],
  ],
  bis: [
    [110, 0.46, 75],
    [290, 0.46, 75],
    [20, 0.5, 75],
  ],
  canudinho: [
    [35, 0.5, 0],
    [215, 0.5, 0],
    [125, 0.52, 0],
  ],
}

function piecesFor(entry: Entry, sprite: SpriteName, size: number): PlacedImage[] {
  const slots = PIECE_SLOTS[sprite] ?? PIECE_SLOTS.cereja
  const sprites = SPRITES[sprite]
  return slots.slice(0, Math.min(3, entry.quantity)).map(([angle, radius, extra], index) => {
    const { x, y } = polar(angle, radius)
    const piece = sprites[index % sprites.length]
    return {
      id: `${entry.toppingId}-${index}`,
      toppingId: entry.toppingId,
      src: piece.src,
      x,
      y,
      size,
      aspect: piece.aspect,
      // Peças compridas acompanham a direção do raio; a cereja só gira um pouco.
      rotate: Math.round(sprite === 'cereja' ? extra : angle + extra),
    }
  })
}

/* ---------- Caldas ---------- */

/**
 * Fio de calda: duas levas de passadas onduladas que se cruzam, como a calda despejada de um
 * lado para o outro. As voltas ficam fora do círculo (o recorte do açaí as esconde), então
 * dentro só aparecem as passadas. Devolve um caminho SVG na caixa 0–100.
 */
export function drizzlePath(seed: string, angle: number): string {
  const base = hash(seed) % 89
  const reach = 1.22
  const f = (n: number) => n.toFixed(2)
  const sets: [number, number, number][] = [
    [angle, 4, 0.62],
    [angle + 32, 3, 0.5],
  ]
  let d = ''
  let k = 0
  for (const [setAngle, passes, spread] of sets) {
    const rad = (setAngle * Math.PI) / 180
    const dir = { x: Math.cos(rad), y: Math.sin(rad) }
    const perp = { x: -dir.y, y: dir.x }
    const at = (t: number, o: number) => ({ x: 50 + 50 * (t * dir.x + o * perp.x), y: 50 + 50 * (t * dir.y + o * perp.y) })
    for (let i = 0; i < passes; i++, k++) {
      const offset = -spread + (2 * spread * i) / (passes - 1) + (halton(k + 1 + base, 3) - 0.5) * 0.18
      const skew = (halton(k + 2 + base, 5) - 0.5) * 0.34
      const wave = (0.05 + 0.07 * halton(k + 3 + base, 7)) * (k % 2 === 0 ? 1 : -1)
      const [t0, t1] = i % 2 === 0 ? [-reach, reach] : [reach, -reach]
      const points = [0, 1, 2, 3].map((step) =>
        at(t0 + ((t1 - t0) * step) / 3, offset + (skew * step) / 3 + (step === 1 ? wave : step === 2 ? -wave : 0)),
      )
      d += `${i === 0 ? 'M' : 'L'}${f(points[0].x)} ${f(points[0].y)} `
      // Catmull-Rom pelos quatro pontos, em curvas de Bézier.
      for (let j = 0; j < 3; j++) {
        const p0 = points[Math.max(0, j - 1)]
        const p1 = points[j]
        const p2 = points[j + 1]
        const p3 = points[Math.min(3, j + 2)]
        d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)} `
      }
    }
  }
  return d.trim()
}

/* ---------- Montagem ---------- */

export function composeLayers({ slug, sizeId, flavorId, toppings }: ComposerInput): Composition {
  const product = PRODUCTS[slug]
  const size = product.sizes.find((candidate) => candidate.id === sizeId)
  const kind = size?.container ?? product.sizes[0].container
  const surfaceKind = SURFACE_OF[slug]
  const isDrink = surfaceKind !== 'acai'

  const entries: Entry[] = []
  // Sabor do batido: o que ele leva por cima (leite condensado, amendoim ou paçoca).
  if (slug === 'acai-batido' && flavorId) {
    for (const look of BATIDO_FLAVOR_TOPPINGS[flavorId] ?? []) {
      entries.push({ toppingId: `${FLAVOR_PREFIX}${look}`, visual: TOPPING_VISUALS[look], quantity: 1 })
    }
  }
  if (size) {
    for (const [toppingId, quantity] of Object.entries(toppings)) {
      const topping = getTopping(toppingId)
      if (!topping || !product.groups.includes(topping.group) || !(quantity > 0)) continue
      const visual = TOPPING_VISUALS[lookOf(topping)]
      if (visual) entries.push({ toppingId, visual, quantity })
    }
  }

  const composition: Composition = {
    container: { kind, scale: size ? (SIZE_SCALE[size.id] ?? 0.82) : 0.8, surface: CONTAINERS[kind].surface },
    surface: { kind: surfaceKind, tint: surfaceKind === 'milkshake' ? (SHAKE_COLORS[flavorId ?? ''] ?? null) : null },
    empty: !size,
    sectors: [],
    scatter: [],
    patches: [],
    dollops: [],
    pieces: [],
    drizzles: [],
    shown: entries.filter((entry) => !entry.toppingId.startsWith(FLAVOR_PREFIX)).map((entry) => entry.toppingId),
  }

  // Açaí: texturas e peças soltas em setores. Bebidas: em porções no centro do copo.
  const covering = entries.filter((entry) => entry.visual.kind === 'texture' || entry.visual.kind === 'scatter')
  if (isDrink) {
    covering.forEach((entry, index) => {
      if (entry.visual.kind !== 'texture') return
      const { x, y } = index === 0 ? { x: 0.5, y: 0.5 } : polar(40 + index * 110, 0.44)
      composition.patches.push({
        id: entry.toppingId,
        toppingId: entry.toppingId,
        src: entry.visual.src,
        scale: entry.visual.scale,
        x,
        y,
        size: index === 0 ? 0.52 : 0.34,
      })
    })
  } else {
    for (const { entry, start, sweep } of sectorsFor(covering)) {
      const { visual } = entry
      composition.sectors.push({
        id: entry.toppingId,
        toppingId: entry.toppingId,
        start,
        sweep,
        src: visual.kind === 'texture' ? visual.src : null,
        scale: visual.kind === 'texture' ? visual.scale : 0,
      })
      if (visual.kind === 'scatter') {
        composition.scatter.push(...scatterIn(entry, visual.sprite, visual.size, visual.perTurn, start, sweep))
      }
    }
  }

  const dollops = entries.filter((entry) => entry.visual.kind === 'dollop')
  const dollopCount = dollops.reduce((sum, entry) => sum + Math.min(3, entry.quantity), 0)
  let dollopIndex = 0
  for (const entry of dollops) {
    if (entry.visual.kind !== 'dollop') continue
    for (let unit = 0; unit < Math.min(3, entry.quantity); unit++) {
      const angle = 220 + (dollopIndex * 360) / Math.max(1, dollopCount)
      const { x, y } = polar(angle, dollopCount === 1 ? 0.3 : 0.42)
      composition.dollops.push({
        id: `${entry.toppingId}-${unit}`,
        toppingId: entry.toppingId,
        src: entry.visual.src,
        x,
        y,
        size: dollopCount > 4 ? 0.26 : 0.32,
      })
      dollopIndex++
    }
  }

  for (const entry of entries) {
    if (entry.visual.kind === 'piece') composition.pieces.push(...piecesFor(entry, entry.visual.sprite, entry.visual.size))
  }

  entries
    .filter((entry) => entry.visual.kind === 'drizzle')
    .forEach((entry, index) => {
      if (entry.visual.kind !== 'drizzle') return
      composition.drizzles.push({
        id: entry.toppingId,
        toppingId: entry.toppingId,
        color: entry.visual.color,
        shade: entry.visual.shade,
        d: drizzlePath(entry.toppingId, 28 + index * 58),
        width: 1.4,
      })
    })

  return composition
}
