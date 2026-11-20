import { useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { toWhatsAppNumber } from '../../utils/whatsapp.ts'
import {
  type ComandaItem,
  type OrderStatus,
  type PanelOrder,
  STATUS_LABEL,
  canCancel,
  feeLine,
  nextStep,
  parseComandaItems,
  paymentText,
} from './ordersPanel.ts'

const STATUS_STYLE: Record<OrderStatus, string> = {
  novo: 'bg-gold-100 text-acai-950 ring-gold-400',
  confirmado: 'bg-acai-100 text-acai-800 ring-acai-800/20',
  preparando: 'bg-orange-100 text-orange-900 ring-orange-300',
  pronto: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  pronto_retirada: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  pronto_consumo: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  saiu_para_entrega: 'bg-sky-100 text-sky-900 ring-sky-300',
  concluido: 'bg-zinc-100 text-zinc-700 ring-zinc-300',
  cancelado: 'bg-red-100 text-red-800 ring-red-300',
}

const STORE_TIME_ZONE = 'America/Sao_Paulo'
const timeParts = new Intl.DateTimeFormat('pt-BR', { timeZone: STORE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayParts = new Intl.DateTimeFormat('pt-BR', { timeZone: STORE_TIME_ZONE, day: '2-digit', month: '2-digit' })

/** "15:42" (horário da loja) hoje; "19/11 às 22:10" de outro dia. */
function whenText(createdAt: number, now: number): string {
  if (!createdAt) return '—'
  const time = timeParts.format(createdAt)
  return dayParts.format(createdAt) === dayParts.format(now) ? time : `${dayParts.format(createdAt)} às ${time}`
}

/** O WhatsApp do CLIENTE (não o da loja): só dígitos, com o 55. Telefone inválido: nada. */
function customerWhatsApp(phone: string | null): string | null {
  if (!phone) return null
  try {
    return `https://wa.me/${toWhatsAppNumber(phone)}`
  } catch {
    return null
  }
}

/** Selo da modalidade: emoji e texto sempre juntos. Comer no Local em dourado e roxo. */
export function ModalityBadge({ type }: { type: PanelOrder['deliveryType'] }) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-sm leading-tight font-extrabold'
  switch (type) {
    case 'entrega':
      return <span data-modality="entrega" className={`${base} bg-acai-100 text-acai-800 ring-1 ring-acai-800/25`}>🛵 Entrega</span>
    case 'retirada':
      return <span data-modality="retirada" className={`${base} bg-white text-acai-800 ring-2 ring-acai-800`}>🛍️ Retirar</span>
    case 'local':
      return <span data-modality="local" className={`${base} bg-gold-400 text-acai-950 ring-2 ring-acai-800`}>🍨 Comer no Local</span>
    default:
      return <span data-modality="desconhecida" className={`${base} bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300`}>Modalidade não informada</span>
  }
}

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
        <p data-item-paid="" className="rounded-lg bg-gold-100 px-2 py-1 font-bold text-acai-950 ring-1 ring-gold-400">
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

const actionButton =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-wait disabled:opacity-60'

/**
 * Um pedido no painel ao vivo (2026-11-20): `#ADS-0001`, hora, situação, cliente e o selo da
 * modalidade; os itens organizados (SEM, extras pagos, observação); endereço e GPS só na entrega;
 * valores e pagamento como gravados; o próximo passo da modalidade, "❌ Cancelar" com
 * confirmação e "💬 Chamar Cliente no WhatsApp".
 */
export function OrderCard({
  order,
  now,
  busy,
  error,
  onStatus,
}: {
  order: PanelOrder
  now: number
  busy: boolean
  error: string | null
  onStatus: (status: OrderStatus) => void
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const next = nextStep(order)
  const items = parseComandaItems(order.message)
  const fee = feeLine(order)
  const whatsapp = customerWhatsApp(order.customerPhone)
  const { address } = order
  const finished = order.status === 'concluido' || order.status === 'cancelado'

  return (
    <article
      data-order-card={order.code}
      data-status={order.status}
      aria-labelledby={`pedido-${order.id}`}
      className={`flex flex-col gap-3.5 rounded-2xl bg-white p-4 shadow-card sm:p-5 ${
        order.status === 'novo' ? 'ring-2 ring-gold-400' : order.status === 'cancelado' ? 'opacity-80 ring-2 ring-red-300' : 'ring-1 ring-line'
      }`}
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`pedido-${order.id}`} className="nums font-display text-2xl font-black tracking-tight text-acai-800">
              #{order.code}
            </h2>
            <p className="text-sm text-ink-soft">
              <span data-order-time="" className="nums">
                {whenText(order.createdAt, now)}
              </span>
              {order.antecipado && <span className="font-bold text-acai-800"> · Pedido antecipado</span>}
            </p>
          </div>
          <span data-status-pill="" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wide uppercase ring-1 ${STATUS_STYLE[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <p data-order-customer="" className="text-base font-bold text-acai-950">
          {order.customerName || 'Cliente sem nome'}
          {order.customerPhone && <span className="nums ml-2 text-sm font-semibold text-ink-soft">{order.customerPhone}</span>}
        </p>
        <div>
          <ModalityBadge type={order.deliveryType} />
        </div>
      </header>

      {order.status === 'cancelado' && (
        <p data-order-final="" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-extrabold text-red-800 ring-1 ring-red-200">
          ❌ Pedido cancelado
        </p>
      )}
      {order.status === 'concluido' && (
        <p data-order-final="" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-900 ring-1 ring-emerald-200">
          ✅ Pedido concluído
        </p>
      )}

      {order.deliveryType === 'entrega' && address && (
        <section data-order-address="" aria-label="Endereço de entrega" className="rounded-xl bg-acai-50 p-3 text-sm text-acai-950 ring-1 ring-line">
          <p className="font-bold">
            {address.street}, {address.number}
          </p>
          <p>
            <span className="font-semibold">Bairro:</span> {address.district}
          </p>
          {address.reference && (
            <p>
              <span className="font-semibold">Ref.:</span> {address.reference}
            </p>
          )}
          {order.mapsUrl && (
            <a
              data-order-gps=""
              href={order.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-acai-800 px-4 text-sm font-bold text-white transition hover:bg-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              📍 Abrir GPS no Mapa
            </a>
          )}
        </section>
      )}

      <section aria-label="Itens do pedido">
        {items.length > 0 ? (
          <ul data-order-items="" className="flex flex-col gap-3 text-sm leading-snug">
            {items.map((item, index) => (
              <ItemView key={index} item={item} />
            ))}
          </ul>
        ) : (
          <ul data-order-items="" className="flex flex-col gap-1 text-sm text-acai-950">
            {order.items.map((item, index) => (
              <li key={index}>
                <span className="font-bold">
                  {item.quantity}x {item.name}
                </span>{' '}
                — {formatBRL(item.totalCents)}
                {item.note && <span className="mt-1 block rounded-lg bg-acai-50 px-2 py-1 font-semibold ring-1 ring-line">📝 Observação: {item.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm text-acai-950">
        <Row label="Subtotal" value={formatBRL(order.subtotalCents)} />
        <Row label={fee.label} value={fee.value} />
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-display font-extrabold text-acai-800 uppercase">Total</dt>
          <dd className="nums text-xl font-extrabold whitespace-nowrap text-acai-800">
            {formatBRL(order.totalCents)}
            {order.fee.kind === 'combinar' && <span className="block text-right text-xs font-semibold text-ink-soft">+ frete a combinar</span>}
          </dd>
        </div>
        <div data-order-payment="" className="mt-1 rounded-lg bg-acai-50 px-2.5 py-1.5 font-bold ring-1 ring-line">
          {paymentText(order)}
        </div>
      </dl>

      {(!finished || whatsapp) && (
        <footer className="flex flex-col gap-2 border-t border-line pt-3">
          {next && !confirmingCancel && (
            <button
              type="button"
              data-order-next={next.status}
              disabled={busy}
              aria-busy={busy || undefined}
              aria-label={`${next.label} — pedido ${order.code}`}
              onClick={() => onStatus(next.status)}
              className={`${actionButton} btn-gold`}
            >
              {busy ? 'Salvando…' : next.label}
            </button>
          )}
          {whatsapp && (
            <a
              data-order-whatsapp=""
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={`${actionButton} min-h-11 bg-white font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100`}
            >
              💬 Chamar Cliente no WhatsApp
            </a>
          )}
          {canCancel(order) &&
            (confirmingCancel ? (
              <div role="group" aria-label={`Cancelar o pedido ${order.code}`} className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                <p className="text-sm font-bold text-red-900">Cancelar o pedido #{order.code}?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    data-order-cancel-confirm=""
                    disabled={busy}
                    onClick={() => {
                      setConfirmingCancel(false)
                      onStatus('cancelado')
                    }}
                    className={`${actionButton} flex-1 bg-red-700 text-white hover:bg-red-800`}
                  >
                    Sim, cancelar
                  </button>
                  <button
                    type="button"
                    data-order-cancel-back=""
                    onClick={() => setConfirmingCancel(false)}
                    className={`${actionButton} flex-1 bg-white text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100`}
                  >
                    Não
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                data-order-cancel=""
                disabled={busy}
                aria-label={`❌ Cancelar — pedido ${order.code}`}
                onClick={() => setConfirmingCancel(true)}
                className={`${actionButton} min-h-11 bg-white font-bold text-red-800 ring-1 ring-red-300 hover:bg-red-50`}
              >
                ❌ Cancelar
              </button>
            ))}
        </footer>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-red-800">
          {error}
        </p>
      )}
    </article>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 font-semibold">{label}</dt>
      <dd className="nums shrink-0 text-right font-bold whitespace-nowrap">{value}</dd>
    </div>
  )
}
