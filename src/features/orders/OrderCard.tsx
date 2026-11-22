import { AnimatePresence, m } from 'motion/react'
import { useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { toWhatsAppNumber } from '../../utils/whatsapp.ts'
import { ComandaItems } from './ComandaItems.tsx'
import {
  type OrderStatus,
  type PanelOrder,
  STATUS_LABEL,
  canCancel,
  feeLine,
  nextStep,
  previousStep,
  paymentText,
} from './ordersPanel.ts'

const STATUS_STYLE: Record<OrderStatus, string> = {
  novo: 'bg-orchid-100 text-acai-950 ring-orchid-400',
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
      return <span data-modality="local" className={`${base} bg-orchid-400 text-acai-950 ring-2 ring-acai-800`}>🍨 Comer no Local</span>
    default:
      return <span data-modality="desconhecida" className={`${base} bg-zinc-100 text-zinc-700 ring-1 ring-zinc-300`}>Modalidade não informada</span>
  }
}

const actionButton =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-wait disabled:opacity-60'

/**
 * Um pedido no painel ao vivo (2026-11-20): `#ADS-0001`, hora, situação, cliente e o selo da
 * modalidade; os itens organizados (SEM, extras pagos, observação); endereço e GPS só na entrega;
 * valores e pagamento como gravados; o próximo passo da modalidade, "❌ Cancelar" com
 * confirmação e "💬 Chamar Cliente no WhatsApp".
 *
 * `added` (2026-11-20): o cliente acabou de acrescentar itens e o vendedor ainda não viu. O cartão
 * ganha a borda roxa e a faixa "➕ Novos itens adicionados" com "✓ Visto" (que tira o destaque).
 */
export function OrderCard({
  order,
  now,
  busy,
  error,
  onStatus,
  added = false,
  onSeen,
  onBack,
  elapsed = null,
  late = false,
  flash = null,
}: {
  order: PanelOrder
  now: number
  busy: boolean
  error: string | null
  onStatus: (status: OrderStatus) => void
  added?: boolean
  onSeen?: () => void
  /** "↩ Voltar etapa" (2026-11-21). */
  onBack?: (status: OrderStatus) => void
  /** "Há 12 min" desde que o pedido entrou (só nos pedidos em andamento). */
  elapsed?: string | null
  /** Passou do tempo de entrega configurado pela loja. */
  late?: boolean
  /** O retorno da última ação ("↩ Etapa restaurada: Preparando"), por alguns segundos. */
  flash?: string | null
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  // "✅ Concluir" pede uma confirmação leve (2026-11-21): um toque sem querer não encerra o pedido.
  const [confirmingConclude, setConfirmingConclude] = useState(false)
  const back = previousStep(order)
  const asking = confirmingCancel || confirmingConclude
  const next = nextStep(order)
  const fee = feeLine(order)
  const whatsapp = customerWhatsApp(order.customerPhone)
  const { address } = order
  const finished = order.status === 'concluido' || order.status === 'cancelado'

  return (
    <article
      data-order-card={order.code}
      data-status={order.status}
      data-order-added={added ? '' : undefined}
      aria-labelledby={`pedido-${order.id}`}
      tabIndex={-1}
      className={`flex scroll-mt-24 flex-col gap-3.5 rounded-2xl p-4 shadow-card transition-[box-shadow,background-color] duration-300 outline-none sm:p-5 ${
        added
          ? 'bg-acai-50 ring-4 ring-acai-600'
          : `bg-white ${order.status === 'novo' ? 'ring-2 ring-orchid-400' : order.status === 'cancelado' ? 'opacity-80 ring-2 ring-red-300' : 'ring-1 ring-line'}`
      }`}
    >
      <AnimatePresence initial={false}>
        {added && (
          <m.div
            key="novos-itens"
            data-added-badge=""
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.25 }}
            className="flex items-center justify-between gap-2 rounded-xl bg-acai-800 py-1.5 pr-1.5 pl-3 text-sm font-extrabold text-white"
          >
            <span>➕ Novos itens adicionados</span>
            <button
              type="button"
              data-added-seen=""
              aria-label={`Visto: itens novos do pedido ${order.code}`}
              onClick={onSeen}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-orchid-400 px-3 text-xs font-extrabold text-acai-950 transition hover:bg-orchid-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              ✓ Visto
            </button>
          </m.div>
        )}
      </AnimatePresence>
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
              {elapsed && (
                <span
                  data-order-elapsed=""
                  data-late={late ? '' : undefined}
                  className={`nums ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-extrabold ring-1 ${late ? 'bg-red-50 text-red-800 ring-red-300' : 'bg-acai-50 text-acai-800 ring-line'}`}
                >
                  {late ? `⚠️ ${elapsed} · atrasado` : elapsed}
                </span>
              )}
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
        <ComandaItems comanda={order.message} fallback={order.items} />
      </section>

      {order.additions.map((addition, index) => (
        <section
          key={index}
          data-order-addition=""
          aria-label={'Itens adicionados pelo cliente às ' + whenText(addition.createdAt, now)}
          className="rounded-xl bg-orchid-100 p-3 ring-2 ring-orchid-400"
        >
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm font-extrabold text-acai-950">
            <span>➕ Novos itens adicionados pelo cliente</span>
            <span data-addition-time="" className="nums font-bold text-acai-800">
              {whenText(addition.createdAt, now)}
            </span>
          </p>
          <div className="mt-2">
            <ComandaItems comanda={addition.itemsBlock} fallback={addition.items} />
          </div>
          <p data-addition-total="" className="nums mt-2 text-right text-sm font-extrabold text-acai-800">
            + {formatBRL(addition.subtotalCents)}
          </p>
        </section>
      ))}

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

      {(!finished || whatsapp || back) && (
        <footer className="flex flex-col gap-2 border-t border-line pt-3">
          {next && !asking && (
            <button
              type="button"
              data-order-next={next.status}
              disabled={busy}
              aria-busy={busy || undefined}
              aria-label={`${next.label} — pedido ${order.code}`}
              onClick={() => (next.status === 'concluido' ? setConfirmingConclude(true) : onStatus(next.status))}
              className={`${actionButton} btn-primary`}
            >
              {busy ? 'Salvando…' : next.label}
            </button>
          )}
          {next?.status === 'concluido' && confirmingConclude && (
            <div role="group" data-order-conclude-ask="" aria-label={`Concluir o pedido ${order.code}`} className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
              <p className="text-sm font-bold text-emerald-950">Deseja realmente concluir este pedido?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  data-order-conclude-cancel=""
                  onClick={() => setConfirmingConclude(false)}
                  className={`${actionButton} flex-1 bg-white text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  data-order-conclude-confirm=""
                  disabled={busy}
                  onClick={() => {
                    setConfirmingConclude(false)
                    onStatus('concluido')
                  }}
                  className={`${actionButton} flex-1 bg-emerald-700 text-white hover:bg-emerald-800`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
          {whatsapp && !asking && (
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
          {back && !asking && onBack && (
            <button
              type="button"
              data-order-back={back.status}
              disabled={busy}
              aria-label={`↩ Voltar etapa para ${back.label} — pedido ${order.code}`}
              onClick={() => onBack(back.status)}
              className={`${actionButton} min-h-11 bg-white font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100`}
            >
              ↩ Voltar etapa <span className="font-semibold text-ink-soft">({back.label})</span>
            </button>
          )}
          {canCancel(order) &&
            !confirmingConclude &&
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
      {flash && (
        <p role="status" data-order-flash="" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-900 ring-1 ring-emerald-200">
          {flash}
        </p>
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
