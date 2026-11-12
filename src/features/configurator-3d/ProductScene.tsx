/**
 * Cena 3D do produto montado, com os modelos feitos no Blender.
 * Carregada à parte (React.lazy): three.js só baixa quando o personalizador abre.
 *
 * - O que aparece vem de `layoutScene` (só o que foi escolhido).
 * - Luz de estúdio de fotografia de comida, montada no próprio código (sem baixar imagem de
 *   terceiros): painéis de luz para os reflexos, luz principal neutra-quente, luz de recorte
 *   por trás (desenha a borda do copo), sombra de contato e tom ACESFilmic.
 * - Plástico e vidro com transmissão física: o açaí e as faixas de creme aparecem pelo copo.
 * - Cada ingrediente é desenhado de uma vez (instâncias), por mais pedaços que tenha.
 * - A cena só redesenha quando algo muda ou o cliente gira (frameloop "demand").
 * - Em desenvolvimento, a cena fica em `window.__adsScenes` para as conferências automáticas.
 */
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { Suspense, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react'
import {
  ACESFilmicToneMapping,
  type BufferGeometry,
  Color,
  type Group,
  type InstancedMesh,
  type Material,
  Matrix4,
  type Mesh,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  type Object3D,
  Quaternion,
  Vector3,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CategorySlug } from '../catalog/categories.ts'
import { FOV, framingFor } from './framing.ts'
import type { InnerBand, Piece, SceneLayout, ToppingNode } from './layout.ts'
import { STAGE_COLOR } from './stage.ts'

const BASE_URL = import.meta.env.BASE_URL
const modelUrl = (file: string) => `${BASE_URL}models/${file}.glb`
// Os modelos vêm comprimidos (Draco). O decodificador é servido pelo próprio site, não por CDN.
useGLTF.setDecoderPath(`${BASE_URL}draco/`)

/** Ajustes do plástico e do vidro que o GLB não carrega: espessura e cor do volume. */
const GLASS: Record<string, { thickness: number; attenuation?: [string, number] }> = {
  pet: { thickness: 0.0016 },
  pp: { thickness: 0.002 },
  vidro: { thickness: 0.004, attenuation: ['#eef6f6', 0.35] },
}

type ProductSceneProps = {
  slug: CategorySlug
  layout: SceneLayout
  /** Permite girar arrastando. Desligado na prévia pequena do celular, para não roubar a rolagem. */
  interactive: boolean
  /** Para de desenhar (ex.: enquanto a visualização ampliada está aberta). */
  paused?: boolean
  /** Chamado quando os modelos carregaram e a primeira imagem saiu. */
  onReady?: () => void
  className?: string
  /** A descrição fica no elemento de fora; o canvas é só visual. */
  'aria-hidden'?: boolean
}

declare global {
  interface Window {
    __adsScenes?: Record<string, Object3D>
  }
}

export default function ProductScene({
  slug,
  layout,
  interactive,
  paused,
  onReady,
  className,
  'aria-hidden': ariaHidden,
}: ProductSceneProps) {
  const sceneId = useId()

  useEffect(() => {
    for (const file of layout.files) useGLTF.preload(modelUrl(file))
  }, [layout.files])

  return (
    <Canvas
      className={className}
      aria-hidden={ariaHidden}
      data-scene-id={sceneId}
      frameloop={paused ? 'never' : 'demand'}
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.01, far: 5, position: [0.25, 0.2, 0.35] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', toneMapping: ACESFilmicToneMapping }}
      style={{ touchAction: interactive ? 'none' : 'auto', cursor: interactive ? 'grab' : 'default' }}
      onCreated={({ gl, scene, size }) => {
        gl.toneMappingExposure = 1.2
        // A transparência do copo desenha a cena de novo numa imagem à parte. Em telas pequenas
        // ou muito densas, essa imagem tem metade da resolução: quase não se nota e alivia o celular.
        gl.transmissionResolutionScale = size.width < 480 || window.devicePixelRatio > 1.75 ? 0.5 : 1
        // A checagem de erros dos sombreadores deixa a compilação mais lenta; o three recomenda
        // desligá-la em produção. Em desenvolvimento ela continua ligada.
        gl.debug.checkShaderErrors = import.meta.env.DEV
        if (import.meta.env.DEV) {
          window.__adsScenes = { ...window.__adsScenes, [sceneId]: scene }
        }
      }}
    >
      {/* Fundo do estúdio na própria cena (e não só no CSS): a transparência do copo desenha
          esse fundo atrás do plástico. Sem ele, o three.js põe branco ali (halo nas bordas). A tela
          continua com transparência ligada, que a sombra de contato do drei precisa. */}
      <color attach="background" args={[STAGE_COLOR]} />
      <Studio />
      <CameraRig slug={slug} sizeId={layout.sizeId} interactive={interactive} />
      <Suspense fallback={null}>
        <Product layout={layout} onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}

/** Estúdio: painéis de luz que viram o reflexo nos materiais, mais três luzes diretas. */
function Studio() {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={1}>
        <color attach="background" args={['#140c12']} />
        {/* principal: caixa de luz grande, à frente e à direita */}
        <Lightformer form="rect" intensity={2.6} color="#fff1e2" position={[2.2, 2.2, 2.6]} scale={[2.8, 1.8, 1]} target={[0, 0, 0]} />
        {/* recorte: tiras altas atrás, dos dois lados, que desenham a borda do plástico */}
        <Lightformer form="rect" intensity={3.4} color="#ffffff" position={[-2.6, 1.1, -1.7]} scale={[0.35, 4, 1]} target={[0, 0.4, 0]} />
        <Lightformer form="rect" intensity={2.8} color="#ffffff" position={[2.7, 1.1, -1.9]} scale={[0.35, 4, 1]} target={[0, 0.4, 0]} />
        {/* rebatedor de cima e preenchimento suave à esquerda */}
        <Lightformer form="circle" intensity={1.3} color="#ffffff" position={[0, 4, 0.3]} scale={[3, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.7} color="#f4efff" position={[-3, 0.5, 2.1]} scale={[2.4, 1.2, 1]} target={[0, 0.3, 0]} />
      </Environment>
      <hemisphereLight args={['#fff8f2', '#2a081d', 0.3]} />
      <directionalLight position={[0.35, 0.62, 0.48]} intensity={1.5} color="#fff1e2" />
      <directionalLight position={[-0.32, 0.4, -0.55]} intensity={1.05} color="#ffffff" />
    </>
  )
}

function CameraRig({ slug, sizeId, interactive }: { slug: CategorySlug; sizeId: string; interactive: boolean }) {
  const { camera, invalidate } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const reduceMotion = useReducedMotion()
  const goal = useMemo(() => framingFor(slug, sizeId), [slug, sizeId])
  const target = useRef(new Vector3(0, goal.targetY, 0))
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      // primeira vez: posição inicial de frente, um pouco de cima e de lado
      first.current = false
      target.current.set(0, goal.targetY, 0)
      const direction = new Vector3(Math.sin(-0.45), Math.sin(0.62), Math.cos(-0.45)).normalize()
      camera.position.copy(target.current).addScaledVector(direction, goal.distance)
      camera.lookAt(target.current)
    }
    invalidate()
  }, [camera, goal, invalidate])

  // Troca de tamanho: aproxima ou afasta suavemente, mantendo o ângulo que o cliente escolheu.
  useFrame(() => {
    const currentTarget = controls.current?.target ?? target.current
    const offset = camera.position.clone().sub(currentTarget)
    const step = reduceMotion ? 1 : 0.18
    const distance = offset.length() + (goal.distance - offset.length()) * step
    const targetY = currentTarget.y + (goal.targetY - currentTarget.y) * step
    currentTarget.set(0, targetY, 0)
    camera.position.copy(currentTarget).addScaledVector(offset.normalize(), distance)
    camera.lookAt(currentTarget)
    controls.current?.update()
    if (Math.abs(distance - goal.distance) > 1e-4 || Math.abs(targetY - goal.targetY) > 1e-4) invalidate()
  })

  if (!interactive) return null
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom={false}
      enableDamping={!reduceMotion}
      dampingFactor={0.12}
      rotateSpeed={0.7}
      minPolarAngle={Math.PI * 0.2}
      maxPolarAngle={Math.PI * 0.47}
      target={[0, goal.targetY, 0]}
    />
  )
}

function Product({ layout, onReady }: { layout: SceneLayout; onReady?: () => void }) {
  // Enquanto os modelos de uma escolha nova carregam, a cena anterior continua na tela.
  const shown = useDeferredValue(layout)
  const ready = useRef(false)
  const { invalidate } = useThree()

  useEffect(() => {
    invalidate()
    if (!ready.current) {
      ready.current = true
      onReady?.()
    }
  }, [shown, invalidate, onReady])

  return (
    <group>
      <ContactShadows
        position={[0, 0.0004, 0]}
        scale={shown.dome.radius * 6}
        far={0.25}
        blur={2.4}
        opacity={0.55}
        resolution={512}
        color="#2a081d"
      />
      <Model file={shown.containerFile} name={`container:${shown.containerFile}`} container />
      {shown.baseFile && (
        <Model
          file={shown.baseFile}
          name={`base:${shown.baseFile}`}
          color={shown.baseColor ?? undefined}
          bands={shown.bands}
        />
      )}
      {shown.toppings.map((topping) => (
        <Topping key={topping.toppingId} node={topping} />
      ))}
    </group>
  )
}

function tinted(original: Material, color: string): Material {
  const material = original.clone() as MeshStandardMaterial
  material.color = new Color(color)
  return material
}

/** Modelo GLB clonado; com `color`, os materiais do clone ganham a cor pedida. */
function useModel(file: string, color?: string, container = false): Group {
  const { scene } = useGLTF(modelUrl(file))
  const model = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      if (color && !mesh.name.includes('-camada-')) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map((material) => tinted(material, color))
          : tinted(mesh.material, color)
      }
      if (container) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const material of materials as MeshPhysicalMaterial[]) {
          const glass = GLASS[material.name]
          if (!glass || material.userData.adsPrepared) continue
          // O material é o mesmo para todas as cópias do modelo: o ajuste é feito uma vez só.
          material.userData.adsPrepared = true
          material.thickness = glass.thickness
          if (glass.attenuation) {
            material.attenuationColor = new Color(glass.attenuation[0])
            material.attenuationDistance = glass.attenuation[1]
          }
        }
      }
    })
    return clone
  }, [scene, color, container])

  useEffect(
    () => () => {
      // Materiais criados para a cor pedida são só deste clone: liberados quando ele sai.
      if (!color) return
      model.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
      })
    },
    [model, color],
  )
  return model
}

function Model({
  file,
  name,
  color,
  container = false,
  bands,
}: {
  file: string
  name: string
  color?: string
  container?: boolean
  bands?: InnerBand[]
}) {
  const model = useModel(file, color, container)
  const { invalidate } = useThree()

  // Faixas de creme dentro do copo: só as dos cremes escolhidos aparecem, com a cor de cada um.
  useLayoutEffect(() => {
    model.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh || !mesh.name.includes('-camada-')) return
      const band = bands?.find((candidate) => mesh.name.endsWith(candidate.mesh.slice(-9)))
      mesh.visible = band !== undefined
      if (!band) return
      if (!mesh.userData.ownMaterial) {
        mesh.material = (mesh.material as Material).clone()
        mesh.userData.ownMaterial = true
      }
      ;(mesh.material as MeshStandardMaterial).color.set(band.color)
    })
    invalidate()
  }, [model, bands, invalidate])

  return <primitive object={model} name={name} />
}

type Part = { geometry: BufferGeometry; material: Material | Material[]; local: Matrix4 }

/** As malhas de um modelo, com a posição de cada uma dentro dele (para as instâncias). */
function useParts(file: string, color?: string): Part[] {
  const { scene } = useGLTF(modelUrl(file))
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const list: Part[] = []
    scene.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const material = color
        ? Array.isArray(mesh.material)
          ? mesh.material.map((m) => tinted(m, color))
          : tinted(mesh.material, color)
        : mesh.material
      list.push({ geometry: mesh.geometry, material, local: mesh.matrixWorld.clone() })
    })
    return list
  }, [scene, color])

  useEffect(
    () => () => {
      if (!color) return
      for (const part of parts) {
        for (const material of Array.isArray(part.material) ? part.material : [part.material]) material.dispose()
      }
    },
    [parts, color],
  )
  return parts
}

const UP = new Vector3(0, 1, 0)

type Target = { position: Vector3; quaternion: Quaternion; scale: number }
type Current = Target & { born: number }

function targetOf(piece: Piece): Target {
  const [ax, az, angle] = piece.tilt
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(ax, 0, az).normalize(), angle)
  const yaw = new Quaternion().setFromAxisAngle(UP, piece.rotationY)
  return { position: new Vector3(...piece.position), quaternion: tilt.multiply(yaw), scale: piece.scale }
}

/**
 * Todos os pedaços de um ingrediente, desenhados de uma vez. Pedaços novos caem no lugar;
 * os que já estavam deslizam até o lugar novo quando o topo é redividido.
 */
function Topping({ node }: { node: ToppingNode }) {
  const parts = useParts(node.file, node.color)
  const count = node.pieces.length
  const meshes = useRef<(InstancedMesh | null)[]>([])
  const current = useRef<Current[]>([])
  const dirty = useRef(true)
  const targets = useMemo(() => node.pieces.map(targetOf), [node.pieces])
  const reduceMotion = useReducedMotion()
  const { invalidate } = useThree()

  useLayoutEffect(() => {
    const now = performance.now() / 1000
    const list = current.current
    let fresh = 0
    for (let i = 0; i < targets.length; i++) {
      if (list[i]) continue
      const goal = targets[i]
      list[i] = {
        position: goal.position.clone().add(new Vector3(0, 0.03, 0)),
        quaternion: goal.quaternion.clone(),
        scale: goal.scale * 0.55,
        born: now + Math.min(fresh++ * 0.012, 0.45),
      }
    }
    list.length = targets.length
    dirty.current = true
    invalidate()
  }, [targets, invalidate])

  const matrix = useMemo(() => new Matrix4(), [])
  const piece = useMemo(() => new Matrix4(), [])
  const scale = useMemo(() => new Vector3(), [])

  useFrame((_, delta) => {
    if (!dirty.current) return
    const now = performance.now() / 1000
    // Depois de um tempo parada, a cena volta com um intervalo grande: limitado para animar.
    const k = reduceMotion ? 1 : 1 - Math.exp(-Math.min(delta, 1 / 30) * 14)
    let moving = false
    for (let i = 0; i < targets.length; i++) {
      const state = current.current[i]
      const goal = targets[i]
      if (!state) continue
      if (!reduceMotion && now < state.born) {
        moving = true
        piece.makeScale(0, 0, 0)
      } else {
        state.position.lerp(goal.position, k)
        state.quaternion.slerp(goal.quaternion, k)
        state.scale += (goal.scale - state.scale) * k
        if (state.position.distanceToSquared(goal.position) > 1e-10 || Math.abs(goal.scale - state.scale) > 1e-4) {
          moving = true
        } else {
          state.position.copy(goal.position)
          state.quaternion.copy(goal.quaternion)
          state.scale = goal.scale
        }
        piece.compose(state.position, state.quaternion, scale.setScalar(state.scale))
      }
      parts.forEach((part, p) => {
        const mesh = meshes.current[p]
        if (!mesh) return
        matrix.multiplyMatrices(piece, part.local)
        mesh.setMatrixAt(i, matrix)
      })
    }
    for (const mesh of meshes.current) if (mesh) mesh.instanceMatrix.needsUpdate = true
    dirty.current = moving
    if (moving) invalidate()
  })

  return (
    <group name={`topping:${node.toppingId}`} userData={{ pieces: count }}>
      {parts.map((part, p) => (
        <instancedMesh
          key={`${p}:${count}`}
          ref={(mesh) => {
            meshes.current[p] = mesh
            dirty.current = true
          }}
          args={[part.geometry, part.material, count]}
          frustumCulled={false}
          dispose={null}
        />
      ))}
    </group>
  )
}
