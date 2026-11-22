import { formatBRL } from '../../utils/money.ts'
import { type ComandaItem, parseComandaItems } from './ordersPanel.ts'

/** Um item da comanda: quantidade, nome, SEM, extras pagos, acompanhamentos e observação. */
function ItemView({ item }: { item: ComandaItem }) {
  return (
    <li data-order-item="" className="flex flex-col gap-1">
      <p className="flex items-baseline justify-between gap-3 font-bold text-acai-950">
        <span className="min-w-0">
          {item.quantity}x {item.name}
        </span>
        <span className="nums shrink-0 whitespace-nowrap">{item.total}</span>
      </p>
      {item.details && <p className="text-ink-soft">{item.details}</p>}
      {item.rows.map((row) => (
        <p key={row.label}>
          <span className="font-semibold">{row.label}:</span> {row.value}
        </p>
      ))}
      {item.montagem && <p className="font-semibold text-acai-800">✨ {item.montagem}</p>}
      {item.removed.length > 0 && (
        <p data-item-removed="" className="rounded-lg bg-red-50 px-2 py-1 font-extrabold text-red-800 ring-1 ring-red-200">
          🚫 SEM: {item.removed.join(', ')}
        </p>
      )}
      {item.paid && (
        <p data-item-paid="" className="rounded-lg bg-orchid-100 px-2 py-1 font-bold text-acai-950 ring-1 ring-orchid-400">
          ➕ Extras pagos: {item.paid}
        </p>
      )}
      {item.included.map((group) => (
        <p key={group.label} className="text-acai-950">
          <span className="font-semibold">{group.label}:</span> {group.names}
        </p>
      ))}
      {item.note && (
        <p data-item-note="" className="rounded-lg bg-acai-50 px-2 py-1.5 font-semibold text-acai-950 ring-1 ring-line">
          📝 Observação: {item.note}
        </p>
      )}
    </li>
  )
}

/**
 * Os itens de um pedido como a comanda gravada os descreve (o painel do vendedor e o
 * acompanhamento do cliente leem igual). Sem a parte dos itens na comanda, a lista gravada.
 */
export function ComandaItems({
  comanda,
  fallback,
}: {
  comanda: string
  fallback: readonly { name: string; quantity: number; totalCents: number; note: string | null }[]
}) {
  const items = parseComandaItems(comanda)
  return items.length > 0 ? (
    <ul data-order-items="" className="flex flex-col gap-3 text-sm leading-snug">
      {items.map((item, index) => (
        <ItemView key={index} item={item} />
      ))}
    </ul>
  ) : (
    <ul data-order-items="" className="flex flex-col gap-1 text-sm text-acai-950">
      {fallback.map((item, index) => (
        <li key={index}>
          <span className="font-bold">
            {item.quantity}x {item.name}
          </span>{' '}
          — {formatBRL(item.totalCents)}
          {item.note && <span className="mt-1 block rounded-lg bg-acai-50 px-2 py-1 font-semibold ring-1 ring-line">📝 Observação: {item.note}</span>}
        </li>
      ))}
    </ul>
  )
}
