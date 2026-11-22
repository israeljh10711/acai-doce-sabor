import { Link } from 'react-router'
import { ArrowRight, Plus } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { type ExtraItem, choiceGroupsOf, hasPricedChoices } from './extras.ts'

/** Item escolhido (sem personalizador): abre a escolha de sabor ou a confirmação. */
export type ChooseItem = (item: ExtraItem, opener: HTMLElement) => void

const actionClass =
  'btn-primary inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-sm font-extrabold whitespace-nowrap focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Botão de compra de um item do catálogo, igual nas seções e na faixa de destaques: leva ao
 * personalizador (Pote 1 L Montado, Barca) ou abre a escolha de sabor ou a confirmação. Com
 * `label` ("Pedir"), o texto é o mesmo para todos os tipos.
 */
export function ItemActionButton({
  item,
  onChoose,
  label,
  className = '',
}: {
  item: ExtraItem
  onChoose: ChooseItem
  label?: string
  className?: string
}) {
  // Esgotado pelo vendedor: o botão fica desligado, com "Indisponível no momento" (2026-11-17).
  if (item.available === false) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex min-h-11 shrink-0 cursor-not-allowed items-center justify-center rounded-full bg-line px-4 text-sm font-bold whitespace-nowrap text-ink-soft ${className}`}
      >
        Indisponível no momento
        <span className="sr-only">: {item.name}</span>
      </button>
    )
  }
  if (item.action.type === 'customizer') {
    return (
      <Link to={paths.configurator(item.action.product)} className={`${actionClass} ${className}`}>
        {label ?? item.action.label}
        <span className="sr-only">: {item.name}</span>
        <ArrowRight className="size-4" />
      </Link>
    )
  }
  const groups = choiceGroupsOf(item)
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => onChoose(item, event.currentTarget)}
      className={`${actionClass} ${className}`}
    >
      {label ??
        (groups.length === 0 ? (
          <>
            <Plus className="size-4" />
            Adicionar
          </>
        ) : groups.length > 1 ? (
          groups.some((group) => group.prices) ? 'Escolher tamanho e sabor' : 'Escolher sabores'
        ) : groups[0].prices ? (
          'Escolher tamanho'
        ) : (
          'Escolher sabor'
        ))}
      <span className="sr-only">: {item.name}</span>
    </button>
  )
}

/** Preço do item: o antigo riscado (quando há) e "a partir de" quando o preço muda com a escolha. */
export function ItemPrice({ item, size = 'lg' }: { item: ExtraItem; size?: 'base' | 'lg' }) {
  return (
    <p className="nums flex flex-wrap items-baseline gap-x-2 leading-tight">
      {item.originalPriceCents !== undefined && (
        <>
          <span className="sr-only">De </span>
          <s className="text-sm text-ink-soft">{formatBRL(item.originalPriceCents)}</s>
          <span className="sr-only"> por </span>
        </>
      )}
      {hasPricedChoices(item) && <span className="text-sm font-semibold text-ink-soft">a partir de</span>}
      <strong className={`font-extrabold whitespace-nowrap text-acai-800 ${size === 'lg' ? 'text-lg' : 'text-base'}`}>
        {formatBRL(item.priceCents)}
      </strong>
    </p>
  )
}
