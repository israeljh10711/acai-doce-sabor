/**
 * Peças da ilustração 2D: recipiente, base e cada tipo de ingrediente.
 * Coordenadas no espaço de 240 x 240 da ilustração, com o recipiente apoiado em GROUND.
 */
import { m } from 'motion/react'
import { CX, GROUND, type Geometry } from './geometry.ts'
import type { BaseColors, BitShape, ContainerShape, ToppingLook } from './looks.ts'
import { scatter, seededRandom } from './scatter.ts'

function bodyPath(g: Geometry, inset = 0): string {
  const { top, bottom } = g.shape
  const t = top - inset
  const b = bottom - inset
  const y0 = g.rimY + inset * 0.6
  const y1 = GROUND - inset
  return `M${CX - t} ${y0} L${CX - b} ${y1} A${b} ${b * 0.2} 0 0 0 ${CX + b} ${y1} L${CX + t} ${y0} Z`
}

function domePath(g: Geometry): string {
  const t = g.shape.top * 0.97
  const apex = g.rimY - g.domeH
  // Monte em meia elipse (0,552 é a constante da curva de Bézier que imita um quarto de elipse).
  const k = 0.552
  return [
    `M${CX - t} ${g.rimY}`,
    `C${CX - t} ${g.rimY - g.domeH * k} ${CX - t * k} ${apex} ${CX} ${apex}`,
    `C${CX + t * k} ${apex} ${CX + t} ${g.rimY - g.domeH * k} ${CX + t} ${g.rimY}`,
    `A${t} ${g.rimRy} 0 0 1 ${CX - t} ${g.rimY}`,
    'Z',
  ].join(' ')
}

/** Arco da frente da boca do recipiente. */
function frontRimPath(g: Geometry): string {
  const t = g.shape.top
  return `M${CX - t} ${g.rimY} A${t} ${g.rimRy} 0 0 0 ${CX + t} ${g.rimY}`
}

const translucent = (shape: ContainerShape) => shape.kind !== 'isopor'

export function GroundShadow({ g, ids }: { g: Geometry; ids: Ids }) {
  return (
    <ellipse
      cx={CX}
      cy={GROUND + 2}
      rx={g.shape.bottom + 16}
      ry={7}
      fill={`url(#${ids.shadow})`}
    />
  )
}

export type Ids = { shadow: string; plastic: string; foam: string; liquid: string }

export function Gradients({ ids, base }: { ids: Ids; base: BaseColors | null }) {
  return (
    <defs>
      <radialGradient id={ids.shadow}>
        <stop offset="0" stopColor="#2c0a21" stopOpacity="0.28" />
        <stop offset="1" stopColor="#2c0a21" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={ids.plastic} x1="0" x2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
        <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.04" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.26" />
      </linearGradient>
      <linearGradient id={ids.foam} x1="0" x2="1">
        <stop offset="0" stopColor="#e9e1d4" />
        <stop offset="0.35" stopColor="#ffffff" />
        <stop offset="1" stopColor="#ece5d9" />
      </linearGradient>
      {base && (
        <linearGradient id={ids.liquid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={base.top} />
          <stop offset="1" stopColor={base.body} />
        </linearGradient>
      )}
    </defs>
  )
}

/** Recipiente vazio, em contorno, antes de o tamanho ser escolhido. */
export function EmptyContainer({ g }: { g: Geometry }) {
  return (
    <g fill="none" stroke="#6b0f4c" strokeOpacity="0.4" strokeWidth="1.6" strokeDasharray="5 5">
      <path d={bodyPath(g)} />
      <ellipse cx={CX} cy={g.rimY} rx={g.shape.top} ry={g.rimRy} />
    </g>
  )
}

/** Parte de trás do recipiente e o conteúdo: tudo o que fica atrás dos ingredientes. */
export function ContainerBack({ g, base, ids }: { g: Geometry; base: BaseColors; ids: Ids }) {
  const { shape } = g
  const domeTexture = shape.kind === 'shake' ? null : <AcaiTexture g={g} base={base} />

  if (!translucent(shape)) {
    // Isopor: branco opaco; o açaí aparece só na boca.
    return (
      <g>
        <path d={bodyPath(g)} fill={`url(#${ids.foam})`} stroke="#d9cfbf" strokeWidth="1.2" />
        <path d={bodyPath(g, 0)} fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.8" />
        <ellipse cx={CX} cy={g.rimY} rx={shape.top - 2} ry={g.rimRy - 1} fill={base.body} />
        <path d={domePath(g)} fill={base.top} />
        {domeTexture}
      </g>
    )
  }

  return (
    <g>
      <path d={bodyPath(g, 2.4)} fill={`url(#${ids.liquid})`} />
      {shape.kind === 'shake' && <ShakeSwirl g={g} base={base} />}
      <path d={domePath(g)} fill={base.top} />
      {domeTexture}
    </g>
  )
}

/** Parte da frente do recipiente: plástico ou vidro por cima do conteúdo, e a borda. */
export function ContainerFront({ g, ids }: { g: Geometry; ids: Ids }) {
  const { shape } = g

  if (!translucent(shape)) {
    return (
      <path d={frontRimPath(g)} fill="none" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" />
    )
  }

  const frost = shape.kind === 'pote' ? 0.1 : 0
  return (
    <g>
      <path
        d={bodyPath(g)}
        fill={`url(#${ids.plastic})`}
        stroke="#6b0f4c"
        strokeOpacity="0.18"
        strokeWidth="1"
      />
      {frost > 0 && <path d={bodyPath(g)} fill="#ffffff" fillOpacity={frost} />}
      {/* reflexo vertical do plástico */}
      <path
        d={`M${CX - shape.top * 0.62} ${g.rimY + 8} L${CX - shape.bottom * 0.62} ${GROUND - 8}`}
        stroke="#ffffff"
        strokeOpacity="0.5"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {shape.kind === 'shake' && <ShakeGlassDetails g={g} />}
      <path
        d={frontRimPath(g)}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.9"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </g>
  )
}

function AcaiTexture({ g, base }: { g: Geometry; base: BaseColors }) {
  const { surface } = g
  return (
    <g fill="none" strokeLinecap="round">
      <path
        d={`M${surface.cx - surface.rx * 0.8} ${surface.cy + surface.ry * 0.4} q${surface.rx * 0.4} ${-surface.ry * 0.9} ${surface.rx * 0.9} ${-surface.ry * 0.3}`}
        stroke={base.shine}
        strokeOpacity="0.55"
        strokeWidth="2.2"
      />
      <path
        d={`M${surface.cx + surface.rx * 0.1} ${surface.cy + surface.ry * 0.9} q${surface.rx * 0.35} ${-surface.ry * 0.5} ${surface.rx * 0.7} ${-surface.ry * 0.2}`}
        stroke={base.body}
        strokeOpacity="0.6"
        strokeWidth="2"
      />
    </g>
  )
}

function ShakeSwirl({ g, base }: { g: Geometry; base: BaseColors }) {
  const { top } = g.shape
  const y = g.rimY + g.shape.height * 0.35
  return (
    <path
      d={`M${CX - top * 0.8} ${y} c${top * 0.4} ${-10} ${top * 0.8} ${12} ${top * 1.6} ${-2}`}
      fill="none"
      stroke={base.shine}
      strokeOpacity="0.7"
      strokeWidth="5"
      strokeLinecap="round"
    />
  )
}

function ShakeGlassDetails({ g }: { g: Geometry }) {
  const { top, bottom } = g.shape
  return (
    <g stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1">
      <line x1={CX - top * 0.25} y1={g.rimY + 6} x2={CX - bottom * 0.25} y2={GROUND - 12} />
      <line x1={CX + top * 0.3} y1={g.rimY + 6} x2={CX + bottom * 0.3} y2={GROUND - 12} />
      {/* fundo grosso do copo de vidro */}
      <path
        d={`M${CX - bottom + 1} ${GROUND - 9} A${bottom} ${bottom * 0.2} 0 0 0 ${CX + bottom - 1} ${GROUND - 9}`}
        fill="none"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
    </g>
  )
}

const pieceMotion = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
}

/** Desenho de um ingrediente. `seed` deixa cada um com posições próprias e fixas. */
export function ToppingArt({
  g,
  look,
  quantity,
  seed,
}: {
  g: Geometry
  look: ToppingLook
  quantity: number
  seed: string
}) {
  switch (look.kind) {
    case 'drizzle':
      return <Drizzle g={g} color={look.color} seed={seed} />
    case 'powder':
      return <Powder g={g} look={look} seed={seed} />
    case 'bits':
      return <Bits g={g} look={look} quantity={quantity} seed={seed} />
    case 'slices':
      return <Slices g={g} fruit={look.fruit} seed={seed} />
    case 'dollop':
      return <Dollop g={g} look={look} quantity={quantity} />
    case 'stick':
      return <Sticks g={g} quantity={quantity} />
    case 'bar':
      return <Bars g={g} look={look} quantity={quantity} seed={seed} />
    case 'cherry':
      return <Cherries g={g} quantity={quantity} />
  }
}

function Drizzle({ g, color, seed }: { g: Geometry; color: string; seed: string }) {
  const random = seededRandom(seed)
  const { surface } = g
  const flip = random() < 0.5 ? 1 : -1
  const points = Array.from({ length: 6 }, (_, k) => ({
    x: surface.cx - surface.rx * 0.95 + (k * surface.rx * 1.9) / 5,
    y: surface.cy + (k % 2 === 0 ? 1 : -1) * flip * surface.ry * (0.55 + random() * 0.35),
  }))
  let d = `M${points[0].x} ${points[0].y}`
  for (let k = 1; k < points.length; k++) {
    const mx = (points[k - 1].x + points[k].x) / 2
    d += ` Q${points[k - 1].x + (mx - points[k - 1].x) * 0.2} ${points[k - 1].y} ${mx} ${(points[k - 1].y + points[k].y) / 2}`
  }
  d += ` T${points[5].x} ${points[5].y}`

  const drips = [0.3 + random() * 0.15, 0.62 + random() * 0.15].map((fraction) => {
    const x = CX - g.shape.top * 0.9 + fraction * g.shape.top * 1.8
    const length = 6 + random() * 9
    return { x, length }
  })

  return (
    <g>
      {/* contorno claro: separa caldas escuras, como a de chocolate, do açaí */}
      <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="6.2" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="4.4" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
      {drips.map(({ x, length }) => (
        <g key={x}>
          <line
            x1={x}
            y1={g.rimY - 1}
            x2={x}
            y2={g.rimY + length}
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={x} cy={g.rimY + length + 1} r="2.3" fill={color} />
        </g>
      ))}
    </g>
  )
}

function Powder({
  g,
  look,
  seed,
}: {
  g: Geometry
  look: Extract<ToppingLook, { kind: 'powder' }>
  seed: string
}) {
  const { surface } = g
  const mid = (look.from + look.to) / 2
  const area = {
    cx: surface.cx + (mid - 0.5) * surface.rx * 1.6,
    cy: surface.cy - surface.ry * 0.1,
    rx: (look.to - look.from) * surface.rx * 1.05,
    ry: surface.ry * 0.85,
  }
  return (
    <g>
      <ellipse cx={area.cx} cy={area.cy} rx={area.rx} ry={area.ry} fill={look.color} fillOpacity="0.95" />
      {scatter(seed, 14, { ...area, rx: area.rx * 0.9, ry: area.ry * 0.8 }).map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="0.9" fill={look.speck} />
      ))}
    </g>
  )
}

function Bit({ shape, size, color }: { shape: BitShape; size: number; color: string }) {
  const s = size
  switch (shape) {
    case 'round':
      return (
        <g>
          <circle r={s / 2} fill={color} />
          <circle cx={-s * 0.15} cy={-s * 0.15} r={s * 0.14} fill="#ffffff" fillOpacity="0.35" />
        </g>
      )
    case 'chip':
      return (
        <polygon
          points={`${-s * 0.6},${-s * 0.2} ${-s * 0.1},${-s * 0.55} ${s * 0.6},${-s * 0.25} ${s * 0.35},${s * 0.45} ${-s * 0.4},${s * 0.4}`}
          fill={color}
        />
      )
    case 'square':
      return <rect x={-s / 2} y={-s * 0.4} width={s} height={s * 0.8} rx={0.8} fill={color} />
    case 'flake':
      return <ellipse rx={s * 0.6} ry={s * 0.34} fill={color} />
    case 'drop':
      return (
        <path
          d={`M0 ${-s} Q${s * 0.9} ${s * 0.45} 0 ${s * 0.55} Q${-s * 0.9} ${s * 0.45} 0 ${-s} Z`}
          fill={color}
        />
      )
    case 'pillow':
      return (
        <rect
          x={-s / 2}
          y={-s * 0.4}
          width={s}
          height={s * 0.8}
          rx={1.6}
          fill={color}
          stroke="#2c0a21"
          strokeOpacity="0.12"
          strokeWidth="0.5"
        />
      )
  }
}

function Bits({
  g,
  look,
  quantity,
  seed,
}: {
  g: Geometry
  look: Extract<ToppingLook, { kind: 'bits' }>
  quantity: number
  seed: string
}) {
  const count = Math.min(4 + quantity * 3, 14)
  return (
    <g>
      {scatter(seed, count, g.surface).map((point, index) => (
        <m.g
          key={index}
          initial={pieceMotion.initial}
          animate={pieceMotion.animate}
          transition={{ delay: (index % 6) * 0.025, type: 'spring', stiffness: 520, damping: 30 }}
        >
          <g transform={`translate(${point.x} ${point.y}) rotate(${point.r})`}>
            <Bit shape={look.shape} size={look.size} color={look.colors[index % look.colors.length]} />
          </g>
        </m.g>
      ))}
    </g>
  )
}

function FruitSlice({ fruit }: { fruit: 'banana' | 'kiwi' | 'morango' }) {
  switch (fruit) {
    case 'banana':
      return (
        <g>
          <ellipse rx="7.5" ry="5" fill="#f6e7a8" stroke="#e5c96f" strokeWidth="0.8" />
          <ellipse rx="3" ry="2" fill="none" stroke="#d8b65a" strokeOpacity="0.7" strokeWidth="0.7" />
        </g>
      )
    case 'kiwi':
      return (
        <g>
          <ellipse rx="8" ry="5.4" fill="#6f9e2c" />
          <ellipse rx="6.6" ry="4.3" fill="#a9d05a" />
          <ellipse rx="2.6" ry="1.7" fill="#f2f4d6" />
          {[0, 60, 120, 180, 240, 300].map((angle) => (
            <circle
              key={angle}
              cx={Math.cos((angle * Math.PI) / 180) * 4}
              cy={Math.sin((angle * Math.PI) / 180) * 2.8}
              r="0.55"
              fill="#2a1d10"
            />
          ))}
        </g>
      )
    case 'morango':
      return (
        <g>
          <path d="M0 7 C-8 2 -7 -6 -2 -6 Q0 -5 2 -6 C7 -6 8 2 0 7 Z" fill="#d7263d" />
          <path d="M0 5 C-5 1 -4.5 -4 -1.5 -4 Q0 -3.5 1.5 -4 C4.5 -4 5 1 0 5 Z" fill="#f59aa6" />
          <path d="M0 -3.5 L0 3" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="0.8" />
          <path d="M-3 -6 Q0 -9 3 -6" fill="#3f8f3a" />
        </g>
      )
  }
}

function Slices({ g, fruit, seed }: { g: Geometry; fruit: 'banana' | 'kiwi' | 'morango'; seed: string }) {
  const area = { ...g.surface, rx: g.surface.rx * 0.82, ry: g.surface.ry * 0.7 }
  return (
    <g>
      {scatter(seed, 3, area).map((point, index) => (
        <m.g
          key={index}
          initial={pieceMotion.initial}
          animate={pieceMotion.animate}
          transition={{ delay: index * 0.05, type: 'spring', stiffness: 420, damping: 24 }}
        >
          <g transform={`translate(${point.x} ${point.y}) rotate(${(point.r % 50) - 25}) scale(1.35)`}>
            <FruitSlice fruit={fruit} />
          </g>
        </m.g>
      ))}
    </g>
  )
}

function Dollop({
  g,
  look,
  quantity,
}: {
  g: Geometry
  look: Extract<ToppingLook, { kind: 'dollop' }>
  quantity: number
}) {
  const x = CX + (look.at - 0.5) * g.surface.rx * 1.5
  const y = g.surface.cy - 1
  const grow = Math.min(1.25 + (quantity - 1) * 0.12, 1.75)
  return (
    <g transform={`translate(${x} ${y}) scale(${grow})`}>
      <ellipse cy="0" rx="12" ry="5.2" fill={look.color} />
      <ellipse cy="-4" rx="8.5" ry="4.2" fill={look.color} />
      <ellipse cy="-7.6" rx="4.6" ry="3" fill={look.color} />
      <ellipse cx="-3" cy="-5" rx="3" ry="1.3" fill={look.shine} fillOpacity="0.8" />
    </g>
  )
}

function Sticks({ g, quantity }: { g: Geometry; quantity: number }) {
  const spots = [
    { dx: -0.35, angle: -28 },
    { dx: 0.4, angle: 24 },
  ].slice(0, Math.min(quantity, 2))
  return (
    <g>
      {spots.map(({ dx, angle }) => (
        <g
          key={dx}
          transform={`translate(${CX + g.surface.rx * dx} ${g.surface.cy}) rotate(${angle})`}
        >
          <rect x="-3.2" y="-36" width="6.4" height="36" rx="3.2" fill="#e8c387" />
          {[6, 12, 18, 24, 30].map((offset) => (
            <line
              key={offset}
              x1="-3"
              y1={-offset}
              x2="3"
              y2={-offset - 4}
              stroke="#b98443"
              strokeWidth="1.1"
            />
          ))}
        </g>
      ))}
    </g>
  )
}

function Bars({
  g,
  look,
  quantity,
  seed,
}: {
  g: Geometry
  look: Extract<ToppingLook, { kind: 'bar' }>
  quantity: number
  seed: string
}) {
  const random = seededRandom(seed)
  const offset = (random() - 0.5) * 0.3
  const spots = [
    { dx: 0.28 + offset, angle: 14 },
    { dx: -0.32 + offset, angle: -12 },
    { dx: 0.02 + offset, angle: 4 },
  ].slice(0, Math.min(quantity, 3))
  return (
    <g>
      {spots.map(({ dx, angle }) => (
        <g key={dx} transform={`translate(${CX + g.surface.rx * dx} ${g.surface.cy + 2}) rotate(${angle})`}>
          <rect
            x={-look.width / 2}
            y={-look.length}
            width={look.width}
            height={look.length}
            rx="2"
            fill={look.color}
          />
          <rect
            x={-look.width / 2 + 1.2}
            y={-look.length + 1.5}
            width="2"
            height={look.length - 3}
            rx="1"
            fill={look.shine}
          />
          {look.width > 9 && (
            <line
              x1="0"
              y1={-look.length + 2}
              x2="0"
              y2="-2"
              stroke="#2c0a21"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          )}
        </g>
      ))}
    </g>
  )
}

function Cherries({ g, quantity }: { g: Geometry; quantity: number }) {
  const apex = g.rimY - g.domeH
  const spots = [
    { dx: 0, dy: -3 },
    { dx: -11, dy: 1 },
    { dx: 11, dy: 1 },
  ].slice(0, Math.min(quantity, 3))
  return (
    <g>
      {spots.map(({ dx, dy }) => (
        <g key={dx} transform={`translate(${CX + dx} ${apex + dy})`}>
          <path d="M0 -6 Q2 -15 9 -18" fill="none" stroke="#5a6b23" strokeWidth="1.6" strokeLinecap="round" />
          <circle r="7.6" fill="#c1121f" />
          <circle cx="-2.6" cy="-2.6" r="2.1" fill="#ffffff" fillOpacity="0.55" />
        </g>
      ))}
    </g>
  )
}
