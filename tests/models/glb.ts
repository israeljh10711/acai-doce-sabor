/**
 * Leitura mínima de arquivos GLB (glTF 2.0 binário), só para conferências:
 * malhas, materiais, número de triângulos e caixa de cada malha.
 */
import { readFileSync, statSync } from 'node:fs'

type Accessor = { count: number; min?: number[]; max?: number[] }
type Primitive = { attributes: { POSITION: number }; indices?: number; material?: number }
type GltfJson = {
  asset: { version: string }
  meshes?: { name?: string; primitives: Primitive[] }[]
  materials?: { name?: string }[]
  accessors: Accessor[]
  nodes?: { name?: string; translation?: number[]; rotation?: number[]; scale?: number[] }[]
  cameras?: unknown[]
  animations?: unknown[]
  extensionsUsed?: string[]
}

export type GlbSummary = {
  bytes: number
  version: string
  meshNames: string[]
  materialNames: string[]
  triangles: number
  /** Caixa de todas as malhas juntas, em metros, com Y para cima. */
  min: [number, number, number]
  max: [number, number, number]
  nodes: GltfJson['nodes']
  hasCameras: boolean
  hasAnimations: boolean
}

export function readGlb(path: string): GlbSummary {
  const buffer = readFileSync(path)
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path} não é um GLB`)

  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as GltfJson

  let triangles = 0
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const position = json.accessors[primitive.attributes.POSITION]
      const indexCount = primitive.indices === undefined ? position.count : json.accessors[primitive.indices].count
      triangles += indexCount / 3
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], position.min?.[axis] ?? Infinity)
        max[axis] = Math.max(max[axis], position.max?.[axis] ?? -Infinity)
      }
    }
  }

  return {
    bytes: statSync(path).size,
    version: json.asset.version,
    meshNames: (json.meshes ?? []).map((mesh) => mesh.name ?? ''),
    materialNames: (json.materials ?? []).map((material) => material.name ?? ''),
    triangles,
    min,
    max,
    nodes: json.nodes,
    hasCameras: (json.cameras?.length ?? 0) > 0,
    hasAnimations: (json.animations?.length ?? 0) > 0,
  }
}
