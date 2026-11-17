import { m } from 'motion/react'
import { type FormEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Info } from '../../components/ui/icons.tsx'
import { formatBRL } from '../../utils/money.ts'
import { type ChoiceDraft, OTHER_OPTION, draftChoices } from './choiceDraft.ts'
import {
  type ExtraItem,
  OTHER_MAX_LENGTH,
  choiceGroupsOf,
  cleanOtherText,
  extraPriceCents,
  hasPricedChoices,
} from './extras.ts'
import { ExtraVisual } from './ItemVisual.tsx'
import { FLAVOR_AVAILABILITY_NOTICE } from './notices.ts'

type ExtraOptionsDialogProps = {
  open: boolean
  item: ExtraItem
  draft: ChoiceDraft
  onChange: (draft: ChoiceDraft) => void
  /** Tudo escolhido: segue para a confirmação. */
  onContinue: () => void
  /** Fecha sem adicionar (Cancelar, Esc ou toque fora da janela). */
  onCancel: () => void
  opener: RefObject<HTMLElement | null>
}

const action =
  'inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2 text-base leading-tight font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800'

/**
 * Escolha do sabor de um item das gavetas (pedido de 2026-11-15). Cada grupo é obrigatório;
 * alguns aceitam "Outro sabor", escrito pelo cliente (até 40 caracteres). "Continuar" leva à
 * confirmação; a escolha fica guardada se o cliente voltar para editar. Desde 2026-11-16: com o
 * sabor marcado, a foto do pote daquele sabor (quando a loja mandou); no Açaí do Oca, a escolha
 * é o tamanho, cada um com o seu preço.
 */
export function ExtraOptionsDialog({ open, item, draft, onChange, onContinue, onCancel, opener }: ExtraOptionsDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const groups = choiceGroupsOf(item)
  const choices = draftChoices(item, draft)
  const priced = hasPricedChoices(item)
  const pricedPicked = groups.some((group) => group.prices?.[choices[group.id]] !== undefined)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      // Foco na opção marcada (ao voltar para editar) ou na primeira.
      const target =
        element.querySelector<HTMLInputElement>('input[type=radio]:checked') ?? element.querySelector<HTMLInputElement>('input')
      target?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  const pick = (groupId: string, option: string) => {
    onChange({ ...draft, picked: { ...draft.picked, [groupId]: option } })
    setErrors((current) => ({ ...current, [groupId]: '' }))
  }

  const write = (groupId: string, text: string) => {
    onChange({ ...draft, other: { ...draft.other, [groupId]: text } })
    setErrors((current) => ({ ...current, [groupId]: '' }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    for (const group of groups) {
      const picked = draft.picked[group.id]
      if (!picked) found[group.id] = 'Escolha uma opção.'
      else if (picked === OTHER_OPTION && !cleanOtherText(draft.other[group.id] ?? '')) {
        found[group.id] = 'Escreva o sabor que você quer.'
      }
    }
    setErrors(found)
    const firstInvalid = groups.find((group) => found[group.id])
    if (!firstInvalid) {
      onContinue()
      return
    }
    const fieldset = dialog.current?.querySelector(`[data-group="${firstInvalid.id}"]`)
    const target =
      draft.picked[firstInvalid.id] === OTHER_OPTION
        ? fieldset?.querySelector<HTMLInputElement>('input[type=text]')
        : fieldset?.querySelector<HTMLInputElement>('input[type=radio]')
    target?.focus()
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="opcoes-item-titulo"
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      onClose={() => {
        if (!open) return
        onCancel()
        opener.current?.focus()
      }}
      className="m-auto max-h-[94dvh] w-[min(94vw,30rem)] overflow-hidden rounded-3xl bg-white p-0 shadow-lift backdrop:bg-acai-950/70"
    >
      {open && (
        <m.form
          noValidate
          onSubmit={submit}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="flex max-h-[94dvh] flex-col"
        >
          <h2
            id="opcoes-item-titulo"
            className="bg-acai-800 px-5 py-4 font-display text-xl leading-tight font-black tracking-tight text-white uppercase"
          >
            {groups.length > 1
              ? groups.some((group) => group.prices)
                ? 'Escolha o tamanho e o sabor'
                : 'Escolha os sabores'
              : groups[0]?.prices
                ? 'Escolha o tamanho'
                : 'Escolha o sabor'}
          </h2>

          <div className="overflow-y-auto px-5 pt-5 pb-4">
            <div className="flex items-center gap-4">
              <ExtraVisual item={item} zoom choices={choices} />
              <div className="min-w-0">
                <p className="font-display text-lg leading-snug font-black text-acai-800">{item.name}</p>
                <p className="nums font-bold text-acai-950" aria-live="polite">
                  {priced && !pricedPicked && <span className="font-semibold text-ink-soft">a partir de </span>}
                  {formatBRL(extraPriceCents(item, choices))}
                </p>
              </div>
            </div>

            {groups.map((group) => {
              const errorId = `${item.id}-${group.id}-erro`
              const otherId = `${item.id}-${group.id}-outro`
              const error = errors[group.id]
              const options = group.allowOther ? [...group.options, OTHER_OPTION] : group.options
              return (
                <fieldset
                  key={group.id}
                  data-group={group.id}
                  aria-describedby={error ? errorId : undefined}
                  className="mt-5 min-w-0"
                >
                  <legend className="text-sm font-extrabold tracking-wide text-acai-800 uppercase">{group.label}</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {options.map((option) => {
                      // Esgotada pelo vendedor (2026-11-17): desligada, com o aviso.
                      const soldOut = group.unavailable?.includes(option) ?? false
                      return (
                      <label
                        key={option}
                        className={`group relative flex min-h-12 items-center gap-2 rounded-2xl border-2 border-line bg-white px-3 py-2 text-sm leading-tight font-semibold text-acai-950 transition duration-200 has-checked:border-gold-400 has-checked:bg-gold-100 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800 ${
                          soldOut ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-acai-600/40'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`${item.id}-${group.id}`}
                          value={option}
                          checked={draft.picked[group.id] === option}
                          disabled={soldOut}
                          onChange={() => pick(group.id, option)}
                          className="sr-only"
                        />
                        <span className={`min-w-0 flex-1 ${group.prices ? 'whitespace-nowrap' : ''}`}>
                          {option === OTHER_OPTION ? 'Outro sabor' : option}
                        </span>
                        {soldOut && (
                          <span className="shrink-0 rounded-md bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-extrabold tracking-wide text-white uppercase">
                            Esgotado
                          </span>
                        )}
                        {group.prices?.[option] !== undefined && !soldOut && (
                          <span className="nums shrink-0 font-extrabold whitespace-nowrap text-acai-800">
                            {formatBRL(group.prices[option])}
                          </span>
                        )}
                        <span
                          aria-hidden="true"
                          className="hidden size-5 shrink-0 place-items-center rounded-full bg-acai-800 text-gold-400 group-has-checked:grid"
                        >
                          <Check className="size-3.5" />
                        </span>
                      </label>
                      )
                    })}
                  </div>

                  {draft.picked[group.id] === OTHER_OPTION && (
                    <div className="mt-3">
                      <label htmlFor={otherId} className="text-sm font-semibold text-acai-950">
                        Qual sabor?
                      </label>
                      <input
                        id={otherId}
                        type="text"
                        value={draft.other[group.id] ?? ''}
                        onChange={(event) => write(group.id, event.target.value)}
                        maxLength={OTHER_MAX_LENGTH}
                        autoComplete="off"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? errorId : undefined}
                        placeholder="Escreva o sabor"
                        className="mt-1 min-h-12 w-full rounded-xl bg-white px-3 text-base text-acai-950 ring-1 ring-line outline-none placeholder:text-ink-soft focus:ring-2 focus:ring-acai-700"
                      />
                    </div>
                  )}

                  {error && (
                    <p id={errorId} role="alert" className="mt-2 text-sm font-bold text-red-800">
                      {error}
                    </p>
                  )}
                </fieldset>
              )
            })}

            {/* O aviso é sobre sabores: não aparece na escolha só de tamanho. */}
            {!groups.every((group) => group.prices) && (
              <p className="mt-5 flex gap-2.5 rounded-2xl bg-gold-100 px-4 py-3 text-sm font-medium text-acai-950 ring-1 ring-gold-400">
                <Info className="mt-0.5 size-4 text-acai-700" />
                {FLAVOR_AVAILABILITY_NOTICE}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-line px-5 pt-4 pb-5">
            <button type="submit" className={`btn-gold ${action}`}>
              Continuar
              <ArrowRight className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={`text-acai-800 ring-1 ring-acai-800/35 transition hover:bg-acai-100 ${action}`}
            >
              Cancelar
            </button>
          </div>
        </m.form>
      )}
    </dialog>
  )
}
