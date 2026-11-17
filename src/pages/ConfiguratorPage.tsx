import { useParams, useSearchParams } from 'react-router'
import { useCatalogVersion } from '../features/catalog/catalogStore.ts'
import { findProduct } from '../features/catalog/menu.ts'
import { Configurator } from '../features/configurator-core/Configurator.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

/**
 * Página do personalizador de um produto: as 4 categorias e os produtos das gavetas (Pote 1 L
 * Montado e Barca). Produto desconhecido: página não encontrada.
 */
export function ConfiguratorPage() {
  const { categoria } = useParams()
  const [searchParams] = useSearchParams()
  // Preço ou complemento mudado pelo vendedor com a página aberta: redesenha com o produto novo.
  useCatalogVersion()
  const product = findProduct(categoria)

  if (!product) {
    return <NotFoundPage />
  }

  // A chave recomeça a montagem ao trocar de produto ou de item do carrinho em edição.
  return <Configurator key={`${product.slug}:${searchParams.get('item') ?? ''}`} product={product} />
}
