import { Check, Info } from '../../components/ui/icons.tsx'
import { FLAVOR_COLORS } from '../catalog/illustration/looks.ts'
import type { Product } from '../catalog/menu.ts'
import { FLAVOR_AVAILABILITY_NOTICE } from '../catalog/notices.ts'
import { StepHeading } from '../configurator-core/StepHeading.tsx'
import type { ConfiguratorApi } from '../configurator-core/useConfigurator.ts'

/** Escolha do sabor do milk-shake, com o aviso de disponibilidade pedido pelo proprietário. */
export function FlavorStep({ product, cfg, number }: { product: Product; cfg: ConfiguratorApi; number: number }) {
  const headingId = `${product.slug}-sabor`
  const noticeId = `${headingId}-aviso`

  return (
    <fieldset aria-labelledby={headingId} aria-describedby={noticeId} className="min-w-0">
      <StepHeading number={number} id={headingId} title="Sabor" />

      <p
        id={noticeId}
        className="mt-4 flex gap-2.5 rounded-2xl bg-gold-100 px-4 py-3 text-sm font-medium text-acai-950 ring-1 ring-gold-400"
      >
        <Info className="mt-0.5 size-4 text-acai-700" />
        {FLAVOR_AVAILABILITY_NOTICE}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
        {product.flavors.map((flavor) => (
          <label
            key={flavor.id}
            className="group relative flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-line bg-white px-3 py-2 transition duration-200 hover:border-acai-600/40 active:scale-[0.98] has-checked:border-gold-400 has-checked:bg-gold-100 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800"
          >
            <input
              type="radio"
              name={`${product.slug}-sabor`}
              value={flavor.id}
              checked={cfg.selection.flavorId === flavor.id}
              onChange={() => cfg.chooseFlavor(flavor.id)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="size-6 shrink-0 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgb(42_8_29/0.18)]"
              style={{ backgroundColor: FLAVOR_COLORS[flavor.id]?.body }}
            />
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
