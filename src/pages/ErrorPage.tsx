import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
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
    <main>
      <Container className="py-12 sm:py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-plum-900 sm:text-5xl">
          Não foi possível abrir esta página
        </h1>
        <p className="mt-3 max-w-prose text-lg text-plum-950/75">
          Aconteceu um erro inesperado. Volte ao início para tentar de novo.
        </p>

        {/* Link comum, de propósito: recarrega o site inteiro e limpa o estado com erro. */}
        <a
          href={paths.home}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-berry-600 px-6 font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-berry-700 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600"
        >
          Voltar ao início
        </a>
      </Container>
    </main>
  )
}
