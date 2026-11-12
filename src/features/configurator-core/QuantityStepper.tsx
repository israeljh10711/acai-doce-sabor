import { AnimatedValue } from './AnimatedValue.tsx'

type QuantityStepperProps = {
  /** Nome do item, usado nos botões: "Adicionar Granola", "Tirar Granola". */
  label: string
  quantity: number
  onAdd: () => void
  onRemove: () => void
  /** Motivo de o + estar desabilitado. Sem motivo, o + fica habilitado. */
  addBlockedReason: string | null
  /** Elemento que explica o bloqueio, para leitores de tela. */
  describedBy?: string
}

const buttonClass =
  'grid size-11 place-items-center rounded-full border text-xl leading-none font-semibold transition duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600'

/** Contador com − e +, com o número que rola ao mudar. */
export function QuantityStepper({
  label,
  quantity,
  onAdd,
  onRemove,
  addBlockedReason,
  describedBy,
}: QuantityStepperProps) {
  return (
    <div role="group" aria-label={`${label}: ${quantity}`} className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={`Tirar ${label}`}
        disabled={quantity === 0}
        onClick={onRemove}
        className={`${buttonClass} border-cream-200 bg-white text-plum-900 hover:border-plum-700/40`}
      >
        <span aria-hidden="true">−</span>
      </button>

      <span aria-hidden="true" className="w-7 text-center text-lg font-semibold text-plum-900 tabular-nums">
        <AnimatedValue value={String(quantity)} />
      </span>

      <button
        type="button"
        aria-label={`Adicionar ${label}`}
        disabled={addBlockedReason !== null}
        aria-describedby={addBlockedReason ? describedBy : undefined}
        title={addBlockedReason ?? undefined}
        onClick={onAdd}
        className={`${buttonClass} border-berry-600 bg-berry-600 text-white hover:bg-berry-700`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  )
}
