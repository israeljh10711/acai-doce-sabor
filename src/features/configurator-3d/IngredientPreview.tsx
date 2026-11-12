import type { CategorySlug } from '../catalog/categories.ts'
import { composeIllustration } from '../catalog/illustration/compose.ts'
import { FLAVOR_COLORS } from '../catalog/illustration/looks.ts'
import { toppingImage } from '../catalog/toppingImages.ts'

type IngredientPreviewProps = {
  slug: CategorySlug
  sizeId: string | null
  flavorId: string | null
  toppings: Readonly<Record<string, number>>
}

/** Quantas miniaturas cabem; o resto vira "+N". */
const MAX_SHOWN = 9

/**
 * Aparelho sem WebGL: no lugar do 3D, as miniaturas renderizadas no Blender dos ingredientes
 * escolhidos (as mesmas dos cartões), sobre o fundo do estúdio. A lista vem da mesma função da
 * cena 3D, então só aparece o que foi escolhido. Decorativa: a descrição fica no elemento de fora.
 */
export function IngredientPreview({ slug, sizeId, flavorId, toppings }: IngredientPreviewProps) {
  const { empty, layers } = composeIllustration({ slug, sizeId, flavorId, toppings })
  const shown = layers.slice(0, MAX_SHOWN)
  const flavorColor = flavorId && Object.hasOwn(FLAVOR_COLORS, flavorId) ? FLAVOR_COLORS[flavorId].body : null

  return (
    <div aria-hidden="true" className="@container absolute inset-0 grid place-content-center bg-acai-50 p-2">
      {!empty && (
        <ul className="flex max-w-full flex-wrap justify-center gap-1 @[14rem]:gap-2">
          {flavorColor && (
            <li
              data-flavor={flavorId}
              className="size-8 rounded-full ring-2 ring-white shadow-sm @[14rem]:size-16 @[22rem]:size-20"
              style={{ backgroundColor: flavorColor }}
            />
          )}
          {shown.map((layer) => {
            const src = toppingImage(layer.toppingId)
            return (
              <li
                key={layer.toppingId}
                data-topping={layer.toppingId}
                className="grid size-8 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-line @[14rem]:size-16 @[22rem]:size-20"
              >
                {src && <img src={src} alt="" width={80} height={80} decoding="async" className="size-[115%] max-w-none" />}
              </li>
            )
          })}
          {layers.length > MAX_SHOWN && (
            <li className="grid size-8 place-items-center rounded-full bg-acai-800 text-xs font-bold text-gold-400 @[14rem]:size-16 @[14rem]:text-base">
              +{layers.length - MAX_SHOWN}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
