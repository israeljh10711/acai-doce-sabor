import { Info } from '../../components/ui/icons.tsx'
import { type Product, TOPPING_GROUPS } from '../catalog/menu.ts'
import { selectedByGroup } from '../catalog/selection.ts'
import { formatBRL } from '../../utils/money.ts'
import { AnimatedValue } from './AnimatedValue.tsx'
import type { ConfiguratorApi } from './useConfigurator.ts'

const MISSING_TEXT = { size: 'o tamanho', flavor: 'o sabor' } as const

/** Resumo do pedido montado, com o preço de cada parte e o total. */
export function OrderSummary({ product, cfg }: { product: Product; cfg: ConfiguratorApi }) {
  const flavor = product.flavors.find((candidate) => candidate.id === cfg.selection.flavorId)
  const freeGroups = product.groups.filter((group) => TOPPING_GROUPS[group].rule !== 'paid')

  return (
    <section
      id="resumo"
      aria-labelledby="resumo-titulo"
      className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line lg:scroll-mt-6"
    >
      <h2
        id="resumo-titulo"
        className="bg-acai-800 px-5 py-4 font-display text-2xl font-black tracking-tight text-white uppercase sm:px-6"
      >
        Seu pedido
      </h2>

      <div className="p-5 sm:p-6">
        {cfg.size && cfg.price ? (
          <div className="flex flex-col gap-3 text-acai-950">
            <Line label={`${product.name} · ${cfg.size.name}`} value={formatBRL(cfg.price.sizeCents)} />
            {flavor && <p className="text-sm text-ink-soft">Sabor: {flavor.name}</p>}

            {freeGroups.map((group) => {
              const items = selectedByGroup(product, cfg.selection, group)
              if (items.length === 0) return null
              return (
                <p key={group} className="text-sm text-ink-soft">
                  <span className="font-semibold text-acai-800">{TOPPING_GROUPS[group].name}:</span>{' '}
                  {items
                    .map(({ topping, quantity }) => (quantity > 1 ? `${quantity}x ${topping.name}` : topping.name))
                    .join(', ')}
                  <span className="text-ink-soft"> · sem custo</span>
                </p>
              )
            })}

            {cfg.price.paidLines.map((line) => (
              <Line
                key={line.toppingId}
                label={`${line.quantity}x ${line.name}`}
                value={`+ ${formatBRL(line.totalCents)}`}
              />
            ))}

            <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-dashed border-line pt-4">
              <span className="font-display text-lg font-extrabold text-acai-800 uppercase">Total</span>
              <span className="nums text-3xl font-extrabold tracking-tight whitespace-nowrap text-acai-800">
                <AnimatedValue value={formatBRL(cfg.price.totalCents)} />
              </span>
            </div>
          </div>
        ) : (
          <p className="text-ink-soft">Escolha o tamanho para ver o preço.</p>
        )}

        {cfg.missing.length > 0 && cfg.size && (
          <p className="mt-4 rounded-2xl bg-gold-100 px-4 py-3 text-sm font-semibold text-acai-950 ring-1 ring-gold-400">
            Falta escolher {cfg.missing.map((choice) => MISSING_TEXT[choice]).join(' e ')}.
          </p>
        )}

        <p className="mt-5 flex gap-2.5 rounded-2xl bg-acai-50 px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
          <Info className="mt-0.5 size-4 text-acai-700" />
          O carrinho e o envio do pedido chegam na próxima etapa do site.
        </p>
      </div>
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 font-semibold text-acai-950">{label}</span>
      <span className="nums shrink-0 font-bold whitespace-nowrap text-acai-950">{value}</span>
    </div>
  )
}
