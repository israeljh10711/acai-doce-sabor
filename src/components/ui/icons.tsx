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
