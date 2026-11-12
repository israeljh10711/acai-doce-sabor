import { Suspense, lazy, useMemo } from 'react'
import { ProductIllustration } from '../catalog/illustration/ProductIllustration.tsx'
import type { CategorySlug } from '../catalog/categories.ts'
import { layoutScene } from './layout.ts'
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
 * Prévia do produto: a ilustração 2D aparece na hora e dá lugar ao 3D quando ele fica pronto.
 * Sem WebGL, ou se o 3D falhar, a ilustração 2D continua.
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
  const illustration = (
    <ProductIllustration
      slug={slug}
      sizeId={sizeId}
      flavorId={flavorId}
      toppings={toppings}
      title={title}
      decorative
      className="absolute inset-0 size-full"
    />
  )

  return (
    <div role="img" aria-label={title} data-preview={mode} className={`relative ${className}`}>
      {mode !== '3d' && illustration}
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
