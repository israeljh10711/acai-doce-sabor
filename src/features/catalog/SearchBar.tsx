import { useEffect, useRef, useState } from 'react'
import { Container } from '../../components/layout/Container.tsx'
import { Close, Search } from '../../components/ui/icons.tsx'

/** "1 produto encontrado", "12 produtos encontrados". */
const foundText = (total: number) =>
  total === 1 ? '1 produto encontrado' : `${total} produtos encontrados`

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  /** Há uma busca de verdade (não só espaços ou símbolos). */
  searching: boolean
  total: number
}

/**
 * Busca do cardápio (pedido de 2026-11-15), logo abaixo do cabeçalho e acima da barra fixa de
 * atalhos. Filtra enquanto o cliente digita. A contagem aparece na hora e é anunciada para
 * leitores de tela meio segundo depois da última tecla, para não interromper a digitação.
 */
export function SearchBar({ value, onChange, searching, total }: SearchBarProps) {
  const input = useRef<HTMLInputElement>(null)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const text = !searching ? '' : total === 0 ? 'Nenhum produto encontrado.' : `${foundText(total)}.`
    const timer = window.setTimeout(() => setAnnouncement(text), 500)
    return () => window.clearTimeout(timer)
  }, [searching, total])

  return (
    <div className="bg-white">
      <Container className="py-3 sm:py-4">
        <form
          role="search"
          aria-label="Cardápio"
          onSubmit={(event) => {
            event.preventDefault()
            input.current?.blur()
          }}
          className="relative mx-auto max-w-2xl"
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
            className="min-h-13 w-full rounded-full bg-acai-50 pr-14 pl-12 text-base text-acai-950 ring-1 ring-line transition outline-none placeholder:text-ink-soft focus:bg-white focus:ring-2 focus:ring-acai-700 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {value && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => {
                onChange('')
                input.current?.focus()
              }}
              className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-acai-800 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-acai-800"
            >
              <Close className="size-5" />
            </button>
          )}
        </form>
        {searching && total > 0 && (
          <p aria-hidden="true" className="nums mt-2 text-center text-sm font-semibold text-acai-800">
            {foundText(total)}
          </p>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </Container>
    </div>
  )
}
