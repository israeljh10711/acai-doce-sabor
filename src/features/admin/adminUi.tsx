/**
 * Peças dos formulários do painel do vendedor (cardápio dinâmico, 2026-11-21): campo com rótulo e
 * aviso, preço em reais, chave liga/desliga, "Subir"/"Descer", barra de salvar e foto. Tudo com os
 * estilos das janelas do vendedor (`sellerStyles.ts`).
 */
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Camera } from '../../components/ui/icons.tsx'
import { formatPriceInput, parsePriceInput } from '../seller/sellerForm.ts'
import { compressPhoto } from '../seller/photo.ts'
import { useSellerMode } from '../seller/sellerModeContext.ts'
import { DIRTY_TEXT, SAVED_TEXT, type SaveState, dangerButton, describe, inputClass, labelClass, primaryButton, quietButton } from './adminKit.ts'

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-dica`} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erro`} role="alert" data-field-error={id} className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

/** Preço em reais ("12,50"). Vazio vale `null` quando `optional`. */
export function MoneyInput({
  id,
  cents,
  onChange,
  optional = false,
  error,
  hint,
}: {
  id: string
  cents: number | null
  onChange: (cents: number | null) => void
  optional?: boolean
  error?: string | null
  hint?: string
}) {
  const [raw, setRaw] = useState(() => (cents === null ? '' : formatPriceInput(cents)))
  const last = useRef(cents)
  useEffect(() => {
    // Valor trocado por fora (outro tamanho, desfazer): mostra o novo.
    if (cents !== last.current) {
      last.current = cents
      setRaw(cents === null ? '' : formatPriceInput(cents))
    }
  }, [cents])
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base font-semibold text-ink-soft">
        R$
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={raw}
        placeholder={optional ? 'Sem valor' : '0,00'}
        onChange={(event) => {
          setRaw(event.target.value)
          const parsed = event.target.value.trim() === '' ? null : parsePriceInput(event.target.value)
          const next = parsed === null && !optional ? -1 : parsed
          last.current = next
          onChange(next)
        }}
        className={`${inputClass} pl-11`}
        {...describe(id, hint, error)}
      />
    </div>
  )
}

/** Número inteiro (adicionais grátis, mínimo, máximo). Vazio vale `null` quando `optional`. */
export function CountInput({
  id,
  value,
  onChange,
  optional = false,
  error,
  hint,
}: {
  id: string
  value: number | null
  onChange: (value: number | null) => void
  optional?: boolean
  error?: string | null
  hint?: string
}) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={value === null ? '' : String(value)}
      placeholder={optional ? 'Sem limite' : '0'}
      onChange={(event) => {
        const text = event.target.value.replace(/\D/g, '').slice(0, 3)
        onChange(text === '' ? (optional ? null : 0) : Number(text))
      }}
      className={inputClass}
      {...describe(id, hint, error)}
    />
  )
}

/** Liga/desliga com o texto do que liga. */
export function Switch({ checked, onChange, label, description, name }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; name?: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-1 py-1.5">
      <input id={id} name={name} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full bg-acai-200 transition peer-checked:bg-emerald-700 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acai-800 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-acai-900">{label}</span>
        {description && <span className="block text-xs text-ink-soft">{description}</span>}
      </span>
    </label>
  )
}

/** "↑ Subir" e "↓ Descer" de um item numa lista ordenada. */
export function MoveButtons({ label, first, last, onMove, busy = false }: { label: string; first: boolean; last: boolean; onMove: (step: -1 | 1) => void; busy?: boolean }) {
  return (
    <span className="inline-flex gap-1">
      <button type="button" data-move="subir" disabled={first || busy} onClick={() => onMove(-1)} className={`${quietButton} min-h-10 px-2.5`}>
        <span aria-hidden="true">↑</span> Subir<span className="sr-only">: {label}</span>
      </button>
      <button type="button" data-move="descer" disabled={last || busy} onClick={() => onMove(1)} className={`${quietButton} min-h-10 px-2.5`}>
        <span aria-hidden="true">↓</span> Descer<span className="sr-only">: {label}</span>
      </button>
    </span>
  )
}

/** Barra de salvar: "Salvar alterações", o aviso do que falta salvar e o resultado. */
export function SaveBar({
  dirty,
  save,
  onSave,
  onCancel,
  saveLabel = 'Salvar alterações',
  inDialog = true,
  busy = false,
}: {
  dirty: boolean
  save: SaveState
  onSave: () => void
  onCancel?: () => void
  saveLabel?: string
  /** Na janela, a barra vai de ponta a ponta; na página, é um cartão (sem rolagem lateral no celular). */
  inDialog?: boolean
  /** Uma foto ainda subindo: espera para salvar. */
  busy?: boolean
}) {
  return (
    <div
      data-save-bar
      className={`sticky bottom-0 z-10 mt-4 flex flex-col gap-2 bg-white/95 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between ${inDialog ? '-mx-5 border-t border-line px-5' : 'rounded-2xl px-4 shadow-lift ring-1 ring-line'}`}
    >
      <p aria-live="polite" className="min-h-5 text-sm font-semibold">
        {save.state === 'saved' && !dirty && (
          <span data-save-ok className="text-emerald-800">
            {SAVED_TEXT}
          </span>
        )}
        {save.state === 'error' && (
          <span data-save-error role="alert" className="text-red-700">
            {save.message}
          </span>
        )}
        {save.state !== 'error' && dirty && (
          <span data-dirty className="text-acai-800">
            {DIRTY_TEXT}
          </span>
        )}
      </p>
      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className={quietButton}>
            Cancelar
          </button>
        )}
        <button type="button" data-save disabled={save.state === 'saving' || busy} onClick={onSave} className={`${primaryButton} min-w-44`}>
          {save.state === 'saving' ? 'Salvando…' : busy ? 'Aguarde a foto…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Foto: "Adicionar foto" / "Trocar foto" / "Remover foto", com prévia e o andamento (preparando e
 * enviando). A foto é reduzida no aparelho (até 800 px, WebP) antes de subir; SVG e outros tipos
 * não são aceitos. `onChange` recebe o endereço novo ('' ao remover).
 */
export function PhotoPicker({
  value,
  onChange,
  alt,
  preview,
  onBusy,
}: {
  value: string
  onChange: (url: string) => void
  alt: string
  preview?: string
  /** Avisa quando a foto começa e termina de subir (o editor espera para salvar). */
  onBusy?: (busy: boolean) => void
}) {
  const seller = useSellerMode()
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{ step: 'idle' } | { step: 'working'; text: string } | { step: 'error'; text: string }>({ step: 'idle' })
  const [local, setLocal] = useState<string | null>(null)
  useEffect(() => () => void (local && URL.revokeObjectURL(local)), [local])
  const shown = local ?? preview ?? (value && !value.startsWith('idb:') ? value : null)

  const pick = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setState({ step: 'error', text: 'Use uma foto JPEG, PNG ou WebP.' })
      return
    }
    onBusy?.(true)
    try {
      setState({ step: 'working', text: 'Preparando a foto…' })
      const blob = await compressPhoto(file)
      setLocal(URL.createObjectURL(blob))
      setState({ step: 'working', text: 'Enviando a foto…' })
      const url = await seller.uploadPhoto(blob)
      onChange(url)
      setState({ step: 'idle' })
    } catch {
      setLocal(null)
      setState({ step: 'error', text: 'Não foi possível enviar a foto. Tente de novo.' })
    } finally {
      onBusy?.(false)
    }
  }

  return (
    <div className="flex flex-col gap-2" data-photo-picker>
      <div className="relative grid aspect-[4/3] w-full max-w-xs place-items-center overflow-hidden rounded-2xl bg-acai-50 ring-1 ring-line">
        {shown ? (
          <img src={shown} alt={alt} className="absolute inset-0 size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-acai-700">
            <Camera className="size-9" />
            <span className="text-sm font-semibold">Sem foto</span>
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        aria-label="Escolher foto"
        data-photo-input
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void pick(file)
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" data-photo-pick disabled={state.step === 'working'} onClick={() => input.current?.click()} className={quietButton}>
          <Camera className="size-4" />
          {value || local ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        {(value || local) && (
          <button
            type="button"
            data-photo-remove
            disabled={state.step === 'working'}
            onClick={() => {
              setLocal(null)
              onChange('')
            }}
            className={dangerButton}
          >
            Remover foto
          </button>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm font-semibold">
        {state.step === 'working' && <span className="text-acai-800">{state.text}</span>}
        {state.step === 'error' && (
          <span role="alert" className="text-red-700">
            {state.text}
          </span>
        )}
      </p>
    </div>
  )
}

/** Selo pequeno de situação ("Oculto", "Esgotado", "Agendada"...). */
export function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'off' | 'info'; children: ReactNode }) {
  const tones = {
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    warn: 'bg-gold-100 text-acai-950 ring-gold-400',
    off: 'bg-red-50 text-red-800 ring-red-200',
    info: 'bg-acai-50 text-acai-800 ring-line',
  } as const
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${tones[tone]}`}>{children}</span>
}
