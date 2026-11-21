import { type ReactNode, useState } from 'react'
import { Container } from '../../components/layout/Container.tsx'
import { refreshCatalogNow } from '../seller/sellerBackend.ts'
import { setCatalogStatus, useCatalogStatus } from './catalogStore.ts'

/**
 * Páginas que mostram o cardápio (início, cardápio, personalizador e carrinho) só aparecem com o
 * cardápio do banco carregado (cardápio dinâmico, 2026-11-21). Enquanto carrega, um espaço
 * reservado; se não carregar, o aviso com "Tentar de novo" — nunca o cardápio do código no lugar,
 * que poderia ter preços antigos.
 */
export function CatalogGate({ children }: { children: ReactNode }) {
  const status = useCatalogStatus()
  const [retrying, setRetrying] = useState(false)

  if (status.state === 'ready') return children

  if (status.state === 'loading') {
    return (
      <Container className="py-16">
        <div role="status" aria-live="polite" data-catalog-loading className="min-h-[60svh]">
          <p className="text-center text-base font-semibold text-ink-soft motion-safe:animate-pulse">Carregando o cardápio…</p>
        </div>
      </Container>
    )
  }

  const retry = async () => {
    setRetrying(true)
    setCatalogStatus({ state: 'loading' })
    try {
      await refreshCatalogNow()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Container className="py-16">
      <div role="alert" data-catalog-error className="mx-auto max-w-md rounded-3xl border border-acai-100 bg-white p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold text-acai-900">Cardápio indisponível agora</h1>
        <p className="mt-2 text-base text-ink-soft">{status.message}</p>
        <button
          type="button"
          data-catalog-retry
          disabled={retrying}
          onClick={() => void retry()}
          className="mt-5 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-acai-800 px-5 text-base font-bold text-white transition hover:bg-acai-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
        >
          Tentar de novo
        </button>
      </div>
    </Container>
  )
}
