import { Suspense, lazy, useMemo } from 'react'
import type { CategorySlug } from '../catalog/categories.ts'
import { IngredientPreview } from './IngredientPreview.tsx'
import { layoutScene } from './layout.ts'
import { PreviewSkeleton } from './PreviewSkeleton.tsx'
import { SceneErrorBoundary } from './SceneErrorBoundary.tsx'
import type { PreviewMode } from './usePreview3D.ts'

// three.js e os modelos só baixam quando a prévia aparece.
const ProductScene = lazy(() => import('./ProductScene.tsx'))

type ProductPreviewProps = {
  slug: CategorySlug
  sizeId: string | null
  flavorId: string | null
  toppings: Readonly<Record<string, number>>
  /** Descrição do que está montado, para leitores de tela. */
  title: string
  mode: PreviewMode
  onReady: () => void
  onError: () => void
  /** Permite girar arrastando. */
  interactive: boolean
  paused?: boolean
  className?: string
}

/**
 * Prévia do produto: enquanto o 3D carrega, uma área neutra com brilho (nunca um desenho do
 * produto); depois, o 3D. Sem WebGL, ou se o 3D falhar, as miniaturas realistas dos ingredientes
 * escolhidos.
 */
export function ProductPreview({
  slug,
  sizeId,
  flavorId,
  toppings,
  title,
  mode,
  onReady,
  onError,
  interactive,
  paused,
  className = '',
}: ProductPreviewProps) {
  const layout = useMemo(
    () => layoutScene({ slug, sizeId, flavorId, toppings }),
    [slug, sizeId, flavorId, toppings],
  )
  return (
    <div role="img" aria-label={title} data-preview={mode} className={`relative ${className}`}>
      {mode === 'loading' && <PreviewSkeleton />}
      {mode === 'unavailable' && (
        <IngredientPreview slug={slug} sizeId={sizeId} flavorId={flavorId} toppings={toppings} />
      )}
      {mode !== 'unavailable' && (
        <SceneErrorBoundary fallback={null} onError={onError}>
          <Suspense fallback={null}>
            <ProductScene
              slug={slug}
              layout={layout}
              interactive={interactive}
              paused={paused}
              onReady={onReady}
              aria-hidden
              className={`absolute! inset-0 transition-opacity duration-500 ${mode === '3d' ? 'opacity-100' : 'opacity-0'}`}
            />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </div>
  )
}
