import { useEffect, useRef, useState } from 'react'
import { Close, Search } from '../../components/ui/icons.tsx'

/** "1 resultado encontrado para “refri”", "6 resultados encontrados para “casquinha”". */
const foundText = (total: number, query: string) =>
  `${total === 1 ? '1 resultado encontrado' : `${total} resultados encontrados`} para “${query.trim()}”`

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  /** Há uma busca de verdade (não só espaços ou símbolos). */
  searching: boolean
  total: number
  className?: string
}

/**
 * Busca do cardápio (pedido de 2026-11-15; no topo do cardápio desde 2026-11-16, ao lado do botão
 * "Categorias" no celular). Filtra enquanto o cliente digita. O resultado é anunciado para leitores
 * de tela meio segundo depois da última tecla, para não interromper a digitação.
 */
export function SearchBar({ value, onChange, searching, total, className = '' }: SearchBarProps) {
  const input = useRef<HTMLInputElement>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const text = !searching ? '' : total === 0 ? 'Nenhum produto encontrado.' : `${foundText(total, value)}.`
    const timer = window.setTimeout(() => setAnnouncement(text), 500)
    return () => window.clearTimeout(timer)
  }, [searching, total, value])

  return (
    <div className={className}>
      <form
        role="search"
        aria-label="Cardápio"
        onSubmit={(event) => {
          event.preventDefault()
          input.current?.blur()
        }}
        className="relative"
      >
        <label htmlFor="busca-cardapio" className="sr-only">
          Buscar no cardápio
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-acai-700" />
        <input
          ref={input}
          id="busca-cardapio"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Buscar açaí, barca, picolé, combo, refri, trufa..."
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-h-12 w-full rounded-full bg-acai-50 pr-12 pl-12 text-base text-acai-950 ring-1 ring-line transition outline-none placeholder:text-ink-soft focus:bg-white focus:ring-2 focus:ring-acai-700 lg:min-h-13 lg:bg-white [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              onChange('')
              input.current?.focus()
            }}
            className="absolute top-1/2 right-0.5 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-acai-800 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-acai-800"
          >
            <Close className="size-5" />
          </button>
        )}
      </form>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

/**
 * Faixa com o resultado da busca, no topo do cardápio (pedido de 2026-11-16): "N resultados
 * encontrados para “…”" e "Limpar busca", que volta ao cardápio inteiro.
 */
export function SearchSummary({ query, total, onClear }: { query: string; total: number; onClear: () => void }) {
  return (
    <div
      data-search-summary=""
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-white px-4 py-2.5 shadow-card ring-1 ring-line"
    >
      {/* O texto é anunciado pela busca (role="status"); aqui ele só aparece. */}
      <p aria-hidden="true" className="nums font-semibold text-acai-950">
        {foundText(total, query)}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-extrabold text-acai-800 ring-1 ring-acai-800/25 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
      >
        <Close className="size-4" />
        Limpar busca
      </button>
    </div>
  )
}
