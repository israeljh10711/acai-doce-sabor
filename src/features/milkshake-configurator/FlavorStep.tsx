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
        className="mt-3 flex gap-2.5 rounded-xl border border-leaf-500/40 bg-leaf-100 px-4 py-3 text-sm font-medium text-plum-900"
      >
        <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-leaf-500" />
        {FLAVOR_AVAILABILITY_NOTICE}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
        {product.flavors.map((flavor) => (
          <label
            key={flavor.id}
            className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-cream-200 bg-white px-3 py-2 transition duration-200 hover:border-berry-600/60 has-checked:border-berry-600 has-checked:bg-berry-100 has-checked:shadow-[inset_0_0_0_1px_var(--color-berry-600)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-berry-600"
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
              className="size-5 shrink-0 rounded-full border border-plum-950/15"
              style={{ backgroundColor: FLAVOR_COLORS[flavor.id]?.body }}
            />
            <span className="font-medium text-plum-900">{flavor.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
