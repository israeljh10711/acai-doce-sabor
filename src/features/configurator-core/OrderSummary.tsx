import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Bag } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { cartActions } from '../cart/cartStore.ts'
import { type Product, TOPPING_GROUPS } from '../catalog/menu.ts'
import { type Selection, selectedByGroup } from '../catalog/selection.ts'
import { AnimatedValue } from './AnimatedValue.tsx'
import type { ConfiguratorApi } from './useConfigurator.ts'

const MISSING_TEXT = { size: 'o tamanho', flavor: 'o sabor' } as const

type OrderSummaryProps = {
  product: Product
  cfg: ConfiguratorApi
  /** Item do carrinho em edição: o botão salva as mudanças nele em vez de criar outro. */
  editingItemId?: string
}

/** Resumo do pedido montado, com o preço de cada parte, o total e o botão do carrinho. */
export function OrderSummary({ product, cfg, editingItemId }: OrderSummaryProps) {
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
          <p id="resumo-falta" className="text-ink-soft">
            Escolha o tamanho para ver o preço.
          </p>
        )}

        {cfg.missing.length > 0 && cfg.size && (
          <p
            id="resumo-falta"
            className="mt-4 rounded-2xl bg-gold-100 px-4 py-3 text-sm font-semibold text-acai-950 ring-1 ring-gold-400"
          >
            Falta escolher {cfg.missing.map((choice) => MISSING_TEXT[choice]).join(' e ')}.
          </p>
        )}

        <CartButton product={product} cfg={cfg} editingItemId={editingItemId} />
      </div>
    </section>
  )
}

function CartButton({ product, cfg, editingItemId }: OrderSummaryProps) {
  const navigate = useNavigate()
  // Montagem que acabou de ir para o carrinho. Qualquer mudança cria outra seleção e o aviso some.
  const [addedSelection, setAddedSelection] = useState<Selection | null>(null)
  const ready = cfg.size !== undefined && cfg.missing.length === 0
  const justAdded = addedSelection === cfg.selection

  const submit = () => {
    if (!ready) return
    if (editingItemId) {
      cartActions.update(editingItemId, cfg.selection)
      navigate(paths.cart)
      return
    }
    if (cartActions.add(product.slug, cfg.selection)) setAddedSelection(cfg.selection)
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <button
        type="button"
        onClick={submit}
        aria-disabled={!ready}
        aria-describedby={ready ? undefined : 'resumo-falta'}
        className="btn-gold inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-base font-extrabold tracking-tight uppercase focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:shadow-none aria-disabled:hover:translate-y-0"
      >
        <Bag className="size-5" />
        {editingItemId ? 'Salvar alterações' : 'Adicionar ao carrinho'}
        {cfg.price && ready && <span className="nums font-bold whitespace-nowrap">· {formatBRL(cfg.price.totalCents)}</span>}
      </button>

      <p role="status" className="min-h-6 text-center text-sm font-semibold text-acai-800">
        {justAdded && (
          <>
            {product.name} adicionado ao carrinho.{' '}
            <Link
              to={paths.cart}
              className="inline-flex items-center gap-1 font-extrabold underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              Ver carrinho
              <ArrowRight className="size-4" />
            </Link>
          </>
        )}
      </p>
    </div>
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
