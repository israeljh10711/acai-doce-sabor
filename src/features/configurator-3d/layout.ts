/**
 * Monta a cena 3D a partir da escolha: qual recipiente, qual base, que cor, onde fica cada
 * pedaço de cada ingrediente e quais faixas de creme aparecem dentro do copo. Função pura,
 * testada; a cena só desenha o que esta função diz.
 *
 * A lista de ingredientes vem de `composeIllustration` (a mesma da prévia 2D), então a regra
 * "mostrar só o que foi escolhido" tem um único dono.
 *
 * Como nas fotos de referência, cada adicional, fruta e creme ganha um setor do topo e o cobre
 * com fartura. A quantidade escolhida aumenta o setor. As caldas passam por cima de tudo.
 */
import { composeIllustration, type IllustrationInput } from '../catalog/illustration/compose.ts'
import { FLAVOR_COLORS, SHAKE_NEUTRAL, TOPPING_LOOKS } from '../catalog/illustration/looks.ts'
import { seededRandom } from '../catalog/illustration/scatter.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { type Dome, domeGeometry, domeShape } from './dome.ts'
import { INNER_BAND_TOPPINGS, MODEL_SPECS, type ModelSpec, SECTOR_PLACEMENTS, pieceCount } from './models.ts'

export type Piece = {
  position: [number, number, number]
  /**
   * Inclinação da peça: eixo horizontal (x, z) e ângulo em radianos. O eixo é perpendicular
   * ao raio; ângulo negativo inclina a peça para fora do centro, acompanhando a descida do monte.
   */
  tilt: [number, number, number]
  /** Giro em volta do eixo vertical, em radianos. */
  rotationY: number
  scale: number
}

export type ToppingNode = {
  toppingId: string
  file: string
  /** Camada ampliada pelo raio do monte (calda, pó). */
  layer: boolean
  color?: string
  pieces: Piece[]
}

/** Faixa de creme dentro do copo ou do pote: nome da malha no GLB da base e a cor. */
export type InnerBand = { mesh: string; toppingId: string; color: string }

export type SceneLayout = {
  sizeId: string
  containerFile: string
  /** Sem tamanho escolhido, o recipiente aparece vazio. */
  baseFile: string | null
  baseColor: string | null
  dome: Dome
  toppings: ToppingNode[]
  bands: InnerBand[]
  /** Todos os arquivos que a cena usa, sem repetir, na ordem em que aparecem. */
  files: string[]
}

const TAU = Math.PI * 2
/** Até onde os pedaços vão, em fração do raio do monte (a borda encosta na parede). */
const RHO_MAX = 0.88
/** Limite de pedaços na cena inteira, para o celular não sofrer. */
export const MAX_PIECES = 220
/** A calda passa por cima dos adicionais. */
const SYRUP_LIFT = 0.0035
/** Recipientes com faixas de creme no modelo da base (o resto não mostra o que há dentro). */
const BANDED = /^(copo|pote)-/

function surfacePiece(dome: Dome, rho: number, angle: number, sink: number): Pick<Piece, 'position' | 'tilt'> {
  const x = rho * dome.radius * Math.cos(angle)
  const z = rho * dome.radius * Math.sin(angle)
  const y = dome.top + dome.height * domeShape(rho) - sink

  // Inclinação acompanhando o monte: derivada da altura na direção do raio (negativa: o monte desce).
  const step = 0.02
  const inner = Math.max(rho - step, 0)
  const outer = Math.min(rho + step, 1)
  const slope = (dome.height * (domeShape(outer) - domeShape(inner))) / ((outer - inner) * dome.radius)
  // Girar em volta do eixo (-sen a, 0, cos a) por atan(slope) leva o "para cima" da peça
  // até a normal do monte, que pende para fora do centro.
  return { position: [x, y, z], tilt: [-Math.sin(angle), Math.cos(angle), Math.atan(slope)] }
}

/** Sequência de Halton: pontos bem distribuídos, sem amontoar nem deixar buracos. */
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

type Sector = { from: number; to: number }

/** Divide a volta entre os ingredientes de setor, proporcional ao peso de cada um. */
function sectorsFor(weights: number[], offset: number): Sector[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let start = offset
  return weights.map((weight) => {
    const span = (weight / total) * TAU
    const sector = { from: start, to: start + span }
    start += span
    return sector
  })
}

/** Peso de um ingrediente na divisão do topo: mais unidades, setor maior (até 3 vezes). */
function sectorWeight(spec: ModelSpec, quantity: number): number {
  if (spec.placement === 'patch') return 0.8
  return Math.min(Math.max(quantity, 1), 3)
}

/** Área do setor, em metros quadrados, até RHO_MAX. */
function sectorArea(sector: Sector, dome: Dome): number {
  return 0.5 * (sector.to - sector.from) * (dome.radius * RHO_MAX) ** 2
}

function placeOnDome(
  dome: Dome,
  random: () => number,
  rho: number,
  angle: number,
  sink: number,
  lean = 0,
  scale = 1,
): Piece {
  const { position, tilt } = surfacePiece(dome, rho, angle, sink)
  return { position, tilt: [tilt[0], tilt[1], tilt[2] + lean], rotationY: random() * TAU, scale }
}

function clusterPieces(spec: ModelSpec, sector: Sector, dome: Dome, random: () => number, budget: number): Piece[] {
  const footprint = spec.footprint ?? 0.0095
  const wanted = Math.round(((spec.coverage ?? 2.1) * sectorArea(sector, dome)) / (Math.PI * footprint ** 2))
  const count = Math.max(2, Math.min(wanted, budget))
  const span = sector.to - sector.from
  const inset = span * 0.04
  const start = Math.floor(random() * 997)
  return Array.from({ length: count }, (_, k) => {
    const angle = sector.from + inset + halton(start + k + 1, 2) * (span - 2 * inset)
    // raiz: pontos espalhados por igual na área (sem amontoar no centro)
    const rho = Math.min(Math.sqrt(halton(start + k + 1, 3)) * RHO_MAX, RHO_MAX - footprint / dome.radius / 2)
    return placeOnDome(dome, random, rho, angle, 0.0007, 0, 0.88 + random() * 0.24)
  })
}

function slicePieces(spec: ModelSpec, sector: Sector, dome: Dome, random: () => number, budget: number): Piece[] {
  // Fileiras de fora para dentro, cada fatia sobre a vizinha, como nas fotos de referência.
  const footprint = spec.footprint ?? 0.0125
  const step = footprint * 1.38
  const span = sector.to - sector.from
  const pieces: Piece[] = []
  let row = 0
  for (let r = dome.radius * RHO_MAX - footprint * 0.8; r > dome.radius * 0.1; r -= step * 0.92) {
    const n = Math.max(1, Math.floor((span * r) / step))
    for (let k = 0; k < n && pieces.length < budget; k++) {
      const angle = sector.from + (span * (k + 0.5)) / n + (random() - 0.5) * (span / n) * 0.2
      const lift = ((k + row) % 2) * 0.0007 + row * 0.0004
      pieces.push(placeOnDome(dome, random, r / dome.radius, angle, 0.0006 - lift, 0.12 + random() * 0.12))
    }
    row++
  }
  if (pieces.length === 0) {
    pieces.push(placeOnDome(dome, random, 0.2, (sector.from + sector.to) / 2, 0.0006, 0.1))
  }
  return pieces
}

function dollopPieces(spec: ModelSpec, quantity: number, sector: Sector, dome: Dome, random: () => number): Piece[] {
  const count = pieceCount(spec, quantity)
  const span = sector.to - sector.from
  const start = Math.floor(random() * 997)
  return Array.from({ length: count }, (_, k) => {
    const angle = count === 1 ? (sector.from + sector.to) / 2 : sector.from + span * (0.15 + 0.7 * halton(start + k + 1, 2))
    const rho = count === 1 ? 0.5 : 0.28 + 0.48 * halton(start + k + 1, 3)
    return placeOnDome(dome, random, rho, angle, 0.001)
  })
}

export function layoutScene(input: IllustrationInput): SceneLayout {
  const product = PRODUCTS[input.slug]
  const illustration = composeIllustration(input)
  const shake = input.slug === 'milk-shake'
  const sizeId = illustration.empty ? product.sizes[0].id : (input.sizeId as string)
  const dome = domeGeometry(input.slug, sizeId)

  const containerFile = `container-${shake ? 'shake-' : ''}${sizeId}`
  const baseFile = illustration.empty ? null : `base-${shake ? 'shake' : 'acai'}-${sizeId}`
  const baseColor = illustration.empty
    ? null
    : shake
      ? (input.flavorId && Object.hasOwn(FLAVOR_COLORS, input.flavorId)
          ? FLAVOR_COLORS[input.flavorId]
          : SHAKE_NEUTRAL
        ).body
      : null

  const layers = illustration.layers
  const specOf = (toppingId: string) => MODEL_SPECS[toppingId]
  const fileOf = (spec: ModelSpec) => (typeof spec.file === 'string' ? spec.file : spec.file[shake ? 'shake' : 'acai'])

  // Setores: na ordem do cardápio, a partir de um giro fixo (a mesma escolha, a mesma cena).
  const inSectors = layers.filter((layer) => SECTOR_PLACEMENTS.includes(specOf(layer.toppingId).placement))
  const sectors = sectorsFor(
    inSectors.map((layer) => sectorWeight(specOf(layer.toppingId), layer.quantity)),
    seededRandom('setores')() * TAU,
  )
  const sectorOf = new Map(inSectors.map((layer, index) => [layer.toppingId, sectors[index]]))
  const hasPieces = inSectors.some((layer) => specOf(layer.toppingId).placement !== 'patch')

  // Os setores dividem o limite de pedaços em partes iguais.
  const budget = Math.max(6, Math.floor(MAX_PIECES / Math.max(inSectors.length, 1)))

  let syrupIndex = 0
  const toppings: ToppingNode[] = layers.map((layer, index) => {
    const spec = specOf(layer.toppingId)
    const file = fileOf(spec)
    const random = seededRandom(`${layer.toppingId}:${index}`)
    const sector = sectorOf.get(layer.toppingId)
    const node = (pieces: Piece[], isLayer = false): ToppingNode => ({
      toppingId: layer.toppingId,
      file,
      layer: isLayer,
      ...(spec.color ? { color: spec.color } : {}),
      pieces,
    })

    switch (spec.placement) {
      case 'drizzle': {
        // Cada calda gira para um lado, para duas caldas não ficarem uma sobre a outra.
        const rotationY = 0.4 + syrupIndex * 1.9 + seededRandom(layer.toppingId)() * 0.6
        syrupIndex++
        const y = dome.top + (hasPieces ? SYRUP_LIFT : 0)
        return node([{ position: [0, y, 0], tilt: [1, 0, 0], rotationY, scale: dome.radius }], true)
      }
      case 'patch': {
        // A mancha do modelo fica no lado +X; o giro a leva para o meio do setor.
        const middle = sector ? (sector.from + sector.to) / 2 : 0
        return node([{ position: [0, dome.top, 0], tilt: [1, 0, 0], rotationY: -middle, scale: dome.radius }], true)
      }
      case 'cluster':
        return node(clusterPieces(spec, sector as Sector, dome, random, budget))
      case 'slices':
        return node(slicePieces(spec, sector as Sector, dome, random, budget))
      case 'dollop':
        return node(dollopPieces(spec, layer.quantity, sector as Sector, dome, random))
      case 'stuck': {
        // espetado: entra no açaí e fica inclinado para fora
        const count = pieceCount(spec, layer.quantity)
        const offset = random() * TAU
        const sinkDepth = layer.toppingId === 'canudinho' ? 0.018 : 0.009
        return node(
          Array.from({ length: count }, (_, k) =>
            placeOnDome(dome, random, 0.34 + random() * 0.12, offset + (k * TAU) / Math.max(count, 2), sinkDepth, -0.38),
          ),
        )
      }
      case 'top': {
        const count = pieceCount(spec, layer.quantity)
        const offset = random() * TAU
        return node(
          Array.from({ length: count }, (_, k) =>
            k === 0
              ? placeOnDome(dome, random, 0, 0, 0.002 - (hasPieces ? 0.003 : 0))
              : placeOnDome(dome, random, 0.26, offset + k * 2.4, 0.002 - (hasPieces ? 0.003 : 0)),
          ),
        )
      }
    }
  })

  // Faixas de creme dentro do copo e do pote: só os cremes escolhidos, no máximo duas.
  const bands: InnerBand[] =
    baseFile && !shake && BANDED.test(sizeId)
      ? INNER_BAND_TOPPINGS.filter((id) => layers.some((layer) => layer.toppingId === id))
          .slice(0, 2)
          .map((toppingId, index) => {
            const look = TOPPING_LOOKS[toppingId]
            const color = look.kind === 'dollop' || look.kind === 'drizzle' ? look.color : '#fff4d8'
            return { mesh: `${baseFile}-camada-${index + 1}`, toppingId, color }
          })
      : []

  const files = [containerFile, ...(baseFile ? [baseFile] : []), ...toppings.map((t) => t.file)]
  return {
    sizeId,
    containerFile,
    baseFile,
    baseColor,
    dome,
    toppings,
    bands,
    files: [...new Set(files)],
  }
}
