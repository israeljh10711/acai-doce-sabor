import { Check } from '../../components/ui/icons.tsx'
import type { ContainerKind, Product, ProductSize } from '../catalog/menu.ts'
import { formatBRL } from '../../utils/money.ts'
import { StepHeading } from './StepHeading.tsx'
import type { ConfiguratorApi } from './useConfigurator.ts'

const CONTAINER_NAMES: Record<ContainerKind, string> = {
  pote: 'Pote',
  copo: 'Copo',
  isopor: 'Isopor',
}

/** "Pote 200 ml" vira "200 ml" quando já está dentro do grupo "Pote". */
const shortName = (size: ProductSize) => size.name.replace(/^(Pote|Copo|Isopor)\s+/, '')

/** Escolha do tamanho, em cartões. Agrupa por recipiente quando há mais de um. */
export function SizeStep({ product, cfg, number }: { product: Product; cfg: ConfiguratorApi; number: number }) {
  const kinds = [...new Set(product.sizes.map((size) => size.container))]
  const grouped = kinds.length > 1
  const headingId = `${product.slug}-tamanho`

  return (
    <fieldset aria-labelledby={headingId} className="min-w-0">
      <StepHeading number={number} id={headingId} title="Tamanho" />

      <div className="mt-5 flex flex-col gap-5">
        {kinds.map((kind) => (
          <div key={kind}>
            {grouped && (
              <p className="mb-2 text-xs font-bold tracking-[0.14em] text-ink-soft uppercase">
                {CONTAINER_NAMES[kind]}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {product.sizes
                .filter((size) => size.container === kind)
                .map((size) => (
                  <SizeOption
                    key={size.id}
                    size={size}
                    name={`${product.slug}-tamanho`}
                    label={grouped ? shortName(size) : size.name}
                    hiddenPrefix={grouped ? `${CONTAINER_NAMES[kind]} ` : ''}
                    checked={cfg.selection.sizeId === size.id}
                    onChoose={() => cfg.chooseSize(size.id)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {cfg.sizeNotice && (
        <p className="mt-3 rounded-2xl bg-gold-100 px-4 py-3 text-sm font-medium text-acai-950 ring-1 ring-gold-400">
          {cfg.sizeNotice}
        </p>
      )}
    </fieldset>
  )
}

function SizeOption({
  size,
  name,
  label,
  hiddenPrefix,
  checked,
  onChoose,
}: {
  size: ProductSize
  name: string
  label: string
  hiddenPrefix: string
  checked: boolean
  onChoose: () => void
}) {
  return (
    <label className="group relative flex min-h-[4.5rem] cursor-pointer flex-col justify-center gap-1 rounded-2xl border-2 border-line bg-white px-3.5 py-2.5 transition duration-200 hover:border-acai-600/40 active:scale-[0.98] has-checked:border-gold-400 has-checked:bg-gold-100 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800">
      <input
        type="radio"
        name={name}
        value={size.id}
        checked={checked}
        onChange={onChoose}
        className="sr-only"
      />
      {/* Na largura de três colunas o cartão é estreito: o preço vai sempre para baixo do nome,
          para ficar no mesmo lugar em todos os cartões. */}
      <span className="flex flex-wrap items-baseline justify-between gap-x-2 xl:flex-col xl:items-start">
        <span className="font-display text-lg leading-tight font-extrabold whitespace-nowrap text-acai-800">
          {hiddenPrefix && <span className="sr-only">{hiddenPrefix}</span>}
          {label}
        </span>
        <span className="nums text-sm font-bold whitespace-nowrap text-acai-950">{formatBRL(size.priceCents)}</span>
      </span>
      {size.freeToppings > 0 && (
        <span className="text-xs font-medium text-ink-soft">{size.freeToppings} adicionais grátis</span>
      )}
      <span
        aria-hidden="true"
        className="absolute -top-2 -right-2 hidden size-6 place-items-center rounded-full bg-acai-800 text-gold-400 shadow-sm group-has-checked:grid"
      >
        <Check className="size-4" />
      </span>
    </label>
  )
}
