/**
 * Cena 3D do produto montado, com os modelos feitos no Blender.
 * Carregada à parte (React.lazy): three.js só baixa quando o personalizador abre.
 *
 * - O que aparece vem de `layoutScene` (só o que foi escolhido).
 * - A cena só redesenha quando algo muda ou o cliente gira (frameloop "demand").
 * - Em desenvolvimento, a cena fica em `window.__adsScenes` para as conferências automáticas.
 */
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { Suspense, useDeferredValue, useEffect, useId, useMemo, useRef } from 'react'
import {
  CanvasTexture,
  Color,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  PMREMGenerator,
  Quaternion,
  Vector3,
} from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { CategorySlug } from '../catalog/categories.ts'
import { FOV, framingFor } from './framing.ts'
import { type Piece, type SceneLayout, type ToppingNode } from './layout.ts'

const modelUrl = (file: string) => `/models/${file}.glb`

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
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ touchAction: interactive ? 'none' : 'auto', cursor: interactive ? 'grab' : 'default' }}
      onCreated={({ gl, scene }) => {
        // Ambiente gerado no próprio navegador (sem baixar imagens): dá reflexo ao plástico e ao
        // vidro. É liberado junto com o contexto WebGL quando o canvas sai da tela.
        const generator = new PMREMGenerator(gl)
        scene.environment = generator.fromScene(new RoomEnvironment(), 0.04).texture
        scene.environmentIntensity = 0.38
        generator.dispose()
        // A checagem de erros dos sombreadores deixa a compilação mais lenta; o three recomenda
        // desligá-la em produção. Em desenvolvimento ela continua ligada.
        gl.debug.checkShaderErrors = import.meta.env.DEV
        if (import.meta.env.DEV) {
          window.__adsScenes = { ...window.__adsScenes, [sceneId]: scene }
        }
      }}
    >
      <Lights />
      <CameraRig slug={slug} sizeId={layout.sizeId} interactive={interactive} />
      <Suspense fallback={null}>
        <Product layout={layout} onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#fff8f0', '#6b0f4c', 0.45]} />
      <directionalLight position={[0.35, 0.7, 0.45]} intensity={1.8} />
      <directionalLight position={[-0.45, 0.3, -0.25]} intensity={0.55} color="#f6e3ef" />
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
      const direction = new Vector3(Math.sin(-0.45), Math.sin(0.38), Math.cos(-0.45)).normalize()
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
      <GroundShadow radius={shown.dome.radius * 1.25} />
      <Model file={shown.containerFile} name={`container:${shown.containerFile}`} container />
      {shown.baseFile && (
        <Model file={shown.baseFile} name={`base:${shown.baseFile}`} color={shown.baseColor ?? undefined} />
      )}
      {shown.toppings.map((topping) => (
        <Topping key={topping.toppingId} node={topping} />
      ))}
    </group>
  )
}

/** Modelo GLB clonado; com `color`, os materiais do clone ganham a cor pedida. */
function useModel(file: string, color?: string, container = false): Group {
  const { scene } = useGLTF(modelUrl(file))
  return useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const prepared = materials.map((original: Material) => {
        const material = (color ? original.clone() : original) as MeshStandardMaterial
        if (color) material.color = new Color(color)
        if (container && material.transparent && !material.userData.adsPrepared) {
          // Plástico e vidro: bem transparentes e sem esconder o que há dentro. O material é o
          // mesmo para todas as cópias do modelo, então o ajuste é feito uma vez só.
          material.userData.adsPrepared = true
          material.depthWrite = false
          material.opacity *= 0.45
          material.roughness = Math.min(material.roughness, 0.08)
          material.envMapIntensity = 0.7
        }
        return material
      })
      mesh.material = Array.isArray(mesh.material) ? prepared : prepared[0]
      if (container) mesh.renderOrder = 2
    })
    return clone
  }, [scene, color, container])
}

function Model({ file, name, color, container = false }: { file: string; name: string; color?: string; container?: boolean }) {
  const model = useModel(file, color, container)
  return <primitive object={model} name={name} />
}

function Topping({ node }: { node: ToppingNode }) {
  const template = useModel(node.file, node.color)
  return (
    <group name={`topping:${node.toppingId}`}>
      {node.pieces.map((piece, index) => (
        <PieceInstance key={index} template={template} piece={piece} delay={index * 0.025} />
      ))}
    </group>
  )
}

const UP = new Vector3(0, 1, 0)

/** Um pedaço do ingrediente, que cai no lugar ao aparecer. */
function PieceInstance({ template, piece, delay }: { template: Group; piece: Piece; delay: number }) {
  const object = useMemo(() => template.clone(true), [template])
  const group = useRef<Group>(null)
  const reduceMotion = useReducedMotion()
  const started = useRef<number | null>(null)
  const { invalidate } = useThree()

  const quaternion = useMemo(() => {
    const [ax, az, angle] = piece.tilt
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(ax, 0, az).normalize(), angle)
    const yaw = new Quaternion().setFromAxisAngle(UP, piece.rotationY)
    return tilt.multiply(yaw)
  }, [piece.tilt, piece.rotationY])

  useFrame(({ clock }) => {
    const current = group.current
    if (!current) return
    if (reduceMotion) {
      current.position.set(...piece.position)
      current.scale.setScalar(piece.scale)
      return
    }
    started.current ??= clock.elapsedTime
    const t = Math.min(Math.max((clock.elapsedTime - started.current - delay) / 0.38, 0), 1)
    const ease = 1 - (1 - t) ** 3
    current.position.set(piece.position[0], piece.position[1] + (1 - ease) * 0.03, piece.position[2])
    current.scale.setScalar(piece.scale * (0.55 + 0.45 * ease))
    if (t < 1) invalidate()
  })

  return (
    <group ref={group} position={piece.position} quaternion={quaternion} scale={piece.scale}>
      <primitive object={object} />
    </group>
  )
}

/** Sombra suave embaixo do recipiente: um degradê, sem cálculo de sombra (leve para o celular). */
function GroundShadow({ radius }: { radius: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(44, 10, 33, 0.42)')
    gradient.addColorStop(1, 'rgba(44, 10, 33, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
    return new CanvasTexture(canvas)
  }, [])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]}>
      <planeGeometry args={[radius * 2.4, radius * 2.4]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}
