import { AnimatePresence, m } from 'motion/react'
import { type ComponentType, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Banknote, Chat, Check, Copy, CreditCard, QrCode, Scooter, Storefront } from '../../components/ui/icons.tsx'
import { storeInfo } from '../../services/storeInfo.ts'
import { formatBRL } from '../../utils/money.ts'
import { type Cart, cartItemProblem, cartTotalCents, serializeCart } from '../cart/cart.ts'
import { cartActions } from '../cart/cartStore.ts'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import { orderWhatsAppUrl } from '../orders/orderService.ts'
import { StoreClosedCard } from '../store-hours/StoreClosedCard.tsx'
import { serverNow } from '../store-hours/serverClock.ts'
import { useStoreStatus } from '../store-hours/useStoreStatus.ts'
import { storeAddressText } from '../store/storeSettings.ts'
import { copyText } from './copyText.ts'
import {
  type CustomerDraft,
  type CustomerField,
  EMPTY_CUSTOMER,
  OTHER_ZONE,
  checkCustomer,
  feeCents,
  feeFor,
  parseCustomerDraft,
  zoneList,
} from './delivery.ts'
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

/** Dados do cliente guardados na aba (some ao fechar a aba). */
const CUSTOMER_KEY = 'acai_doce_sabor_checkout_v1'

function loadCustomer(): CustomerDraft {
  try {
    return parseCustomerDraft(JSON.parse(globalThis.sessionStorage?.getItem(CUSTOMER_KEY) ?? 'null'))
  } catch {
    return EMPTY_CUSTOMER
  }
}

const sectionTitle = 'font-display text-lg font-extrabold tracking-tight text-acai-800 uppercase'
const inputClass =
  'min-h-12 w-full rounded-xl bg-white px-3 text-base text-acai-950 ring-1 outline-none placeholder:text-ink-soft focus:ring-2 aria-invalid:ring-2 aria-invalid:ring-red-700'

/** Ordem em que os campos com problema recebem o foco ao tentar enviar. */
const FIELD_ORDER: readonly CustomerField[] = ['name', 'phone', 'kind', 'street', 'number', 'zone', 'district']

/**
 * Finalização no carrinho (pedido de 2026-11-17): o total com o frete, os dados do cliente,
 * entrega ou retirada, a forma de pagamento e o botão que abre o WhatsApp da loja com a comanda.
 * A tela nunca diz que o pedido foi enviado: o WhatsApp abre com a mensagem pronta e quem toca em
 * Enviar é o cliente. Com a loja fechada, o pedido vai como antecipado ou o envio fica bloqueado,
 * como o vendedor escolheu; com item esgotado no carrinho, o envio espera o cliente tirar.
 */
export function CheckoutPanel({ cart, onCleared }: { cart: Cart; onCleared: () => void }) {
  const settings = useStoreSettings()
  const status = useStoreStatus()
  const uid = useId()
  const [customer, setCustomer] = useState<CustomerDraft>(loadCustomer)
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY_PAYMENT)
  // Os avisos de "falta escolher" só aparecem depois da primeira tentativa de envio.
  const [attempted, setAttempted] = useState(false)
  // Pedido aberto por último. O aviso de "WhatsApp aberto" some se o pedido mudar depois.
  const [opened, setOpened] = useState<{ key: string; url: string } | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const methods = useRef<HTMLFieldSetElement>(null)
  const changeField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      globalThis.sessionStorage?.setItem(CUSTOMER_KEY, JSON.stringify(customer))
    } catch {
      // Sem armazenamento: os dados ficam só nesta tela.
    }
  }, [customer])

  const subtotalCents = cartTotalCents(cart)
  const fee = feeFor(customer, settings.delivery)
  const totalCents = subtotalCents + (fee ? feeCents(fee) : 0)
  const feePending = fee?.kind === 'combinar'
  const customerCheck = checkCustomer(customer, settings.delivery)
  const paymentCheck = checkPayment(draft, totalCents)
  const stockProblem = cart.items.some((item) => cartItemProblem(item) !== null)
  const closedBlocked = !status.open && settings.closedOrders === 'bloquear'
  const antecipado = !status.open && settings.closedOrders === 'antecipado'

  const customerProblems = attempted && !customerCheck.ok ? customerCheck.problems : {}
  const paymentProblem = attempted && !paymentCheck.ok ? paymentCheck.problem : null
  const changeProblem = liveChangeProblem(draft, totalCents) ?? (paymentProblem && paymentProblem !== 'no-method' ? paymentProblem : null)
  const changeDue = feePending ? null : changeDueCents(draft, totalCents)
  const orderKey = JSON.stringify([serializeCart(cart), customerCheck, paymentCheck, antecipado])
  const openedNow = opened !== null && opened.key === orderKey

  const updateCustomer = (patch: Partial<CustomerDraft>) => setCustomer((current) => ({ ...current, ...patch }))
  const updatePayment = (patch: Partial<PaymentDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const field = (name: CustomerField | 'reference') => `${uid}-${name}`
  const problemProps = (name: CustomerField) =>
    customerProblems[name] ? { 'aria-invalid': true as const, 'aria-describedby': `${field(name)}-erro` } : {}

  const send = () => {
    setAttempted(true)
    if (closedBlocked) return
    if (stockProblem) {
      document.querySelector<HTMLElement>('[data-cart-problem] a, [data-cart-problem] button')?.focus()
      return
    }
    if (!customerCheck.ok) {
      const first = FIELD_ORDER.find((name) => customerCheck.problems[name])
      panel.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return
    }
    if (!paymentCheck.ok) {
      if (paymentCheck.problem === 'no-method') methods.current?.querySelector('input')?.focus()
      else changeField.current?.focus()
      return
    }
    const url = orderWhatsAppUrl({
      cart,
      customer: customerCheck.customer,
      payment: paymentCheck.payment,
      sentAt: serverNow(),
      antecipado,
    })
    const tab = window.open(url, '_blank')
    if (tab) tab.opener = null
    else window.location.assign(url)
    setOpened({ key: orderKey, url })
  }

  const zones = zoneList(settings.delivery)
  const zoneValue = customer.zoneId === OTHER_ZONE || zones.some((zone) => zone.id === customer.zoneId) ? (customer.zoneId ?? '') : ''
  const typedDistrict = zones.length === 0 || customer.zoneId === OTHER_ZONE
  const deliveryHint =
    settings.delivery.mode === 'gratis' ? 'Grátis' : settings.delivery.mode === 'taxas' && zones.length > 0 ? 'Taxa por bairro' : 'Taxa a combinar'

  return (
    <div ref={panel} className="flex flex-col gap-5">
      <dl data-order-values="" className="flex flex-col gap-1.5">
        <ValueRow label="Subtotal" value={formatBRL(subtotalCents)} />
        <ValueRow
          label={customer.kind === 'retirada' ? 'Retirada na loja' : fee?.kind === 'taxa' ? `Entrega (${fee.zoneName})` : 'Entrega'}
          value={
            !fee
              ? customer.kind === 'entrega'
                ? 'escolha o bairro'
                : 'escolha abaixo'
              : fee.kind === 'combinar'
                ? 'A combinar'
                : feeCents(fee) === 0
                  ? 'Grátis (R$ 0,00)'
                  : formatBRL(feeCents(fee))
          }
        />
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-2">
          <dt className="font-display text-lg font-extrabold text-acai-800 uppercase">Total</dt>
          <dd className="nums text-right text-3xl font-extrabold whitespace-nowrap text-acai-800">
            {formatBRL(totalCents)}
            {feePending && <span className="block text-xs font-semibold whitespace-normal text-ink-soft">+ entrega a combinar</span>}
          </dd>
        </div>
      </dl>

      <StoreClosedCard heading="h3" compact />

      <fieldset className="flex flex-col gap-3">
        <legend className={sectionTitle}>Seus dados</legend>
        <Field id={field('name')} label="Nome" problem={customerProblems.name}>
          <input
            id={field('name')}
            data-field="name"
            type="text"
            autoComplete="name"
            maxLength={60}
            value={customer.name}
            onChange={(event) => updateCustomer({ name: event.target.value })}
            className={`${inputClass} ring-line focus:ring-acai-700`}
            {...problemProps('name')}
          />
        </Field>
        <Field id={field('phone')} label="Telefone (opcional)" problem={customerProblems.phone}>
          <input
            id={field('phone')}
            data-field="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="(83) 99999-0000"
            value={customer.phone}
            onChange={(event) => updateCustomer({ phone: event.target.value })}
            className={`${inputClass} ring-line focus:ring-acai-700`}
            {...problemProps('phone')}
          />
        </Field>
      </fieldset>

      <fieldset
        aria-describedby={customerProblems.kind ? `${field('kind')}-erro` : undefined}
        className={`rounded-2xl transition ${customerProblems.kind ? 'bg-red-50 p-3 ring-2 ring-red-700' : ''}`}
      >
        <legend className={sectionTitle}>Como você quer receber?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <ChoiceCard
            name={`${uid}-receber`}
            value="entrega"
            dataField="kind"
            checked={customer.kind === 'entrega'}
            onChange={() => updateCustomer({ kind: 'entrega' })}
            icon={<Scooter className="size-6 text-acai-700" />}
            label="Entrega"
            hint={deliveryHint}
          />
          <ChoiceCard
            name={`${uid}-receber`}
            value="retirada"
            checked={customer.kind === 'retirada'}
            onChange={() => updateCustomer({ kind: 'retirada' })}
            icon={<Storefront className="size-6 text-acai-700" />}
            label="Retirar na loja"
            hint="Grátis"
          />
        </div>
        {customerProblems.kind && (
          <p id={`${field('kind')}-erro`} role="alert" className="mt-3 text-sm font-bold text-red-800">
            {customerProblems.kind}
          </p>
        )}
      </fieldset>

      <AnimatePresence initial={false} mode="wait">
        {customer.kind === 'entrega' && (
          <m.div key="entrega" {...reveal} className="flex flex-col gap-3 rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
            <p className="font-bold text-acai-950">Endereço de entrega</p>
            <Field id={field('street')} label="Rua" problem={customerProblems.street}>
              <input
                id={field('street')}
                data-field="street"
                type="text"
                autoComplete="address-line1"
                maxLength={80}
                value={customer.street}
                onChange={(event) => updateCustomer({ street: event.target.value })}
                className={`${inputClass} ring-line focus:ring-acai-700`}
                {...problemProps('street')}
              />
            </Field>
            <Field id={field('number')} label="Número" problem={customerProblems.number}>
              <input
                id={field('number')}
                data-field="number"
                type="text"
                inputMode="text"
                autoComplete="address-line2"
                maxLength={12}
                placeholder="Ex.: 12 ou s/n"
                value={customer.number}
                onChange={(event) => updateCustomer({ number: event.target.value })}
                className={`${inputClass} ring-line focus:ring-acai-700`}
                {...problemProps('number')}
              />
            </Field>
            {zones.length > 0 && (
              <Field id={field('zone')} label="Bairro" problem={customerProblems.zone}>
                <select
                  id={field('zone')}
                  data-field="zone"
                  value={zoneValue}
                  onChange={(event) => updateCustomer({ zoneId: event.target.value || null })}
                  className={`${inputClass} cursor-pointer ring-line focus:ring-acai-700`}
                  {...problemProps('zone')}
                >
                  <option value="">Escolha o bairro</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {zone.feeCents > 0 ? formatBRL(zone.feeCents) : 'Grátis'}
                    </option>
                  ))}
                  <option value={OTHER_ZONE}>Outro bairro (taxa a combinar)</option>
                </select>
              </Field>
            )}
            {typedDistrict && (
              <Field id={field('district')} label={zones.length > 0 ? 'Qual bairro?' : 'Bairro'} problem={customerProblems.district}>
                <input
                  id={field('district')}
                  data-field="district"
                  type="text"
                  maxLength={60}
                  value={customer.district}
                  onChange={(event) => updateCustomer({ district: event.target.value })}
                  className={`${inputClass} ring-line focus:ring-acai-700`}
                  {...problemProps('district')}
                />
              </Field>
            )}
            <Field id={field('reference')} label="Ponto de referência (opcional)">
              <input
                id={field('reference')}
                type="text"
                maxLength={100}
                placeholder="Ex.: perto da praça"
                value={customer.reference}
                onChange={(event) => updateCustomer({ reference: event.target.value })}
                className={`${inputClass} ring-line focus:ring-acai-700`}
              />
            </Field>
          </m.div>
        )}
        {customer.kind === 'retirada' && (
          <m.p key="retirada" {...reveal} className="rounded-2xl bg-acai-50 p-4 text-sm leading-relaxed text-acai-950 ring-1 ring-line">
            Retire no balcão: <strong className="font-bold">{storeAddressText(settings.contact)}</strong>. Grátis (R$ 0,00).
          </m.p>
        )}
      </AnimatePresence>

      <fieldset
        ref={methods}
        aria-describedby={paymentProblem === 'no-method' ? 'pagamento-erro' : undefined}
        className={`rounded-2xl transition ${paymentProblem === 'no-method' ? 'bg-red-50 p-3 ring-2 ring-red-700' : ''}`}
      >
        <legend className={sectionTitle}>Forma de pagamento</legend>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {PAYMENT_METHODS.map(({ id, label }) => {
            const Icon = METHOD_ICONS[id]
            return (
              <ChoiceCard
                key={id}
                name="forma-de-pagamento"
                value={id}
                checked={draft.method === id}
                onChange={() => updatePayment({ method: id })}
                icon={<Icon className="size-6 text-acai-700" />}
                label={label}
              />
            )
          })}
        </div>
        {paymentProblem === 'no-method' && (
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
                onChange={(event) => updatePayment({ changeFor: event.target.value })}
                onBlur={() => {
                  const cents = parseReais(draft.changeFor)
                  if (cents !== null) updatePayment({ changeFor: reaisText(cents) })
                }}
                className="nums min-h-12 w-full min-w-0 bg-transparent px-2 text-lg font-bold text-acai-950 outline-none placeholder:font-normal placeholder:text-ink-soft disabled:cursor-not-allowed"
              />
            </div>

            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-acai-950">
              <input
                type="checkbox"
                checked={draft.exact}
                onChange={(event) => updatePayment({ exact: event.target.checked })}
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
            {feePending && !draft.exact && (
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">O troco é conferido na conversa, junto com a taxa de entrega.</p>
            )}
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
        {stockProblem && (
          <p role={attempted ? 'alert' : undefined} className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
            Tem item esgotado no carrinho: remova ou edite o item marcado para enviar o pedido.
          </p>
        )}
        {closedBlocked && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
            A loja está fechada e não está recebendo pedidos agora. Volte {status.reopenText}.
          </p>
        )}
        {antecipado && (
          <p className="mb-3 rounded-xl bg-gold-100 px-3 py-2.5 text-sm font-semibold text-acai-950 ring-1 ring-gold-400">
            A loja está fechada agora: o pedido vai como <strong className="font-bold">pedido antecipado</strong> e é preparado quando
            abrirmos ({status.reopenText}).
          </p>
        )}
        <button
          type="button"
          onClick={send}
          disabled={closedBlocked}
          className="btn-gold inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2 text-base leading-tight font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          <Chat className="size-5" />
          {closedBlocked ? 'Loja fechada: envio bloqueado' : 'Confirmar e Enviar Pedido no WhatsApp'}
        </button>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Abre o WhatsApp da loja com o pedido escrito. Ele só chega à loja quando você tocar em Enviar.
        </p>

        <div role="status">
          {openedNow && opened && (
            <div className="mt-4 rounded-2xl bg-acai-50 p-4 text-sm text-acai-950 ring-1 ring-line">
              <p className="font-bold">Abrimos o WhatsApp com o seu pedido.</p>
              <p className="mt-1 leading-relaxed">
                Confira a mensagem e toque em Enviar para a loja receber.{' '}
                <a
                  href={opened.url}
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

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="min-w-0 font-semibold text-acai-950">{label}</dt>
      <dd className="nums shrink-0 font-bold whitespace-nowrap text-acai-950">{value}</dd>
    </div>
  )
}

function Field({ id, label, problem, children }: { id: string; label: string; problem?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-acai-950">
        {label}
      </label>
      {children}
      {problem && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-bold text-red-800">
          {problem}
        </p>
      )}
    </div>
  )
}

/** Cartão de escolha (entrega/retirada, forma de pagamento): o rádio fica escondido e o cartão marca. */
function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  icon,
  label,
  hint,
  dataField,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  icon: ReactNode
  label: string
  hint?: string
  dataField?: string
}) {
  return (
    <label
      className={`relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center text-sm leading-tight font-bold text-acai-950 transition duration-200 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800 ${
        checked ? 'border-gold-400 bg-gold-100' : 'border-line bg-white hover:border-acai-600/40'
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} data-field={dataField} className="sr-only" />
      {icon}
      {label}
      {hint && <span className="text-xs font-semibold text-ink-soft">{hint}</span>}
      <m.span
        aria-hidden="true"
        initial={false}
        animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 28 }}
        className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-acai-800 text-gold-400 shadow-sm"
      >
        <Check className="size-4" />
      </m.span>
    </label>
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
