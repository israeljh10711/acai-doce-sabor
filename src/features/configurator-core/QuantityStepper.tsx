import { m } from 'motion/react'
import { useState } from 'react'
import { Minus, Plus } from '../../components/ui/icons.tsx'
import { AnimatedValue } from './AnimatedValue.tsx'

type QuantityStepperProps = {
  /** Nome do item, usado nos botões: "Adicionar Granola", "Tirar Granola". */
  label: string
  quantity: number
  onAdd: () => void
  onRemove: () => void
  /** Motivo de o + estar bloqueado. Sem motivo, o + adiciona. */
  addBlockedReason: string | null
  /** Elemento que explica o bloqueio, para leitores de tela. */
  describedBy?: string
  className?: string
}

const buttonClass =
  'grid size-11 cursor-pointer place-items-center rounded-full transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Contador com − e +, com o número que rola ao mudar e o botão que "aperta" ao toque
 * (padrão adaptado do Quantity Stepper do 21st.dev).
 *
 * Quando o limite impede adicionar, o + continua focável e, ao toque, o contador balança e a
 * dica do passo explica o motivo, em vez de simplesmente não responder.
 */
export function QuantityStepper({
  label,
  quantity,
  onAdd,
  onRemove,
  addBlockedReason,
  describedBy,
  className = '',
}: QuantityStepperProps) {
  const [shaking, setShaking] = useState(false)
  const blocked = addBlockedReason !== null

  return (
    <div
      role="group"
      aria-label={`${label}: ${quantity}`}
      onAnimationEnd={() => setShaking(false)}
      className={`flex shrink-0 items-center gap-0.5 rounded-full bg-white p-0.5 ring-1 ring-line ${shaking ? 'animate-shake' : ''} ${className}`}
    >
      <m.button
        type="button"
        aria-label={`Tirar ${label}`}
        disabled={quantity === 0}
        onClick={onRemove}
        whileTap={quantity === 0 ? undefined : { scale: 0.85 }}
        className={`${buttonClass} text-acai-800 hover:bg-acai-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        <Minus className="size-5" />
      </m.button>

      <span aria-hidden="true" className="nums w-7 text-center text-lg font-bold text-acai-950">
        <AnimatedValue value={String(quantity)} />
      </span>

      <m.button
        type="button"
        aria-label={`Adicionar ${label}`}
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? describedBy : undefined}
        title={addBlockedReason ?? undefined}
        onClick={() => (blocked ? setShaking(true) : onAdd())}
        whileTap={blocked ? undefined : { scale: 0.85 }}
        className={`${buttonClass} ${
          blocked ? 'cursor-not-allowed bg-acai-100 text-acai-800/45' : 'bg-acai-800 text-white hover:bg-acai-700'
        }`}
      >
        <Plus className="size-5" />
      </m.button>
    </div>
  )
}
