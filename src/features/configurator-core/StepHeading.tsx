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
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2
        id={id}
        className="flex items-center gap-3 font-display text-2xl font-black tracking-tight text-acai-800 uppercase"
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-acai-800 text-lg font-black text-orchid-400"
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
          className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors duration-200 ${
            hintTone === 'alert' ? 'bg-orchid-400 text-acai-950' : 'bg-acai-100 text-acai-800'
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
