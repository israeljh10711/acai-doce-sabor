import { m } from 'motion/react'
import { Check } from '../../components/ui/icons.tsx'
import { type Product, TOPPING_GROUPS, type Topping, type ToppingGroupId, toppingsOf } from '../catalog/menu.ts'
import { quantityOf } from '../catalog/selection.ts'
import { toppingImage } from '../catalog/toppingImages.ts'
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

const cardBase =
  'relative flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border-2 bg-white px-2 pt-3 pb-2.5 text-center transition duration-200 hover:border-acai-600/40'

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

      {/* Grade de blocos: miniatura redonda em cima e o nome embaixo, com a largura toda do cartão. */}
      <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-2">
        {toppings.map((topping) => (
          <li key={topping.id}>
            {rule === 'included' ? (
              <ToggleCard topping={topping} cfg={cfg} hintId={hintId} />
            ) : (
              <StepperCard topping={topping} cfg={cfg} paid={rule === 'paid'} hintId={hintId} />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Miniatura do ingrediente (render do Blender). Decorativa: o nome está ao lado. */
function Thumb({ id }: { id: string }) {
  const src = toppingImage(id)
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-acai-50 ring-1 ring-line">
      {src && (
        <img src={src} alt="" width={64} height={64} loading="lazy" decoding="async" className="size-[4.1rem] max-w-none" />
      )}
    </span>
  )
}

function FreeBadge() {
  return (
    <span className="inline-block rounded-full bg-gold-100 px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-acai-950 uppercase ring-1 ring-gold-400">
      Grátis
    </span>
  )
}

/** Fruta ou cobertura: o cartão inteiro marca e desmarca (padrão "Choice Cards" do 21st.dev). */
function ToggleCard({ topping, cfg, hintId }: { topping: Topping; cfg: ConfiguratorApi; hintId: string }) {
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
      className={`${cardBase} cursor-pointer active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 ${
        on ? 'border-gold-400 bg-gold-100' : 'border-line'
      }`}
    >
      <Thumb id={topping.id} />
      <span className="text-[0.95rem] leading-tight font-semibold text-balance hyphens-auto text-acai-950">{topping.name}</span>
      <FreeBadge />
      {/* Selo de marcado no canto, como nos tamanhos: o nome fica com a largura toda. */}
      <m.span
        aria-hidden="true"
        initial={false}
        animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 28 }}
        className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-acai-800 text-gold-400 shadow-sm"
      >
        <Check className="size-4" />
      </m.span>
    </button>
  )
}

/** Adicional grátis (dentro do limite) ou pago: cartão com contador. */
function StepperCard({
  topping,
  cfg,
  paid,
  hintId,
}: {
  topping: Topping
  cfg: ConfiguratorApi
  paid: boolean
  hintId: string
}) {
  const quantity = quantityOf(cfg.selection, topping.id)
  const blocker = cfg.blockerFor(topping.id)

  return (
    <div
      className={`${cardBase} ${quantity > 0 ? 'border-gold-400 bg-gold-100' : 'border-line'}`}
    >
      <Thumb id={topping.id} />
      <span className="text-[0.95rem] leading-tight font-semibold text-balance hyphens-auto text-acai-950">{topping.name}</span>
      {paid ? (
        <span className="nums inline-block rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-acai-950">
          + {formatBRL(topping.priceCents)} cada
        </span>
      ) : (
        <FreeBadge />
      )}
      <QuantityStepper
        label={topping.name}
        quantity={quantity}
        onAdd={() => cfg.add(topping.id)}
        onRemove={() => cfg.remove(topping.id)}
        addBlockedReason={blocker ? blockerText(blocker, cfg.freeLimit) : null}
        describedBy={hintId}
        className="mt-auto"
      />
    </div>
  )
}
