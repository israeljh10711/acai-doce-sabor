import { m } from 'motion/react'
import { type RefObject, useEffect, useRef } from 'react'
import { ArrowRight, Bag, Pencil } from '../../components/ui/icons.tsx'
import { formatBRL } from '../../utils/money.ts'
import { choiceText, summarizeSelection } from '../cart/cart.ts'
import type { Product } from '../catalog/menu.ts'
import { ProductPhoto } from '../catalog/ProductPhoto.tsx'
import type { Selection } from '../catalog/selection.ts'

const list = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

type ConfirmItemDialogProps = {
  open: boolean
  product: Product
  selection: Selection
  onAddAndGoToCart: () => void
  onAddAndContinue: () => void
  /** Fecha sem adicionar, com as escolhas intactas (botão, Esc ou toque fora da janela). */
  onBack: () => void
  /** Botão que abriu a janela: recebe o foco de volta ao fechar. */
  opener: RefObject<HTMLElement | null>
}

const action =
  'inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2 text-base leading-tight font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800'

/**
 * Confirmação antes de pôr o item no carrinho (pedido de 2026-11-14): tudo o que foi escolhido,
 * o valor e três saídas. "Voltar e editar" não adiciona nem apaga nada.
 */
export function ConfirmItemDialog({
  open,
  product,
  selection,
  onAddAndGoToCart,
  onAddAndContinue,
  onBack,
  opener,
}: ConfirmItemDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) {
      element.showModal()
      primary.current?.focus()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  const summary = summarizeSelection(product.slug, selection)
  const rows = [
    ...(summary.flavorName ? [{ label: 'Sabor', value: summary.flavorName }] : []),
    ...summary.sections.map((section) => ({ label: section.label, value: list.format(section.items.map(choiceText)) })),
  ]

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="confirmar-item-titulo"
      aria-describedby="confirmar-item-resumo confirmar-item-pergunta"
      onClick={(event) => event.target === dialog.current && dialog.current?.close()}
      onClose={() => {
        if (open) onBack()
        opener.current?.focus()
      }}
      className="m-auto max-h-[94dvh] w-[min(94vw,32rem)] overflow-hidden rounded-3xl bg-white p-0 shadow-lift backdrop:bg-acai-950/70"
    >
      {open && (
        <m.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="flex max-h-[94dvh] flex-col"
        >
          <h2
            id="confirmar-item-titulo"
            className="bg-acai-800 px-5 py-4 font-display text-xl leading-tight font-black tracking-tight text-white uppercase"
          >
            Confirme seu item antes de adicionar
          </h2>

          <div id="confirmar-item-resumo" className="overflow-y-auto px-5 pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                <ProductPhoto slug={product.slug} sizes="80px" className="size-full" decorative />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Produto e tamanho</p>
                <p className="font-display text-lg leading-snug font-black text-acai-800">
                  {summary.productName} — {summary.sizeLabel}
                </p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-line border-y border-line">
              {rows.map((row) => (
                <div key={row.label} className="py-2.5">
                  <dt className="text-xs font-bold tracking-wide text-ink-soft uppercase">{row.label}</dt>
                  <dd className="mt-0.5 font-semibold text-acai-950">{row.value}</dd>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="py-2.5">
                  <dt className="sr-only">Ingredientes</dt>
                  <dd className="text-ink-soft">Sem adicionais, frutas nem caldas.</dd>
                </div>
              )}
            </dl>

            <p className="mt-4 flex items-baseline justify-between gap-3 rounded-2xl bg-gold-100 px-4 py-3 text-acai-950 ring-1 ring-gold-400">
              <span className="font-bold">Valor do item:</span>
              <strong className="nums text-2xl font-extrabold whitespace-nowrap">{formatBRL(summary.unitCents)}</strong>
            </p>
          </div>

          {/* A pergunta e os botões ficam sempre à vista; só o resumo rola, se for longo. */}
          <div className="flex flex-col gap-2.5 border-t border-line px-5 pt-3 pb-5">
            <p id="confirmar-item-pergunta" className="text-center font-semibold text-acai-950">
              Deseja adicionar este item ao carrinho?
            </p>
            <button ref={primary} type="button" onClick={onAddAndGoToCart} className={`btn-gold ${action}`}>
              <Bag className="size-5" />
              Adicionar e ir para o carrinho
            </button>
            <button
              type="button"
              onClick={onAddAndContinue}
              className={`bg-acai-800 text-white transition hover:bg-acai-700 active:scale-[0.98] ${action}`}
            >
              Adicionar e continuar comprando
              <ArrowRight className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={`text-acai-800 ring-1 ring-acai-800/35 transition hover:bg-acai-100 ${action}`}
            >
              <Pencil className="size-4" />
              Voltar e editar
            </button>
          </div>
        </m.div>
      )}
    </dialog>
  )
}
