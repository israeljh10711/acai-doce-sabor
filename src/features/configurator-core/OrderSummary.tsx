import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Bag } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { cartActions } from '../cart/cartStore.ts'
import { ProductVisual } from '../catalog/ItemVisual.tsx'
import { type Product, TOPPING_GROUPS, flavorTermOf } from '../catalog/menu.ts'
import { productInfo } from '../catalog/productInfo.ts'
import { freeByGroup } from '../catalog/selection.ts'
import { AnimatedValue } from './AnimatedValue.tsx'
import { ConfirmItemDialog } from './ConfirmItemDialog.tsx'
import { productSummary } from './confirmSummary.ts'
import type { ConfiguratorApi } from './useConfigurator.ts'

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
  const term = flavorTermOf(product)
  const missingText = { size: 'o tamanho', flavor: term.missing } as const

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
            <Line
              label={product.sizes.length > 1 ? `${product.name} · ${cfg.size.name}` : product.name}
              value={formatBRL(cfg.price.sizeCents)}
            />
            {flavor && (
              <p className="text-sm text-ink-soft">
                {term.label}: {flavor.name}
              </p>
            )}
            {cfg.completeLabel && (
              <p data-montagem="" className="rounded-xl bg-gold-100 px-3 py-2 text-sm font-bold text-acai-950 ring-1 ring-gold-400">
                Montagem: {cfg.completeLabel}
              </p>
            )}
            {cfg.selectedCount > 0 && (
              <p className="nums text-sm font-semibold text-acai-800">
                {cfg.selectedCount} {cfg.selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
              </p>
            )}

            {freeGroups.map((group) => {
              const items = freeByGroup(product, cfg.selection, group)
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
            Falta escolher {cfg.missing.map((choice) => missingText[choice]).join(' e ')}.
          </p>
        )}

        <CartButton product={product} cfg={cfg} editingItemId={editingItemId} />
      </div>
    </section>
  )
}

/** Nome do item adicionado, para o Cardápio avisar ao voltar ("continuar comprando"). */
export type AddedItemState = { added: string }

function CartButton({ product, cfg, editingItemId }: OrderSummaryProps) {
  const navigate = useNavigate()
  const button = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)
  const ready = cfg.size !== undefined && cfg.missing.length === 0

  const submit = () => {
    if (!ready) return
    if (editingItemId) {
      // Item que já está no carrinho: salvar as mudanças, sem confirmação de item novo.
      cartActions.update(editingItemId, cfg.selection)
      navigate(paths.cart)
      return
    }
    setConfirming(true)
  }

  /** Põe no carrinho e segue para `to`. O personalizador recomeça vazio ao sair da página. */
  const addAndGo = (to: string, state?: AddedItemState) => {
    setConfirming(false)
    if (!cartActions.add(product.slug, cfg.selection)) return
    navigate(to, { state })
  }

  return (
    <div className="mt-5">
      <button
        ref={button}
        type="button"
        onClick={submit}
        aria-disabled={!ready}
        aria-describedby={ready ? undefined : 'resumo-falta'}
        aria-haspopup={editingItemId ? undefined : 'dialog'}
        className="btn-gold inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-base font-extrabold tracking-tight uppercase focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 aria-disabled:shadow-none aria-disabled:hover:translate-y-0"
      >
        <Bag className="size-5" />
        {editingItemId ? 'Salvar alterações' : 'Adicionar ao carrinho'}
        {cfg.price && ready && <span className="nums font-bold whitespace-nowrap">· {formatBRL(cfg.price.totalCents)}</span>}
      </button>

      {!editingItemId && (
        <ConfirmItemDialog
          open={confirming}
          summary={productSummary(product.slug, cfg.selection)}
          visual={<ProductVisual slug={product.slug} sizes="80px" className="size-full" decorative zoom />}
          opener={button}
          onAddAndGoToCart={() => addAndGo(paths.cart)}
          onAddAndContinue={() => addAndGo(productInfo(product.slug).continuePath, { added: product.name })}
          onBack={() => setConfirming(false)}
        />
      )}
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
