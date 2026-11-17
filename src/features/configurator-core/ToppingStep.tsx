import { m } from 'motion/react'
import { Check } from '../../components/ui/icons.tsx'
import { type Product, TOPPING_GROUPS, type Topping, type ToppingGroupId, toppingsOf } from '../catalog/menu.ts'
import { ingredientPhoto } from '../catalog/photos.ts'
import { toppingLightbox } from '../lightbox/lightboxImages.ts'
import { ZoomButton } from '../lightbox/ZoomButton.tsx'
import { COMPLETE_GROUPS, completeToppings, quantityOf, selectedByGroup } from '../catalog/selection.ts'
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
  'relative flex h-full w-full flex-col items-center gap-1.5 rounded-2xl border-2 bg-white px-2 pt-3 pb-2.5 text-center transition duration-200'

/** Texto da dica ao lado do título do grupo. */
function hintFor(product: Product, group: ToppingGroupId, cfg: ConfiguratorApi): { text: string; full: boolean } {
  const { rule } = TOPPING_GROUPS[group]
  // Completo: sem cota; a dica conta o que está marcado.
  if (cfg.selection.complete && COMPLETE_GROUPS.includes(group)) {
    const options = completeToppings(product).filter((topping) => topping.group === group)
    const marked = options.filter((topping) => quantityOf(cfg.selection, topping.id) > 0).length
    return { text: `Completo · ${marked} de ${options.length} marcados, sem custo`, full: false }
  }
  const optional = !product.groups.includes('dry')
  if (rule === 'limited') {
    const full = cfg.freeUsed >= cfg.freeCap
    if (cfg.size) {
      const text = `${cfg.freeUsed} de ${cfg.freeLimit} adicionais grátis`
      return { text: full ? `${text} · limite atingido` : text, full }
    }
    // Sem tamanho ainda: escolha livre; o limite grátis vem com o tamanho.
    const { min, max } = cfg.freeRange
    return { text: `${cfg.freeUsed} escolhidos · de ${min} a ${max} grátis`, full }
  }
  if (rule === 'included') {
    const priced = toppingsOf(product, group).some((topping) => topping.priceCents > 0)
    if (group === 'fruit') {
      // Na barca, até 2 frutas (pedido de 2026-11-16).
      const limit = product.groupLimits?.fruit
      if (limit === undefined) return { text: 'Uma de cada, sem custo', full: false }
      const count = selectedByGroup(product, cfg.selection, 'fruit').length
      const full = count >= limit
      return { text: `${count} de ${limit} frutas, sem custo${full ? ' · limite atingido' : ''}`, full }
    }
    return { text: priced ? 'Uma de cada · cremes à parte' : 'Uma de cada, sem custo', full: false }
  }
  return { text: optional ? 'Opcional, cobrado por unidade' : 'Cobrado por unidade', full: false }
}

/** Um grupo de ingredientes: adicionais, frutas, caldas e cremes, ou adicionais pagos. */
export function ToppingStep({ product, group, number, cfg }: ToppingStepProps) {
  const { rule, name } = TOPPING_GROUPS[group]
  const toppings = toppingsOf(product, group)
  const headingId = `${product.slug}-${group}`
  const hintId = `${headingId}-dica`
  const hint = hintFor(product, group, cfg)

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <StepHeading
        number={number}
        id={headingId}
        title={name}
        hint={hint.text}
        hintId={hintId}
        hintTone={hint.full ? 'alert' : 'neutral'}
      />

      {/* Grade de blocos: a foto do produto em cima e o nome embaixo, com a largura toda do cartão. */}
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

/**
 * Foto real do ingrediente num quadro de cantos arredondados. Embalagens aparecem inteiras
 * (`contain`); texturas preenchem o quadro (`cover`). Decorativa: o nome está logo abaixo. Tocar
 * na foto abre a foto ampliada (a lupa fica por cima de tudo no cartão, `z-10`).
 */
function Thumb({ topping }: { topping: Topping }) {
  const photo = ingredientPhoto(topping)
  return (
    // A foto ocupa o quadro inteiro (posição absoluta): assim a embalagem alta cabe inteira.
    <span className="relative z-10 block size-24 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      {photo && (
        <img
          src={photo.src}
          alt=""
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          data-fit={photo.fit}
          className={`absolute inset-0 size-full ${photo.fit === 'contain' ? 'object-contain p-1.5' : 'object-cover'}`}
        />
      )}
      {photo && <ZoomButton image={toppingLightbox(topping)} />}
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

function PriceBadge({ cents, each = false }: { cents: number; each?: boolean }) {
  return (
    <span className="nums inline-block rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-acai-950">
      + {formatBRL(cents)}
      {each && ' cada'}
    </span>
  )
}

/**
 * Fruta, calda ou creme: entra uma vez; o cartão inteiro marca e desmarca, menos a foto, que
 * amplia. O botão de marcar cobre o cartão por baixo da foto (não pode ficar um botão dentro do
 * outro).
 */
function ToggleCard({ topping, cfg, hintId }: { topping: Topping; cfg: ConfiguratorApi; hintId: string }) {
  const on = quantityOf(cfg.selection, topping.id) > 0
  const blocked = !on && cfg.blockerFor(topping.id) !== null

  return (
    <div
      className={`${cardBase} has-[>button:active:enabled]:scale-[0.98] ${blocked ? 'opacity-55' : 'hover:border-acai-600/40'} ${
        on ? 'border-gold-400 bg-gold-100' : 'border-line'
      }`}
    >
      <button
        type="button"
        // "Morango" existe como fruta e como cobertura: o nome acessível diferencia os dois.
        aria-label={toppingLabel(topping)}
        aria-pressed={on}
        disabled={blocked}
        aria-describedby={blocked ? hintId : undefined}
        onClick={() => (on ? cfg.remove(topping.id) : cfg.add(topping.id))}
        className="absolute inset-0 cursor-pointer rounded-[0.875rem] disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-acai-800"
      />
      <Thumb topping={topping} />
      <span className="text-[0.95rem] leading-tight font-semibold text-balance hyphens-auto text-acai-950">{topping.name}</span>
      {topping.priceCents > 0 ? <PriceBadge cents={topping.priceCents} /> : <FreeBadge />}
      {/* Selo de marcado no canto, como nos tamanhos: o nome fica com a largura toda. */}
      <m.span
        aria-hidden="true"
        initial={false}
        animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 28 }}
        className="pointer-events-none absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-acai-800 text-gold-400 shadow-sm"
      >
        <Check className="size-4" />
      </m.span>
    </div>
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
    <div className={`${cardBase} hover:border-acai-600/40 ${quantity > 0 ? 'border-gold-400 bg-gold-100' : 'border-line'}`}>
      <Thumb topping={topping} />
      <span className="text-[0.95rem] leading-tight font-semibold text-balance hyphens-auto text-acai-950">{topping.name}</span>
      {paid ? <PriceBadge cents={topping.priceCents} each /> : <FreeBadge />}
      <QuantityStepper
        label={topping.name}
        quantity={quantity}
        onAdd={() => cfg.add(topping.id)}
        onRemove={() => cfg.remove(topping.id)}
        addBlockedReason={
          blocker === 'item-max' && cfg.selection.complete && COMPLETE_GROUPS.includes(topping.group)
            ? 'No Completo, vai 1 de cada'
            : blocker
              ? blockerText(blocker, cfg.freeCap)
              : null
        }
        describedBy={hintId}
        className="mt-auto"
      />
    </div>
  )
}
