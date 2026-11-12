import { type Product, TOPPING_GROUPS, type Topping, type ToppingGroupId, toppingsOf } from '../catalog/menu.ts'
import { quantityOf } from '../catalog/selection.ts'
import { formatBRL } from '../../utils/money.ts'
import { blockerText, toppingLabel } from './messages.ts'
import { QuantityStepper } from './QuantityStepper.tsx'
import { StepHeading } from './StepHeading.tsx'
import type { ConfiguratorApi } from './useConfigurator.ts'

type ToppingStepProps = {
  product: Product
  group: ToppingGroupId
  number: number
  cfg: ConfiguratorApi
}

/** Um grupo de ingredientes: adicionais, frutas, coberturas ou adicionais pagos. */
export function ToppingStep({ product, group, number, cfg }: ToppingStepProps) {
  const { rule, name } = TOPPING_GROUPS[group]
  const toppings = toppingsOf(product, group)
  const optional = !product.groups.includes('dry')
  const headingId = `${product.slug}-${group}`
  const hintId = `${headingId}-dica`

  const limitReached = rule === 'limited' && cfg.size !== undefined && cfg.freeUsed >= cfg.freeLimit
  let hint: string
  if (!cfg.size) hint = 'Escolha o tamanho primeiro'
  else if (rule === 'limited')
    hint = limitReached
      ? `${cfg.freeUsed} de ${cfg.freeLimit} grátis · limite atingido`
      : `${cfg.freeUsed} de ${cfg.freeLimit} grátis`
  else if (rule === 'included') hint = optional ? 'Opcional, sem custo' : 'À vontade, sem custo'
  else hint = optional ? 'Opcional, cobrado por unidade' : 'Cobrado por unidade'

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <StepHeading
        number={number}
        id={headingId}
        title={name}
        hint={hint}
        hintId={hintId}
        hintTone={limitReached ? 'alert' : 'neutral'}
      />

      {rule === 'included' ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {toppings.map((topping) => (
            <li key={topping.id}>
              <ToggleChip topping={topping} cfg={cfg} hintId={hintId} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mt-4 divide-y divide-cream-200 overflow-hidden rounded-2xl border border-cream-200 bg-white">
          {toppings.map((topping) => {
            const blocker = cfg.blockerFor(topping.id)
            return (
              <li key={topping.id} className="flex items-center justify-between gap-3 py-1.5 pr-1.5 pl-4">
                <span className="min-w-0">
                  <span className="block font-medium text-plum-900">{topping.name}</span>
                  {rule === 'paid' && (
                    <span className="block text-sm text-plum-950/70 tabular-nums">
                      + {formatBRL(topping.priceCents)} cada
                    </span>
                  )}
                </span>
                <QuantityStepper
                  label={topping.name}
                  quantity={quantityOf(cfg.selection, topping.id)}
                  onAdd={() => cfg.add(topping.id)}
                  onRemove={() => cfg.remove(topping.id)}
                  addBlockedReason={blocker ? blockerText(blocker, cfg.freeLimit) : null}
                  describedBy={hintId}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ToggleChip({ topping, cfg, hintId }: { topping: Topping; cfg: ConfiguratorApi; hintId: string }) {
  const on = quantityOf(cfg.selection, topping.id) > 0
  const blocked = !on && cfg.blockerFor(topping.id) !== null

  return (
    <button
      type="button"
      // "Morango" existe como fruta e como cobertura: o nome acessível diferencia os dois.
      aria-label={toppingLabel(topping)}
      aria-pressed={on}
      disabled={blocked}
      aria-describedby={blocked ? hintId : undefined}
      onClick={() => (on ? cfg.remove(topping.id) : cfg.add(topping.id))}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cream-200 bg-white px-4 font-medium text-plum-900 transition duration-150 hover:border-berry-600/60 active:scale-[0.97] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-cream-100 disabled:text-plum-950/70 disabled:hover:border-cream-200 disabled:active:scale-100 aria-pressed:border-berry-600 aria-pressed:bg-berry-600 aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-berry-600"
    >
      <span
        aria-hidden="true"
        className={`grid size-4 place-items-center rounded-full border text-[10px] leading-none ${on ? 'border-white bg-white text-berry-600' : 'border-plum-700/35'}`}
      >
        {on ? '✓' : ''}
      </span>
      {topping.name}
    </button>
  )
}
