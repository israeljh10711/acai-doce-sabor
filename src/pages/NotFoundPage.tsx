import { Link } from 'react-router'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'

export function NotFoundPage() {
  usePageTitle('Página não encontrada')

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
        Página não encontrada
      </h1>
      <p className="mt-3 max-w-prose text-lg text-brand-950/80">
        O endereço aberto não existe neste site.
      </p>

      <Link
        to={paths.home}
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent-700 underline underline-offset-4 hover:text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Ir para o início
      </Link>
    </>
  )
}
