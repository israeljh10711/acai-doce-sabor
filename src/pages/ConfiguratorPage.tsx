import { useParams } from 'react-router'
import { findCategoryBySlug } from '../features/catalog/categories.ts'
import { PRODUCTS } from '../features/catalog/menu.ts'
import { Configurator } from '../features/configurator-core/Configurator.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

/** Página do personalizador de uma categoria. Categoria desconhecida: página não encontrada. */
export function ConfiguratorPage() {
  const { categoria } = useParams()
  const category = findCategoryBySlug(categoria)

  if (!category) {
    return <NotFoundPage />
  }

  // A chave recomeça a montagem ao trocar de categoria.
  return <Configurator key={category.slug} product={PRODUCTS[category.slug]} />
}
