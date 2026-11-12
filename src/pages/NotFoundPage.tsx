import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'

export function NotFoundPage() {
  usePageTitle('Página não encontrada', { noindex: true })

  return (
    <Container className="py-10 sm:py-16">
      <h1 className="font-display text-4xl font-black tracking-tight text-acai-800 uppercase sm:text-5xl">
        Página não encontrada
      </h1>
      <p className="mt-3 max-w-prose text-lg text-ink-soft">
        O endereço aberto não existe neste site.
      </p>

      <ButtonLink to={paths.home} className="mt-8">
        Ir para o início
      </ButtonLink>
    </Container>
  )
}
