import { ZoomIn } from '../../components/ui/icons.tsx'
import { type LightboxOrigin, useLightbox } from './lightboxContext.ts'
import type { LightboxImage } from './lightboxImages.ts'

type ZoomButtonProps = {
  image: LightboxImage
  origin?: LightboxOrigin
  /** Posição: por padrão cobre a foto inteira (o quadro em volta precisa ser `relative`). */
  className?: string
  /** Lupa menor nas miniaturas de até 48 px. */
  badge?: 'sm' | 'md'
}

/**
 * Toque na foto: abre a foto ampliada (pedido de 2026-11-16). É um botão por cima da foto, irmão
 * do botão do cartão (nunca dentro dele): tocar na foto não marca o adicional, não abre o
 * personalizador nem aceita a oferta. A lupa no canto mostra que a foto amplia.
 */
export function ZoomButton({ image, origin = 'page', className = 'absolute inset-0', badge = 'md' }: ZoomButtonProps) {
  const { show } = useLightbox()
  return (
    <button
      type="button"
      aria-label={`Ampliar foto: ${image.title}`}
      aria-haspopup="dialog"
      data-zoom={image.id}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        show(image, event.currentTarget, origin)
      }}
      // Contorno de foco roxo com borda branca por dentro: aparece sobre foto clara ou escura.
      className={`group/zoom z-10 cursor-zoom-in rounded-[inherit] focus-visible:shadow-[inset_0_0_0_3px_var(--color-acai-800),inset_0_0_0_5px_#fff] focus-visible:outline-none ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute grid place-items-center rounded-full bg-black/45 text-white transition-colors group-hover/zoom:bg-black/70 ${
          badge === 'sm' ? 'right-0.5 bottom-0.5 size-5 p-0.5' : 'right-1.5 bottom-1.5 size-6 p-1'
        }`}
      >
        <ZoomIn className="size-full" />
      </span>
    </button>
  )
}
