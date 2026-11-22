import { Check, Info } from '../../components/ui/icons.tsx'
import { type Product, getTopping } from '../catalog/menu.ts'
import { StepHeading } from '../configurator-core/StepHeading.tsx'
import type { ConfiguratorApi } from '../configurator-core/useConfigurator.ts'
import { ingredientPhoto } from '../catalog/photos.ts'
import { toppingLightbox } from '../lightbox/lightboxImages.ts'
import { ZoomButton } from '../lightbox/ZoomButton.tsx'
import { SellerFlavorToggle } from '../seller/SellerAccess.tsx'

/** Cor de cada sabor de milk-shake, na amostra ao lado do nome. */
const SHAKE_COLORS: Readonly<Record<string, string>> = {
  acai: '#7a2a5c',
  toffe: '#c08a50',
  ninho: '#f2e7cf',
  pitaya: '#de4a88',
  maracuja: '#f3c63e',
  morango: '#f4a3b8',
  prestigio: '#8a5c40',
  chocolate: '#6a3c24',
  choconute: '#7f5634',
  'laka-bis': '#eedfc3',
  'iogurte-grego': '#f7f2e9',
  'ninho-trufado': '#dcc39c',
  'chocolate-branco': '#f4e6cb',
}

/** O que cada sabor do batido leva, em fotos: todos levam leite condensado. */
const BATIDO_FLAVOR_TOPPINGS: Readonly<Record<string, readonly string[]>> = {
  'leite-condensado': ['leite-condensado'],
  'leite-condensado-amendoim': ['leite-condensado', 'amendoim'],
  'leite-condensado-pacoca': ['leite-condensado', 'pacoca'],
}

/**
 * Escolha obrigatória: o sabor (milk-shake e açaí batido) ou a cobertura inclusa (barca). O aviso
 * de disponibilidade aparece quando o proprietário pediu (no milk-shake). Cada opção tem a sua
 * amostra: a cor do milk-shake, as fotos do que o batido leva por cima ou a foto da cobertura.
 */
export function FlavorStep({
  product,
  cfg,
  number,
  title = 'Sabor',
}: {
  product: Product
  cfg: ConfiguratorApi
  number: number
  title?: string
}) {
  const headingId = `${product.slug}-sabor`
  const noticeId = `${headingId}-aviso`
  const longNames = product.flavors.some((flavor) => flavor.name.length > 22)
  // Com a foto ao lado do nome, duas por linha só a partir de 360 px: no celular de 320 px, a foto
  // empurrava o nome para fora do cartão (2026-11-22: "Banana caramelada" na Barca).
  const withPhotos = product.flavors.some((flavor) => swatchToppings(product.slug, flavor.id).length > 0)
  const columns = longNames ? 'grid-cols-1' : `${withPhotos ? 'grid-cols-1 min-[360px]:grid-cols-2' : 'grid-cols-2'} sm:grid-cols-3 lg:grid-cols-2`

  return (
    <fieldset
      aria-labelledby={headingId}
      aria-describedby={product.flavorNotice ? noticeId : undefined}
      className="min-w-0"
    >
      <StepHeading number={number} id={headingId} title={title} hint={product.flavorHint} />

      {product.flavorNotice && (
        <p
          id={noticeId}
          className="mt-4 flex gap-2.5 rounded-2xl bg-gold-100 px-4 py-3 text-sm font-medium text-acai-950 ring-1 ring-gold-400"
        >
          <Info className="mt-0.5 size-4 text-acai-700" />
          {product.flavorNotice}
        </p>
      )}

      <div className={`mt-4 grid gap-2.5 ${columns}`}>
        {product.flavors.map((flavor) => {
          // Esgotado pelo vendedor (2026-11-17): desligado, com o aviso no lugar do selo de marcado.
          const soldOut = flavor.available === false
          return (
          // A barca mostra a foto da cobertura: a lupa fica por cima da foto, fora do rótulo (um
          // botão não pode ficar dentro do rótulo da opção). A pílula do vendedor fica embaixo.
          <div key={flavor.id} className="flex flex-col" data-flavor={flavor.id}>
            <div className="relative flex flex-1">
            <label
              className={`group relative flex min-h-12 flex-1 items-center gap-3 rounded-2xl border-2 border-line bg-white px-3 py-2 transition duration-200 has-checked:border-gold-400 has-checked:bg-gold-100 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800 ${
                soldOut ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-acai-600/40 active:scale-[0.98]'
              }`}
            >
              <input
                type="radio"
                name={`${product.slug}-sabor`}
                value={flavor.id}
                checked={cfg.selection.flavorId === flavor.id}
                disabled={soldOut}
                onChange={() => cfg.chooseFlavor(flavor.id)}
                className="sr-only"
              />
              <Swatch slug={product.slug} flavorId={flavor.id} />
              <span className="font-semibold text-acai-950">{flavor.name}</span>
              {soldOut ? (
                <span className="ml-auto shrink-0 rounded-md bg-red-600 px-1.5 py-0.5 text-[0.65rem] font-extrabold tracking-wide text-white uppercase">
                  Esgotado
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="ml-auto hidden size-5 shrink-0 place-items-center rounded-full bg-acai-800 text-gold-400 group-has-checked:grid"
                >
                  <Check className="size-3.5" />
                </span>
              )}
            </label>
            {product.slug === 'barca-de-acai' && getTopping(flavor.id) && (
              <ZoomButton
                image={toppingLightbox(getTopping(flavor.id)!, { price: 'Inclusa' })}
                className="absolute top-1/2 left-3 size-11 -translate-y-1/2 rounded-full"
                badge="sm"
              />
            )}
            </div>
            <SellerFlavorToggle product={product} flavor={flavor} className="mt-1.5 self-start" />
          </div>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Batido: o que cada sabor leva por cima. Barca: a própria cobertura (as opções são as caldas). */
function swatchToppings(slug: Product['slug'], flavorId: string): readonly string[] {
  return slug === 'acai-batido' ? (BATIDO_FLAVOR_TOPPINGS[flavorId] ?? []) : slug === 'barca-de-acai' ? [flavorId] : []
}

function Swatch({ slug, flavorId }: { slug: Product['slug']; flavorId: string }) {
  const extras = swatchToppings(slug, flavorId)
  if (extras.length > 0) {
    return (
      <span aria-hidden="true" className="flex shrink-0 -space-x-3">
        {extras.map((id) => {
          const photo = ingredientPhoto(getTopping(id) ?? { id })
          if (!photo) return null
          return (
            <img
              key={id}
              src={photo.src}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className={`size-10 rounded-full bg-white ring-2 ring-white shadow-[0_0_0_1px_rgb(42_8_29/0.18)] ${
                photo.fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'
              }`}
            />
          )
        })}
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className="size-7 shrink-0 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgb(42_8_29/0.18)]"
      style={{ backgroundColor: SHAKE_COLORS[flavorId] }}
    />
  )
}
