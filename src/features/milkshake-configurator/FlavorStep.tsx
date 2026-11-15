import { Check, Info } from '../../components/ui/icons.tsx'
import { type Product, getTopping } from '../catalog/menu.ts'
import { StepHeading } from '../configurator-core/StepHeading.tsx'
import type { ConfiguratorApi } from '../configurator-core/useConfigurator.ts'
import { ingredientPhoto } from '../catalog/photos.ts'

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

      <div className={`mt-4 grid gap-2.5 ${longNames ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-2'}`}>
        {product.flavors.map((flavor) => (
          <label
            key={flavor.id}
            className="group relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-white px-3 py-2 transition duration-200 hover:border-acai-600/40 active:scale-[0.98] has-checked:border-gold-400 has-checked:bg-gold-100 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800"
          >
            <input
              type="radio"
              name={`${product.slug}-sabor`}
              value={flavor.id}
              checked={cfg.selection.flavorId === flavor.id}
              onChange={() => cfg.chooseFlavor(flavor.id)}
              className="sr-only"
            />
            <Swatch slug={product.slug} flavorId={flavor.id} />
            <span className="font-semibold text-acai-950">{flavor.name}</span>
            <span
              aria-hidden="true"
              className="ml-auto hidden size-5 shrink-0 place-items-center rounded-full bg-acai-800 text-gold-400 group-has-checked:grid"
            >
              <Check className="size-3.5" />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Swatch({ slug, flavorId }: { slug: Product['slug']; flavorId: string }) {
  // Batido: o que cada sabor leva por cima. Barca: a própria cobertura (as opções são as caldas).
  const extras =
    slug === 'acai-batido' ? (BATIDO_FLAVOR_TOPPINGS[flavorId] ?? []) : slug === 'barca-de-acai' ? [flavorId] : []
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
