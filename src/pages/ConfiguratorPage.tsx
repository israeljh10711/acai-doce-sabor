import { Link, useParams } from 'react-router'
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
    <>
      <h1 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
        {category.name}
      </h1>
      <p className="mt-3 max-w-prose text-lg text-brand-950/80">
        O personalizador desta categoria ainda está em construção. A escolha de tamanhos e
        ingredientes e a visualização em 3D chegam nas próximas etapas.
      </p>

      <Link
        to={paths.buildOrder}
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent-700 underline underline-offset-4 hover:text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Voltar para Monte seu Pedido
      </Link>
    </>
  )
}
