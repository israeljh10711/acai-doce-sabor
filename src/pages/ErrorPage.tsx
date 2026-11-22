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
  usePageTitle('Não foi possível abrir a página', { noindex: true })

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main>
      <Container className="py-12 sm:py-16">
        <h1 className="font-display text-4xl font-black tracking-tight text-acai-800 uppercase sm:text-5xl">
          Não foi possível abrir esta página
        </h1>
        <p className="mt-3 max-w-prose text-lg text-ink-soft">
          Aconteceu um erro inesperado. Volte ao início para tentar de novo.
        </p>

        {/* Link comum, de propósito: recarrega o site inteiro e limpa o estado com erro. */}
        <a
          href={paths.home}
          className="btn-primary mt-8 inline-flex min-h-12 items-center justify-center rounded-full px-6 font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800"
        >
          Voltar ao início
        </a>
      </Container>
    </main>
  )
}
