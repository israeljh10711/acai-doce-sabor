import type { ReactNode } from 'react'

/**
 * Ícones do site, desenhados em SVG (no lugar de símbolos de texto como ✕ e →, que mudam de
 * fonte para fonte). Todos são decorativos: o texto ao lado, ou o nome acessível do botão,
 * diz o que o ícone significa.
 */
type IconProps = { className?: string }

function Icon({ className = 'size-5', children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

export const ArrowRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const ArrowLeft = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
)

export const Close = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const Expand = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </Icon>
)

export const Check = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)

export const Plus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const Minus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
  </Icon>
)

/** Giro: setas em volta, para "arraste para girar". */
export const Rotate = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 12a8 8 0 0 1-14.2 5M4 12a8 8 0 0 1 14.2-5" />
    <path d="M18.5 3v4h-4M5.5 21v-4h4" />
  </Icon>
)

export const Chat = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z" />
  </Icon>
)

export const Camera = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.2 6.8h.01" />
  </Icon>
)

export const Pin = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Icon>
)

export const Info = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
)

export const Bag = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </Icon>
)

/** Coroa: selo "Especialidade da casa". */
export const Crown = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8l4 4 4-6 4 6 4-4-1.6 10H5.6L4 8Z" />
  </Icon>
)

/** Chama: selo "O mais pedido". */
export const Flame = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 21c3.6 0 6-2.5 6-5.8 0-3.4-2.6-5.6-3.6-8.7-.3-.9-1.4-1-1.8-.2-.9 1.8-1.6 2.6-2.6 3.2-.1-1-.5-1.9-1.1-2.7-.4-.5-1.2-.3-1.4.3C6.6 9.2 6 11.2 6 15.2 6 18.5 8.4 21 12 21Z" />
  </Icon>
)

/** Moto de entrega (o "🛵" pedido em 2026-11-17). */
export const Scooter = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6" cy="17" r="2.5" />
    <circle cx="18" cy="17" r="2.5" />
    <path d="M8.5 17h5.5l3-7.5h2" />
    <path d="M14 17l-2.5-5H4" />
    <rect x="4" y="5" width="6" height="5" rx="1" />
  </Icon>
)

/** Fachada de loja (retirada no balcão, o "🏪" pedido em 2026-11-17). */
export const Storefront = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 11v9h15v-9" />
    <path d="M3 10l2-6h14l2 6" />
    <path d="M3 10a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0" />
    <path d="M10 20v-5h4v5" />
  </Icon>
)

/** Proibido: item esgotado (o "🚫" pedido em 2026-11-17). */
export const Ban = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
)

/** Lua: loja fechada. */
export const Moon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Icon>
)

export const Clock = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const Trash = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.3h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7" />
  </Icon>
)

export const Pencil = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
)

/** Código QR genérico, para o Pix (sem usar a marca oficial). */
export const QrCode = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
    <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
    <path d="M14 14h3v3M20.5 14v.01M14 20.5h.01M17.5 20.5h3v-3" />
  </Icon>
)

export const CreditCard = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19M6.5 15h4" />
  </Icon>
)

export const Banknote = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 9.5v.01M18 14.5v.01" />
  </Icon>
)

export const Copy = (props: IconProps) => (
  <Icon {...props}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
  </Icon>
)

/*
 * Ícones do Lucide (lucide.dev, pacote lucide-static 0.460.0), copiados para cá no mesmo formato
 * dos ícones acima, sem instalar pacote. Licença do Lucide:
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 * All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without
 * fee is hereby granted, provided that the above copyright notice and this permission notice
 * appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
 * SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
 * AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

export const Search = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Icon>
)

export const ChevronDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const Gift = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </Icon>
)

export const IceCreamBowl = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 17c5 0 8-2.69 8-6H4c0 3.31 3 6 8 6m-4 4h8m-4-3v3M5.14 11a3.5 3.5 0 1 1 6.71 0" />
    <path d="M12.14 11a3.5 3.5 0 1 1 6.71 0" />
    <path d="M15.5 6.5a3.5 3.5 0 1 0-7 0" />
  </Icon>
)

export const IceCreamCone = (props: IconProps) => (
  <Icon {...props}>
    <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
    <path d="M17 7A5 5 0 0 0 7 7" />
    <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
  </Icon>
)

export const Popsicle = (props: IconProps) => (
  <Icon {...props}>
    <path d="M18.6 14.4c.8-.8.8-2 0-2.8l-8.1-8.1a4.95 4.95 0 1 0-7.1 7.1l8.1 8.1c.9.7 2.1.7 2.9-.1Z" />
    <path d="m22 22-5.5-5.5" />
  </Icon>
)

export const CupSoda = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8" />
    <path d="M5 8h14" />
    <path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
    <path d="m12 8 1-6h2" />
  </Icon>
)

export const Candy = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9.5 7.5-2 2a4.95 4.95 0 1 0 7 7l2-2a4.95 4.95 0 1 0-7-7Z" />
    <path d="M14 6.5v10" />
    <path d="M10 7.5v10" />
    <path d="m16 7 1-5 1.37.68A3 3 0 0 0 19.7 3H21v1.3c0 .46.1.92.32 1.33L22 7l-5 1" />
    <path d="m8 17-1 5-1.37-.68A3 3 0 0 0 4.3 21H3v-1.3a3 3 0 0 0-.32-1.33L2 17l5-1" />
  </Icon>
)

export const Sailboat = (props: IconProps) => (
  <Icon {...props}>
    <path d="M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z" />
    <path d="M21 14 10 2 3 14h18Z" />
    <path d="M10 2v16" />
  </Icon>
)

export const GlassWater = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z" />
    <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0" />
  </Icon>
)

export const Menu = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12h16" />
    <path d="M4 6h16" />
    <path d="M4 18h16" />
  </Icon>
)

export const Sparkles = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </Icon>
)

export const RotateCcw = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
)

export const Lock = (props: IconProps) => (
  <Icon {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
)

export const LockOpen = (props: IconProps) => (
  <Icon {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </Icon>
)

export const Eye = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

export const EyeOff = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Icon>
)

export const Download = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Icon>
)

export const Upload = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5" />
    <path d="M12 3v12" />
  </Icon>
)

export const Tag = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
    <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
  </Icon>
)

/** Sino do Lucide (mesma licença acima): reativar as ofertas. */
export const Bell = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </Icon>
)

/** Lupa com "+" do Lucide (zoom-in, mesma licença acima): ampliar a foto. */
export const ZoomIn = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
  </Icon>
)

/** Lupa com "−" do Lucide (zoom-out, mesma licença acima): reduzir a foto. */
export const ZoomOut = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35M8 11h6" />
  </Icon>
)
