/**
 * Monta a cena 3D a partir da escolha: qual recipiente, qual base, que cor, e onde fica cada
 * pedaço de cada ingrediente. Função pura, testada; a cena só desenha o que esta função diz.
 *
 * A lista de ingredientes vem de `composeIllustration` (a mesma da prévia 2D), então a regra
 * "mostrar só o que foi escolhido" tem um único dono.
 */
import { composeIllustration, type IllustrationInput } from '../catalog/illustration/compose.ts'
import { FLAVOR_COLORS, SHAKE_NEUTRAL } from '../catalog/illustration/looks.ts'
import { scatter, seededRandom } from '../catalog/illustration/scatter.ts'
import { PRODUCTS } from '../catalog/menu.ts'
import { type Dome, domeGeometry, domeShape } from './dome.ts'
import { MODEL_SPECS, type ModelSpec, pieceCount } from './models.ts'

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

export type SceneLayout = {
  sizeId: string
  containerFile: string
  /** Sem tamanho escolhido, o recipiente aparece vazio. */
  baseFile: string | null
  baseColor: string | null
  dome: Dome
  toppings: ToppingNode[]
  /** Todos os arquivos que a cena usa, sem repetir, na ordem em que aparecem. */
  files: string[]
}

const TAU = Math.PI * 2

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

function pieces(spec: ModelSpec, toppingId: string, quantity: number, dome: Dome, index: number): Piece[] {
  const count = pieceCount(spec, quantity)
  const random = seededRandom(`${toppingId}:${index}`)
  const offset = random() * TAU

  /** `lean` inclina mais para fora (negativo) ou para dentro (positivo), além da curva do monte. */
  const place = (rho: number, angle: number, sink: number, lean = 0, scale = 1): Piece => {
    const { position, tilt } = surfacePiece(dome, rho, angle, sink)
    return {
      position,
      tilt: [tilt[0], tilt[1], tilt[2] + lean],
      rotationY: random() * TAU,
      scale,
    }
  }

  switch (spec.placement) {
    case 'scatter':
      return scatter(toppingId, count, { cx: 0, cy: 0, rx: 0.82, ry: 0.82 }).map((point) => {
        const rho = Math.hypot(point.x, point.y)
        return place(rho, Math.atan2(point.y, point.x) + offset, 0.0006, 0, 0.85 + random() * 0.3)
      })
    case 'slices':
      // rodelas e metades meio de pé, encostadas no monte
      return Array.from({ length: count }, (_, k) =>
        place(
          0.38 + random() * 0.32,
          offset + (k * TAU) / count + (random() - 0.5) * 0.5,
          0.0008,
          0.15 + random() * 0.15,
        ),
      )
    case 'dollop':
      return Array.from({ length: count }, (_, k) => place(0.18 + 0.12 * k, offset + k * 2.1, 0.001))
    case 'stuck': {
      // espetado: entra no açaí e fica inclinado para fora
      const sinkDepth = toppingId === 'canudinho' ? 0.018 : 0.009
      return Array.from({ length: count }, (_, k) =>
        place(0.42 + random() * 0.12, offset + (k * TAU) / Math.max(count, 2), sinkDepth, -0.38),
      )
    }
    case 'top':
      return Array.from({ length: count }, (_, k) =>
        k === 0 ? place(0, 0, 0.002) : place(0.26, offset + k * 2.4, 0.002),
      )
    case 'layer':
      return []
  }
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

  let layerIndex = 0
  const toppings: ToppingNode[] = illustration.layers.map((layer, index) => {
    const spec = MODEL_SPECS[layer.toppingId]
    const file = typeof spec.file === 'string' ? spec.file : spec.file[shake ? 'shake' : 'acai']

    if (spec.placement === 'layer') {
      // Cada calda ou pó gira para um lado, para duas caldas não ficarem uma sobre a outra.
      const rotationY = 0.4 + layerIndex * 1.9 + seededRandom(layer.toppingId)() * 0.6
      layerIndex++
      return {
        toppingId: layer.toppingId,
        file,
        layer: true,
        color: spec.color,
        pieces: [{ position: [0, dome.top, 0], tilt: [1, 0, 0], rotationY, scale: dome.radius }],
      }
    }

    return {
      toppingId: layer.toppingId,
      file,
      layer: false,
      pieces: pieces(spec, layer.toppingId, layer.quantity, dome, index),
    }
  })

  const files = [containerFile, ...(baseFile ? [baseFile] : []), ...toppings.map((t) => t.file)]
  return {
    sizeId,
    containerFile,
    baseFile,
    baseColor,
    dome,
    toppings,
    files: [...new Set(files)],
  }
}
