import { Link, useParams } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { type Category, findCategoryBySlug } from '../features/catalog/categories.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { NotFoundPage } from './NotFoundPage.tsx'

/**
 * Página do personalizador de uma categoria.
 * Nesta etapa ela só confirma a categoria e avisa que o personalizador
 * ainda não existe. Tamanhos, ingredientes e 3D entram nas Fases 3 e 4.
 */
export function ConfiguratorPage() {
  const { categoria } = useParams()
  const category = findCategoryBySlug(categoria)

  if (!category) {
    return <NotFoundPage />
  }

  return <ConfiguratorPlaceholder category={category} />
}

function ConfiguratorPlaceholder({ category }: { category: Category }) {
  usePageTitle(category.name)

  return (
    <Container className="py-10 sm:py-16">
      <Link
        to={paths.buildOrder}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-berry-600 hover:text-berry-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600"
      >
        <span aria-hidden="true">←</span>
        <span className="link-draw">Monte seu Pedido</span>
      </Link>

      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-plum-900 sm:text-5xl">
        {category.name}
      </h1>
      <p className="mt-3 max-w-prose text-lg text-plum-950/75">{category.summary}</p>

      <p
        role="note"
        className="mt-8 max-w-prose rounded-xl border border-cream-200 bg-white px-4 py-3 text-plum-950/80"
      >
        O personalizador desta categoria ainda está em construção. A escolha de tamanhos e
        ingredientes e a visualização em 3D chegam nas próximas etapas.
      </p>
    </Container>
  )
}
