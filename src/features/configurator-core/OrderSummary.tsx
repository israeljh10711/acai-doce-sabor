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
      className="scroll-mt-52 rounded-2xl border border-cream-200 bg-white p-5 sm:p-6 lg:scroll-mt-6"
    >
      <h2 id="resumo-titulo" className="font-display text-2xl font-semibold tracking-tight text-plum-900">
        Seu pedido
      </h2>

      {cfg.size && cfg.price ? (
        <div className="mt-4 flex flex-col gap-3 text-plum-950">
          <Line label={`${product.name} · ${cfg.size.name}`} value={formatBRL(cfg.price.sizeCents)} />
          {flavor && <p className="text-sm text-plum-950/75">Sabor: {flavor.name}</p>}

          {freeGroups.map((group) => {
            const items = selectedByGroup(product, cfg.selection, group)
            if (items.length === 0) return null
            return (
              <p key={group} className="text-sm text-plum-950/75">
                <span className="font-semibold text-plum-900">{TOPPING_GROUPS[group].name}:</span>{' '}
                {items
                  .map(({ topping, quantity }) => (quantity > 1 ? `${quantity}x ${topping.name}` : topping.name))
                  .join(', ')}
                <span className="text-plum-950/60"> · sem custo</span>
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

          <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-cream-200 pt-3">
            <span className="font-semibold text-plum-900">Total</span>
            <span className="font-display text-2xl font-semibold text-plum-900 tabular-nums">
              <AnimatedValue value={formatBRL(cfg.price.totalCents)} />
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-plum-950/75">Escolha o tamanho para ver o preço.</p>
      )}

      {cfg.missing.length > 0 && cfg.size && (
        <p className="mt-4 text-sm font-semibold text-berry-700">
          Falta escolher {cfg.missing.map((choice) => MISSING_TEXT[choice]).join(' e ')}.
        </p>
      )}

      <p className="mt-5 rounded-xl bg-cream-100 px-4 py-3 text-sm text-plum-950/80">
        O carrinho e o envio do pedido chegam na próxima etapa do site.
      </p>
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 font-medium text-plum-900">{label}</span>
      <span className="shrink-0 font-semibold whitespace-nowrap text-plum-900 tabular-nums">{value}</span>
    </div>
  )
}
