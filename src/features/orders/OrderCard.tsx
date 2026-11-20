import { type ReactNode, useState } from 'react'
import { ArrowRight, Bag, Chat, IceCreamBowl, Pin, Scooter } from '../../components/ui/icons.tsx'
import { formatBRL } from '../../utils/money.ts'
import { toWhatsAppNumber } from '../../utils/whatsapp.ts'
import { type OrderStatus, type PanelOrder, STATUS_LABEL, canCancel, comandaItems, feeLine, nextStep, paymentText } from './ordersPanel.ts'

const STATUS_STYLE: Record<OrderStatus, string> = {
  novo: 'bg-gold-100 text-acai-950 ring-gold-400',
  confirmado: 'bg-acai-100 text-acai-800 ring-acai-800/20',
  preparando: 'bg-orange-100 text-orange-900 ring-orange-300',
  pronto: 'bg-emerald-100 text-emerald-900 ring-emerald-300',
  saiu_para_entrega: 'bg-sky-100 text-sky-900 ring-sky-300',
  concluido: 'bg-zinc-100 text-zinc-700 ring-zinc-300',
  cancelado: 'bg-red-100 text-red-800 ring-red-300',
}

const timeParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const dayParts = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

/** "15:42" hoje; "19/11 às 22:10" de outro dia. */
function whenText(createdAt: number, now: number): string {
  if (!createdAt) return '—'
  const time = timeParts.format(createdAt)
  return dayParts.format(createdAt) === dayParts.format(now) ? time : `${dayParts.format(createdAt)} às ${time}`
}

function whatsappLink(phone: string): string | null {
  try {
    return `https://wa.me/${toWhatsAppNumber(phone)}`
  } catch {
    return null
  }
}

/**
 * Selo da modalidade (pedido de 2026-11-20): ícone e texto sempre juntos, nunca só a cor. Comer no
 * Local em dourado e roxo, para a equipe ver de longe que é para servir na loja.
 */
export function ModalityBadge({ type }: { type: PanelOrder['deliveryType'] }) {
  const base = 'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-base leading-tight font-extrabold'
  switch (type) {
    case 'entrega':
      return (
        <span data-modality="entrega" className={`${base} bg-acai-100 text-acai-800 ring-1 ring-acai-800/25`}>
          <Scooter className="size-5" />
          Entrega
        </span>
      )
    case 'retirada':
      return (
        <span data-modality="retirada" className={`${base} bg-white text-acai-800 ring-2 ring-acai-800`}>
          <Bag className="size-5" />
          Retirar
        </span>
      )
    case 'local':
      return (
        <span data-modality="local" className={`${base} bg-gold-400 text-acai-950 ring-2 ring-acai-800`}>
          <IceCreamBowl className="size-5 text-acai-800" />
          Comer no Local
        </span>
      )
    default:
      return (
        <span data-modality="desconhecida" className={`${base} bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300`}>
          Modalidade não informada
        </span>
      )
  }
}

const actionButton =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-wait disabled:opacity-60'

/**
 * Um pedido no painel do vendedor (pedido de 2026-11-20, etapa 2): código, hora, situação, o selo
 * da modalidade, o cliente, o endereço e o GPS (só na entrega), os itens como saíram na comanda,
 * os valores, o pagamento e os botões para avançar a situação ou cancelar.
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
  const items = comandaItems(order.message)
  const fee = feeLine(order)
  const phoneLink = order.customerPhone ? whatsappLink(order.customerPhone) : null
  const { address } = order

  return (
    <article
      data-order-card={order.code}
      data-status={order.status}
      aria-labelledby={`pedido-${order.id}`}
      className={`flex flex-col gap-3.5 rounded-2xl bg-white p-4 shadow-card sm:p-5 ${order.status === 'novo' ? 'ring-2 ring-gold-400' : 'ring-1 ring-line'}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`pedido-${order.id}`} className="nums font-display text-2xl font-black tracking-tight text-acai-800">
            {order.code}
          </h2>
          <p className="text-sm text-ink-soft">
            <span className="nums">{whenText(order.createdAt, now)}</span>
            {order.antecipado && <span className="font-bold text-acai-800"> · Pedido antecipado</span>}
          </p>
        </div>
        <span data-status-pill="" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tracking-wide uppercase ring-1 ${STATUS_STYLE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </header>

      <div>
        <ModalityBadge type={order.deliveryType} />
      </div>

      <section aria-label="Cliente" className="text-sm text-acai-950">
        <p className="text-base font-bold">{order.customerName || 'Cliente sem nome'}</p>
        {order.customerPhone && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3">
            <span className="nums">{order.customerPhone}</span>
            {phoneLink && (
              <a
                href={phoneLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-bold text-acai-700 underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                <Chat className="size-4" />
                WhatsApp do cliente
              </a>
            )}
          </p>
        )}
      </section>

      {order.deliveryType === 'entrega' && address && (
        <section data-order-address="" aria-label="Endereço de entrega" className="rounded-xl bg-acai-50 p-3 text-sm text-acai-950 ring-1 ring-line">
          <p className="font-bold">
            {address.street}, {address.number} — {address.district}
          </p>
          {address.reference && <p className="mt-0.5">Ref.: {address.reference}</p>}
          {order.mapsUrl && (
            <a
              data-order-gps=""
              href={order.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-acai-800 px-4 text-sm font-bold text-white transition hover:bg-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              <Pin className="size-5 text-gold-400" />
              Abrir GPS no Mapa
            </a>
          )}
        </section>
      )}

      <section aria-label="Itens do pedido">
        {items.length > 0 ? (
          <ul data-order-items="" className="flex flex-col gap-0.5 text-sm leading-snug text-acai-950">
            {items.map((line, index) => (
              <li key={index} className={line ? 'whitespace-pre-wrap' : 'h-2'}>
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <ul data-order-items="" className="flex flex-col gap-0.5 text-sm text-acai-950">
            {order.items.map((item, index) => (
              <li key={index}>
                {item.quantity}x {item.name} — {formatBRL(item.totalCents)}
                {item.note && <span className="block pl-4 text-ink-soft">Obs.: {item.note}</span>}
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
        <Row label="Pagamento" value={paymentText(order)} wrap />
      </dl>

      {(next || canCancel(order)) && (
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
              {next.label}
              <ArrowRight className="size-4" />
            </button>
          )}
          {canCancel(order) &&
            (confirmingCancel ? (
              <div role="group" aria-label={`Cancelar o pedido ${order.code}`} className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                <p className="text-sm font-bold text-red-900">Cancelar o pedido {order.code}?</p>
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
                aria-label={`Cancelar — pedido ${order.code}`}
                onClick={() => setConfirmingCancel(true)}
                className={`${actionButton} min-h-11 bg-white font-bold text-red-800 ring-1 ring-red-300 hover:bg-red-50`}
              >
                Cancelar
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

function Row({ label, value, wrap = false }: { label: string; value: ReactNode; wrap?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      {/* Valor longo (pagamento com troco) quebra a linha; o rótulo fica inteiro. */}
      <dt className={`font-semibold ${wrap ? 'shrink-0' : 'min-w-0'}`}>{label}</dt>
      <dd className={`nums text-right font-bold ${wrap ? 'min-w-0' : 'shrink-0 whitespace-nowrap'}`}>{value}</dd>
    </div>
  )
}
