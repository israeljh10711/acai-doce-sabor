import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'

/**
 * Tela exibida quando uma página falha ao carregar ou ao renderizar.
 * O detalhe técnico vai para o console; a pessoa vê só o que pode fazer.
 */
export function ErrorPage() {
  const error = useRouteError()
  usePageTitle('Não foi possível abrir a página')

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
        Não foi possível abrir esta página
      </h1>
      <p className="mt-3 max-w-prose text-lg text-brand-950/80">
        Aconteceu um erro inesperado. Volte ao início para tentar de novo.
      </p>

      {/* Link comum, de propósito: recarrega o site inteiro e limpa o estado com erro. */}
      <a
        href={paths.home}
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent-700 underline underline-offset-4 hover:text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Voltar ao início
      </a>
    </main>
  )
}
