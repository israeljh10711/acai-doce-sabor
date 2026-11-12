import type { ReactNode } from 'react'

type StepHeadingProps = {
  number: number
  title: string
  id: string
  /** Texto curto à direita do título: regra do grupo, contador de grátis etc. */
  hint?: ReactNode
  hintId?: string
  /** Destaca a dica, por exemplo quando o limite gratuito foi atingido. */
  hintTone?: 'neutral' | 'alert'
}

/** Título numerado de um passo do personalizador. */
export function StepHeading({ number, title, id, hint, hintId, hintTone = 'neutral' }: StepHeadingProps) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="flex items-baseline gap-2.5 font-display text-2xl font-semibold tracking-tight text-plum-900">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 translate-y-[-2px] place-items-center rounded-full bg-plum-700 font-sans text-sm font-bold text-white"
        >
          {number}
        </span>
        <span>
          <span className="sr-only">Passo {number}: </span>
          {title}
        </span>
      </h2>
      {hint && (
        <p
          id={hintId}
          className={`text-sm font-semibold ${hintTone === 'alert' ? 'text-berry-700' : 'text-plum-950/70'}`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
