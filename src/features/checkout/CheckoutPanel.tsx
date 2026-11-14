import { AnimatePresence, m } from 'motion/react'
import { type ComponentType, useEffect, useRef, useState } from 'react'
import { Banknote, Chat, Check, Copy, CreditCard, QrCode } from '../../components/ui/icons.tsx'
import { storeInfo } from '../../services/storeInfo.ts'
import { formatBRL } from '../../utils/money.ts'
import { type Cart, cartTotalCents } from '../cart/cart.ts'
import { cartActions } from '../cart/cartStore.ts'
import { orderWhatsAppUrl } from '../orders/orderService.ts'
import { copyText } from './copyText.ts'
import {
  EMPTY_PAYMENT,
  PAYMENT_METHODS,
  type PaymentDraft,
  type PaymentMethod,
  changeDueCents,
  checkPayment,
  liveChangeProblem,
  parseReais,
  paymentProblemText,
  reaisText,
} from './payment.ts'

const METHOD_ICONS: Record<PaymentMethod, ComponentType<{ className?: string }>> = {
  pix: QrCode,
  credito: CreditCard,
  debito: CreditCard,
  dinheiro: Banknote,
}

const reveal = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2 },
} as const

/**
 * Finalização no carrinho: forma de pagamento (Pix, crédito, débito ou dinheiro com troco) e o
 * botão que abre o WhatsApp da loja com o pedido escrito. A tela nunca diz que o pedido foi
 * enviado: o WhatsApp abre com a mensagem pronta e quem toca em Enviar é o cliente.
 */
export function CheckoutPanel({ cart, onCleared }: { cart: Cart; onCleared: () => void }) {
  const totalCents = cartTotalCents(cart)
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY_PAYMENT)
  // Os avisos de "falta escolher" só aparecem depois da primeira tentativa de envio.
  const [attempted, setAttempted] = useState(false)
  // Link aberto por último. O aviso de "WhatsApp aberto" some se o pedido mudar depois.
  const [openedUrl, setOpenedUrl] = useState<string | null>(null)
  const methods = useRef<HTMLFieldSetElement>(null)
  const changeField = useRef<HTMLInputElement>(null)

  const check = checkPayment(draft, totalCents)
  const currentUrl = check.ok ? orderWhatsAppUrl(cart, check.payment) : null
  const problem = attempted && !check.ok ? check.problem : null
  const changeProblem = liveChangeProblem(draft, totalCents) ?? (problem && problem !== 'no-method' ? problem : null)
  const changeDue = changeDueCents(draft, totalCents)
  const opened = openedUrl !== null && openedUrl === currentUrl

  const update = (patch: Partial<PaymentDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const send = () => {
    setAttempted(true)
    if (!check.ok) {
      if (check.problem === 'no-method') methods.current?.querySelector('input')?.focus()
      else changeField.current?.focus()
      return
    }
    const url = orderWhatsAppUrl(cart, check.payment)
    const tab = window.open(url, '_blank')
    if (tab) tab.opener = null
    else window.location.assign(url)
    setOpenedUrl(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset
        ref={methods}
        aria-describedby={problem === 'no-method' ? 'pagamento-erro' : undefined}
        className={`rounded-2xl transition ${problem === 'no-method' ? 'bg-red-50 p-3 ring-2 ring-red-700' : ''}`}
      >
        <legend className="font-display text-lg font-extrabold tracking-tight text-acai-800 uppercase">Forma de pagamento</legend>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {PAYMENT_METHODS.map(({ id, label }) => {
            const Icon = METHOD_ICONS[id]
            const selected = draft.method === id
            return (
              <label
                key={id}
                className={`relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-sm leading-tight font-bold text-acai-950 transition duration-200 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800 ${
                  selected ? 'border-gold-400 bg-gold-100' : 'border-line bg-white hover:border-acai-600/40'
                }`}
              >
                <input
                  type="radio"
                  name="forma-de-pagamento"
                  value={id}
                  checked={selected}
                  onChange={() => update({ method: id })}
                  className="sr-only"
                />
                <Icon className="size-6 text-acai-700" />
                {label}
                <m.span
                  aria-hidden="true"
                  initial={false}
                  animate={{ scale: selected ? 1 : 0.4, opacity: selected ? 1 : 0 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 28 }}
                  className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-acai-800 text-gold-400 shadow-sm"
                >
                  <Check className="size-4" />
                </m.span>
              </label>
            )
          })}
        </div>
        {problem === 'no-method' && (
          <p id="pagamento-erro" role="alert" className="mt-3 text-sm font-bold text-red-800">
            {paymentProblemText('no-method', totalCents)}
          </p>
        )}
      </fieldset>

      <AnimatePresence initial={false} mode="wait">
        {draft.method === 'dinheiro' && (
          <m.div key="dinheiro" {...reveal} className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
            <label htmlFor="troco-para" className="font-bold text-acai-950">
              Troco para quanto?
            </label>
            <div
              className={`mt-2 flex items-center rounded-xl bg-white ring-1 focus-within:ring-2 ${
                changeProblem ? 'ring-red-700 focus-within:ring-red-700' : 'ring-line focus-within:ring-acai-700'
              } ${draft.exact ? 'opacity-55' : ''}`}
            >
              <span aria-hidden="true" className="pl-3 font-bold text-ink-soft">
                R$
              </span>
              <input
                ref={changeField}
                id="troco-para"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex: 50,00"
                value={draft.changeFor}
                disabled={draft.exact}
                aria-invalid={changeProblem ? true : undefined}
                aria-describedby={changeProblem ? 'troco-erro' : undefined}
                onChange={(event) => update({ changeFor: event.target.value })}
                onBlur={() => {
                  const cents = parseReais(draft.changeFor)
                  if (cents !== null) update({ changeFor: reaisText(cents) })
                }}
                className="nums min-h-12 w-full min-w-0 bg-transparent px-2 text-lg font-bold text-acai-950 outline-none placeholder:font-normal placeholder:text-ink-soft disabled:cursor-not-allowed"
              />
            </div>

            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-acai-950">
              <input
                type="checkbox"
                checked={draft.exact}
                onChange={(event) => update({ exact: event.target.checked })}
                className="size-5 shrink-0 cursor-pointer accent-acai-800"
              />
              Não preciso de troco (valor exato)
            </label>

            <p aria-live="polite">
              {changeDue !== null && (
                <span className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-gold-100 px-3 py-2.5 text-acai-950 ring-1 ring-gold-400">
                  <span className="font-bold">Troco a levar:</span>
                  <strong className="nums text-xl font-extrabold whitespace-nowrap">{formatBRL(changeDue)}</strong>
                </span>
              )}
            </p>
            {changeProblem && (
              <p id="troco-erro" role="alert" className="mt-3 text-sm font-bold text-red-800">
                {paymentProblemText(changeProblem, totalCents)}
              </p>
            )}
          </m.div>
        )}
        {draft.method === 'pix' && (
          <m.div key="pix" {...reveal}>
            <PixCard />
          </m.div>
        )}
      </AnimatePresence>

      <div>
        <button
          type="button"
          onClick={send}
          className="btn-gold inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2 text-base leading-tight font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800"
        >
          <Chat className="size-5" />
          Confirmar e Enviar Pedido no WhatsApp
        </button>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Abre o WhatsApp da loja com o pedido escrito. Ele só chega à loja quando você tocar em Enviar.
        </p>

        <div role="status">
          {opened && currentUrl && (
            <div className="mt-4 rounded-2xl bg-acai-50 p-4 text-sm text-acai-950 ring-1 ring-line">
              <p className="font-bold">Abrimos o WhatsApp com o seu pedido.</p>
              <p className="mt-1 leading-relaxed">
                Confira a mensagem e toque em Enviar para a loja receber.{' '}
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-acai-700 underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
                >
                  Não abriu? Abrir o WhatsApp
                </a>
              </p>
              <button
                type="button"
                onClick={() => {
                  cartActions.clear()
                  onCleared()
                }}
                className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                Já enviei, esvaziar o carrinho
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Chave Pix da loja, com o botão de copiar. */
function PixCard() {
  const { key, type, holder } = storeInfo.pix
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    const copied = await copyText(key)
    setState(copied ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    if (copied) timer.current = window.setTimeout(() => setState('idle'), 2500)
  }

  return (
    <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Chave Pix ({type})</p>
      <p className="nums mt-1 text-2xl font-extrabold tracking-tight break-all text-acai-800 select-all">{key}</p>
      <p className="mt-0.5 text-sm text-ink-soft">Titular: {holder}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-acai-800 px-4 text-sm font-bold text-white transition hover:bg-acai-700 active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
      >
        {state === 'copied' ? <Check className="size-5 text-gold-400" /> : <Copy className="size-5" />}
        {state === 'copied' ? 'Chave Pix copiada!' : 'Copiar chave Pix'}
      </button>
      <p role="status" className="text-sm font-semibold text-acai-950">
        {state === 'copied' && <span className="sr-only">Chave Pix copiada.</span>}
        {state === 'failed' && (
          <span className="mt-2 block">Não deu para copiar aqui. Toque e segure a chave acima para copiar.</span>
        )}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-acai-950">
        Realize o Pix e envie o comprovante junto com o seu pedido no WhatsApp.
      </p>
    </div>
  )
}
