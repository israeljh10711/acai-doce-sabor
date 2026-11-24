import { AnimatePresence, m } from 'motion/react'
import { type ComponentType, type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Bag, Banknote, Check, CreditCard, IceCreamBowl, QrCode, Scooter } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import { type CustomerAddress, loadCustomerAddress, saveCustomerAddress } from '../../services/customerHistory.ts'
import { formatBRL } from '../../utils/money.ts'
import { formatBrazilPhone } from '../../utils/whatsapp.ts'
import { type Cart, cartItemProblem, cartTotalCents, serializeCart } from '../cart/cart.ts'
import { cartActions } from '../cart/cartStore.ts'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import { browserDemoDeps, saveDemoOrder } from '../orders/localOrdersSource.ts'
import type { OrderDraft } from '../orders/orderMessage.ts'
import { type SubmitResult, submitOrder } from '../orders/orderService.ts'
import { refreshCatalogNow, supabaseConfig } from '../seller/sellerBackend.ts'
import type { TrackState } from '../tracking/trackState.ts'
import { getAttempts, getCustomerLive, getCustomerSession, getTrackedOrders, useCustomerAccount } from '../tracking/trackingRuntime.ts'
import { StoreClosedCard } from '../store-hours/StoreClosedCard.tsx'
import { serverNow } from '../store-hours/serverClock.ts'
import { useStoreStatus } from '../store-hours/useStoreStatus.ts'
import { type StoreContact, mapsUrl, storeAddressText, storePlaceText } from '../store/storeSettings.ts'
import { GpsLocation } from './GpsLocation.tsx'
import { PixCard } from './PixCard.tsx'
import {
  COMBINAR_PHONE_TEXT,
  type CustomerDraft,
  type CustomerField,
  EMPTY_CUSTOMER,
  OTHER_ZONE,
  addressPatch,
  checkCustomer,
  draftForStorage,
  feeCents,
  feeFor,
  parseCustomerDraft,
  zoneList,
} from './delivery.ts'
import type { AddressGuess } from './gps.ts'
import { forgetRemembered, initialCustomer, loadRemembered, saveRemembered } from './rememberedCustomer.ts'
import {
  EMPTY_PAYMENT,
  PAYMENT_METHODS,
  allowedMethods,
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

/** Dados do cliente guardados na aba (some ao fechar a aba). O GPS nunca fica guardado. */
const CUSTOMER_KEY = 'acai_doce_sabor_checkout_v1'

/** O `localStorage` do aparelho, ou `null` quando o navegador não deixa usar. */
function deviceStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function loadCustomer(): CustomerDraft {
  try {
    return draftForStorage(parseCustomerDraft(JSON.parse(globalThis.sessionStorage?.getItem(CUSTOMER_KEY) ?? 'null')))
  } catch {
    return EMPTY_CUSTOMER
  }
}

/** O que o cliente lê quando o servidor recusa o pedido (pedido de 2026-11-17). */
function rejectionText(result: Extract<SubmitResult, { kind: 'rejected' }>): string {
  switch (result.reason) {
    case 'total-mudou':
      return `Os preços mudaram: o total agora é ${formatBRL(result.totalCents ?? 0)}. Confira o carrinho e finalize de novo.`
    case 'esgotado':
      return `Esgotou: ${result.detail ?? 'um item do carrinho'}. Remova ou edite o item marcado para finalizar.`
    case 'loja-fechada':
      return `A loja fechou e não está recebendo pedidos agora${result.detail ? `. Volte ${result.detail}` : ''}.`
    case 'item-indisponivel':
      // Com o nome (2026-11-21): a escolha do item mudou no cardápio (ex.: o máximo de um grupo).
      return result.detail
        ? `O item "${result.detail}" mudou no cardápio. Confira as escolhas dele no carrinho e finalize de novo.`
        : 'Um item do carrinho não está mais no cardápio. Remova o item marcado e finalize de novo.'
    case 'dados-invalidos':
      return `Confira seus dados: ${result.detail ?? ''}`
    case 'sem-sessao':
      return 'Sua sessão expirou. Entre na conta novamente para finalizar o pedido.'
    case 'pagamento-invalido':
      return `Confira o pagamento: ${result.detail ?? ''}`
    default:
      return 'Não foi possível confirmar o pedido.'
  }
}

/**
 * A finalização (pedido 100% no site, 2026-11-20): o resultado vale enquanto o pedido não muda.
 * Confirmado, o site vai direto para o acompanhamento (não há estado "enviado" nesta tela).
 */
type Finalize = { key: string; state: 'sending' } | { key: string; state: 'rejected'; text: string } | { key: string; state: 'failed'; text: string }

/** Um pedido confirmado: guardado neste aparelho para o acompanhamento. */
type Placed = { id: string; code: string; createdAt: string; demo: boolean; tracked: boolean }

const sectionTitle = 'font-display text-lg font-extrabold tracking-tight text-acai-800 uppercase'
const inputClass =
  'min-h-12 w-full rounded-xl bg-white px-3 text-base text-acai-950 ring-1 outline-none placeholder:text-ink-soft focus:ring-2 aria-invalid:ring-2 aria-invalid:ring-red-700'

/** Ordem em que os campos com problema recebem o foco ao tentar enviar. */
const FIELD_ORDER: readonly CustomerField[] = ['name', 'phone', 'kind', 'street', 'number', 'zone', 'district']

/**
 * Finalização no carrinho: o total com o frete, os dados do cliente, a modalidade, a forma de
 * pagamento e "Finalizar pedido". Desde o pedido 100% no site (2026-11-20), não há WhatsApp: o
 * pedido vai para a loja pelo site, e só com a confirmação do servidor (ou, na demonstração, do
 * armazenamento deste navegador) o cliente vai para o acompanhamento com "Pedido recebido". Uma
 * falha nunca vira confirmação: o cliente vê o aviso e tenta de novo com a mesma tentativa (o
 * servidor não grava duas vezes). Com a loja fechada, o pedido vai como antecipado ou fica
 * bloqueado, como o vendedor escolheu; com item esgotado no carrinho, espera o cliente tirar.
 */
export function CheckoutPanel({ cart }: { cart: Cart }) {
  const account = useCustomerAccount()
  return <CheckoutForm key={account ? `conta-${account}` : 'visitante'} account={account} cart={cart} />
}

function CheckoutForm({ cart, account }: { cart: Cart; account: string | null }) {
  const settings = useStoreSettings()
  const status = useStoreStatus()
  const uid = useId()
  const navigate = useNavigate()
  // "Lembrar meus dados" (2026-11-21): marcada quando já há dados lembrados neste aparelho.
  const [remember, setRemember] = useState(() => loadRemembered(deviceStorage()) !== null)
  const [customer, setCustomer] = useState<CustomerDraft>(() => account
    ? { ...EMPTY_CUSTOMER, phone: /^[+\d(]/.test(account) ? formatBrazilPhone(account) ?? '' : '' }
    : initialCustomer(loadCustomer(), loadRemembered(deviceStorage())))
  const [addressMessage, setAddressMessage] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const addressEdited = useRef(false)
  useEffect(() => {
    if (!account) return
    let current = true
    loadCustomerAddress().then(address => {
      if (!current || !address || addressEdited.current) return
      const available = zoneList(settings.delivery)
      const zone = available.find(entry => entry.id === address.zoneId)
        ?? available.find(entry => entry.name.localeCompare(address.district, 'pt-BR', { sensitivity: 'base' }) === 0)
      setCustomer(value => ({ ...value, ...address, zoneId: zone?.id ?? (available.length ? OTHER_ZONE : null) }))
      setAddressMessage('Endereço preenchido com os dados da sua conta.')
    }, () => {
      if (current && !addressEdited.current) setAddressMessage('Não conseguimos carregar seu endereço. Você pode digitá-lo abaixo.')
    })
    return () => { current = false }
  }, [account, settings.delivery])
  const [draft, setDraft] = useState<PaymentDraft>(EMPTY_PAYMENT)
  // Os avisos de "falta escolher" só aparecem depois da primeira tentativa de envio.
  const [attempted, setAttempted] = useState(false)
  const [finalize, setFinalize] = useState<Finalize | null>(null)
  // Dois toques seguidos não mandam duas vezes (o estado só muda no desenho seguinte).
  const submitting = useRef(false)
  // Confirmado, o botão não volta a valer (a tela já está indo para o acompanhamento): um segundo
  // toque no mesmo instante seria outra tentativa e outro pedido.
  const confirmed = useRef(false)
  const functionConfig = supabaseConfig()
  const panel = useRef<HTMLDivElement>(null)
  const methods = useRef<HTMLFieldSetElement>(null)
  const changeField = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (account) return
    try {
      globalThis.sessionStorage?.setItem(CUSTOMER_KEY, JSON.stringify(draftForStorage(customer)))
    } catch {
      // Sem armazenamento: os dados ficam só nesta tela.
    }
  }, [account, customer])

  // Marcada: guarda e atualiza a cada mudança. Desmarcada: apaga o que estava lembrado.
  useEffect(() => {
    if (account) return
    if (remember) saveRemembered(deviceStorage(), customer)
    else forgetRemembered(deviceStorage())
  }, [account, remember, customer])

  const subtotalCents = cartTotalCents(cart)
  const fee = feeFor(customer, settings.delivery)
  const totalCents = subtotalCents + (fee ? feeCents(fee) : 0)
  const feePending = fee?.kind === 'combinar'
  const customerCheck = checkCustomer(customer, settings.delivery)
  // Forma que a loja desligou depois de escolhida (2026-11-21) conta como não escolhida.
  const allowed = allowedMethods(settings.payments, settings.pix.enabled)
  const paymentCheck = checkPayment(draft.method && !allowed.includes(draft.method) ? { ...draft, method: null } : draft, totalCents)
  const stockProblem = cart.items.some((item) => cartItemProblem(item) !== null)
  const closedBlocked = !status.open && settings.closedOrders === 'bloquear'
  const antecipado = !status.open && settings.closedOrders === 'antecipado'

  const customerProblems = attempted && !customerCheck.ok ? customerCheck.problems : {}
  const paymentProblem = attempted && !paymentCheck.ok ? paymentCheck.problem : null
  const changeProblem = liveChangeProblem(draft, totalCents) ?? (paymentProblem && paymentProblem !== 'no-method' ? paymentProblem : null)
  const changeDue = feePending ? null : changeDueCents(draft, totalCents)
  const orderParts = [serializeCart(cart), customerCheck, paymentCheck, antecipado]
  const orderKey = JSON.stringify(account ? [account, ...orderParts] : orderParts)
  const outcome = finalize && finalize.key === orderKey ? finalize : null
  const sending = finalize?.state === 'sending'

  const updateCustomer = (patch: Partial<CustomerDraft>) => {
    if ('street' in patch || 'number' in patch || 'district' in patch || 'zoneId' in patch || 'reference' in patch) {
      addressEdited.current = true
      setAddressMessage('')
    }
    setCustomer(current => ({ ...current, ...patch }))
  }
  const updatePayment = (patch: Partial<PaymentDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const field = (name: CustomerField | 'reference') => `${uid}-${name}`
  const problemProps = (name: CustomerField) =>
    customerProblems[name] ? { 'aria-invalid': true as const, 'aria-describedby': `${field(name)}-erro` } : {}

  /** Confere tudo no aparelho e devolve a comanda; com problema, leva o foco até ele. */
  const localOrder = (): OrderDraft | null => {
    setAttempted(true)
    if (closedBlocked) return null
    if (stockProblem) {
      document.querySelector<HTMLElement>('[data-cart-problem] a, [data-cart-problem] button')?.focus()
      return null
    }
    if (!customerCheck.ok) {
      const first = FIELD_ORDER.find((name) => customerCheck.problems[name])
      panel.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus()
      return null
    }
    if (!paymentCheck.ok) {
      if (paymentCheck.problem === 'no-method') methods.current?.querySelector('input')?.focus()
      else changeField.current?.focus()
      return null
    }
    return { cart, customer: customerCheck.customer, payment: paymentCheck.payment, sentAt: serverNow(), antecipado }
  }

  /** Pedido confirmado: fica neste aparelho para o acompanhamento, o carrinho esvazia e a tela muda. */
  const placed = (order: Placed) => {
    confirmed.current = true
    getAttempts().done('pedido')
    getTrackedOrders().upsert({ ...order, status: 'novo', fulfillment: customer.kind })
    // O primeiro pedido pode ter criado a sessão agora: a escuta ao vivo passa a usá-la.
    getCustomerLive().restart()
    const state: TrackState = { placed: true }
    navigate(paths.track(order.code), { state })
    cartActions.clear()
  }

  const send = async () => {
    const order = localOrder()
    if (!order || submitting.current || confirmed.current) return
    const key = orderKey
    submitting.current = true
    setFinalize({ key, state: 'sending' })
    // A mesma tentativa em todo reenvio deste pedido: o servidor nunca grava duas vezes.
    const attemptId = getAttempts().idFor('pedido', key)
    try {
      if (!functionConfig) {
        // Modo de demonstração (sem o Supabase): o pedido fica só neste navegador, para o painel.
        let saved: ReturnType<typeof saveDemoOrder> = null
        try {
          saved = saveDemoOrder(order, browserDemoDeps(), attemptId)
        } catch {
          saved = null
        }
        if (!saved) {
          setFinalize({ key, state: 'failed', text: 'Este navegador não deixou guardar o pedido de demonstração.' })
          return
        }
        placed({ id: saved.id, code: saved.code, createdAt: saved.createdAt, demo: true, tracked: true })
        return
      }
      // A sessão anônima do cliente (criada no primeiro pedido): é ela que liga o pedido a ele.
      const session = getCustomerSession()
      const accountId = session?.userId()
      if (account !== (session?.account() ?? null)) throw new Error('sessao')
      const token = (await session?.token({ create: !account })) ?? null
      if (account !== (session?.account() ?? null) || (account && (!token || !accountId || session?.userId() !== accountId))) throw new Error('sessao')
      const result = await submitOrder({ cart, customer, payment: draft, expectedTotalCents: totalCents, attemptId }, { ...functionConfig, token, requireSession: Boolean(account) })
      if (account !== (session?.account() ?? null) || (account && accountId !== session?.userId())) return
      if (result.kind === 'registered') {
        placed({
          id: result.id ?? `codigo-${result.code}`,
          code: result.code,
          createdAt: result.createdAt ?? new Date(serverNow()).toISOString(),
          demo: false,
          tracked: result.tracked,
        })
        return
      }
      if (result.kind === 'rejected') {
        // O cardápio do aparelho pode estar atrasado: lê de novo, e o carrinho mostra o que mudou.
        void refreshCatalogNow()
        setFinalize({ key, state: 'rejected', text: rejectionText(result) })
        return
      }
      setFinalize({
        key,
        state: 'failed',
        text:
          result.why === 'tempo'
            ? 'A loja demorou para responder.'
            : result.why === 'rede'
              ? 'Parece que a internet caiu.'
              : 'O sistema da loja não respondeu como esperado.',
      })
    } catch (error) {
      setFinalize({ key, state: 'failed', text: error instanceof Error && error.message === 'sessao'
        ? 'Sua sessão mudou. Entre na conta novamente para finalizar.'
        : 'Não conseguimos comunicar com a loja.' })
    } finally {
      submitting.current = false
    }
  }

  const zones = zoneList(settings.delivery)
  const zoneValue = customer.zoneId === OTHER_ZONE || zones.some((zone) => zone.id === customer.zoneId) ? (customer.zoneId ?? '') : ''
  const typedDistrict = zones.length === 0 || customer.zoneId === OTHER_ZONE
  /** Endereço sugerido pelo GPS: só os campos ainda vazios, conferidos no estado mais novo. */
  const applyGuess = (guess: AddressGuess) => {
    addressEdited.current = true
    setAddressMessage('')
    setCustomer(current => ({ ...current, ...addressPatch(current, guess, zones) }))
  }
  const saveAddress = async () => {
    const zone = zones.find(candidate => candidate.id === customer.zoneId)
    const address: CustomerAddress = {
      street: customer.street.trim(), number: customer.number.trim(),
      district: (zone?.name ?? customer.district).trim(), zoneId: zone?.id ?? (typedDistrict && zones.length ? OTHER_ZONE : null),
      reference: customer.reference.trim(),
    }
    if (!address.street || !address.number || !address.district || (!typedDistrict && !zone)) {
      setAddressMessage('Preencha rua, número e bairro para salvar o endereço.')
      return
    }
    addressEdited.current = true
    setSavingAddress(true)
    try {
      await saveCustomerAddress(address)
      setAddressMessage('Endereço salvo na sua conta para os próximos pedidos.')
    } catch {
      setAddressMessage('Não foi possível salvar o endereço. Tente de novo.')
    } finally {
      setSavingAddress(false)
    }
  }
  const feeLabel =
    customer.kind === 'retirada'
      ? 'Retirada na loja'
      : customer.kind === 'local'
        ? 'Consumo no local'
        : fee?.kind === 'taxa'
          ? `Entrega (${fee.zoneName})`
          : 'Entrega'

  return (
    <div ref={panel} className="flex flex-col gap-5">
      <dl data-order-values="" className="flex flex-col gap-1.5">
        <ValueRow label="Subtotal" value={formatBRL(subtotalCents)} />
        <ValueRow
          label={feeLabel}
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
        <Field
          id={field('phone')}
          label={feePending ? 'Telefone' : 'Telefone (opcional)'}
          problem={customerProblems.phone}
          // Frete a combinar (2026-11-21): o telefone passa a ser obrigatório, e o aviso diz por quê.
          hint={feePending && !customerProblems.phone ? COMBINAR_PHONE_TEXT : undefined}
        >
          <input
            id={field('phone')}
            data-field="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="(83) 99999-0000"
            value={customer.phone}
            required={feePending}
            aria-describedby={customerProblems.phone ? `${field('phone')}-erro` : feePending ? `${field('phone')}-dica` : undefined}
            onChange={(event) => updateCustomer({ phone: event.target.value })}
            className={`${inputClass} ring-line focus:ring-acai-700`}
            {...problemProps('phone')}
          />
        </Field>
        {!account && <div className="flex flex-col gap-0.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-acai-950">
            <input
              type="checkbox"
              data-remember-me=""
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="size-5 shrink-0 cursor-pointer accent-acai-800"
            />
            Lembrar meus dados neste dispositivo
          </label>
          <p className="pl-8 text-xs leading-relaxed text-ink-soft">
            Nome, telefone e endereço ficam salvos só neste aparelho para a próxima compra. Desmarque para apagar.
          </p>
        </div>}
      </fieldset>

      <fieldset
        aria-describedby={customerProblems.kind ? `${field('kind')}-erro` : undefined}
        className={`@container rounded-2xl transition ${customerProblems.kind ? 'bg-red-50 p-3 ring-2 ring-red-700' : ''}`}
      >
        <legend className={sectionTitle}>Como você quer receber?</legend>
        {/* Três lado a lado quando cabem; em telas muito estreitas, um por linha, sem cortar texto. */}
        <div data-modalidades="" className="mt-3 grid grid-cols-1 gap-2.5 @min-[18rem]:grid-cols-3">
          <ChoiceCard
            name={`${uid}-receber`}
            value="entrega"
            dataField="kind"
            checked={customer.kind === 'entrega'}
            onChange={() => updateCustomer({ kind: 'entrega' })}
            icon={<Scooter className="size-7 text-acai-700" />}
            label="Entrega"
            hint="Receber em casa"
          />
          <ChoiceCard
            name={`${uid}-receber`}
            value="retirada"
            checked={customer.kind === 'retirada'}
            onChange={() => updateCustomer({ kind: 'retirada' })}
            icon={<Bag className="size-7 text-acai-700" />}
            label="Retirar"
            hint="Pegar na loja e levar"
          />
          <ChoiceCard
            name={`${uid}-receber`}
            value="local"
            checked={customer.kind === 'local'}
            onChange={() => updateCustomer({ kind: 'local' })}
            icon={<IceCreamBowl className="size-7 text-acai-700" />}
            label="Comer no Local"
            hint="Consumir na sorveteria"
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
            <GpsLocation
              gps={customer.gps}
              onCapture={(gps) => updateCustomer({ gps })}
              onRemove={() => updateCustomer({ gps: null })}
              onAddress={applyGuess}
            />
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
                placeholder="Ex.: 12, 12A ou S/N"
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
            {account && (
              <div>
                <p className="mb-2 text-sm text-ink-soft">Ao finalizar a entrega, este endereço fica salvo na sua conta.</p>
                <button type="button" disabled={savingAddress} onClick={() => void saveAddress()} className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 disabled:opacity-60">
                  {savingAddress ? 'Salvando…' : 'Salvar endereço na minha conta'}
                </button>
                {addressMessage && <p role="status" className="mt-2 text-sm text-acai-800">{addressMessage}</p>}
              </div>
            )}
            {feePending && (
              <p data-combinar-note="" className="rounded-xl bg-orchid-100 px-3 py-2.5 text-sm font-semibold text-acai-950 ring-1 ring-orchid-400">
                📞 Frete a combinar: a loja vai entrar em contato pelo telefone informado em “Seus dados” para confirmar o valor da entrega.
              </p>
            )}
          </m.div>
        )}
        {(customer.kind === 'retirada' || customer.kind === 'local') && (
          <m.div key={customer.kind} {...reveal}>
            <StorePlaceCard kind={customer.kind} contact={settings.contact} />
          </m.div>
        )}
      </AnimatePresence>

      <fieldset
        ref={methods}
        aria-describedby={paymentProblem === 'no-method' ? 'pagamento-erro' : undefined}
        className={`rounded-2xl transition ${paymentProblem === 'no-method' ? 'bg-red-50 p-3 ring-2 ring-red-700' : ''}`}
      >
        <legend className={sectionTitle}>Forma de pagamento</legend>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {PAYMENT_METHODS.filter(({ id }) => allowed.includes(id)).map(({ id, label }) => {
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
                <span className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-orchid-100 px-3 py-2.5 text-acai-950 ring-1 ring-orchid-400">
                  <span className="font-bold">Troco a levar:</span>
                  <strong className="nums text-xl font-extrabold whitespace-nowrap">{formatBRL(changeDue)}</strong>
                </span>
              )}
            </p>
            {feePending && !draft.exact && (
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">O valor da entrega ainda vai ser combinado: a loja confere o troco quando ligar para confirmar o frete.</p>
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
            Tem item esgotado no carrinho: remova ou edite o item marcado para finalizar o pedido.
          </p>
        )}
        {closedBlocked && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
            A loja está fechada e não está recebendo pedidos agora. Volte {status.reopenText}.
          </p>
        )}
        {antecipado && (
          <p className="mb-3 rounded-xl bg-orchid-100 px-3 py-2.5 text-sm font-semibold text-acai-950 ring-1 ring-orchid-400">
            A loja está fechada agora: o pedido vai como <strong className="font-bold">pedido antecipado</strong> e é preparado quando
            abrirmos ({status.reopenText}).
          </p>
        )}
        <button
          type="button"
          data-finalize=""
          onClick={() => void send()}
          disabled={closedBlocked || sending}
          aria-busy={sending || undefined}
          className="btn-primary inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2 text-base leading-tight font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
        >
          <Check className="size-5" />
          {closedBlocked ? 'Loja fechada: pedidos bloqueados' : sending ? 'Enviando o pedido…' : 'Finalizar pedido'}
        </button>
        <p data-finalize-hint="" className="mt-2 text-xs leading-relaxed text-ink-soft">
          {functionConfig ? (
            'O pedido vai direto para a loja, sem sair do site. Depois é só acompanhar cada etapa aqui.'
          ) : (
            <>
              <strong className="font-bold text-acai-800">Modo de demonstração:</strong> o pedido fica só neste navegador e a loja não recebe.
            </>
          )}
        </p>

        {outcome?.state === 'rejected' && (
          <div data-order-rejected="" role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
            <p className="font-bold">{outcome.text}</p>
          </div>
        )}
        {outcome?.state === 'failed' && (
          <div data-order-failed="" role="alert" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
            <p className="font-bold">Não foi possível confirmar o pedido agora.</p>
            <p className="mt-1 leading-relaxed">
              {outcome.text} O pedido ainda não foi confirmado. Toque em Tentar de novo: se ele já tiver chegado à loja, não é registrado duas vezes.
            </p>
            <button
              type="button"
              data-order-retry=""
              onClick={() => void send()}
              disabled={sending}
              className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-white px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-wait disabled:opacity-60"
            >
              Tentar de novo
            </button>
          </div>
        )}
        <p role="status" className="sr-only">
          {sending ? 'Enviando o pedido…' : ''}
        </p>
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

function Field({ id, label, problem, hint, children }: { id: string; label: string; problem?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-acai-950">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-dica`} data-field-hint="" className="text-sm leading-relaxed font-semibold text-acai-800">
          {hint}
        </p>
      )}
      {problem && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-bold text-red-800">
          {problem}
        </p>
      )}
    </div>
  )
}

/**
 * Retirar e Comer no Local (pedido de 2026-11-20): o endereço da loja de "Horários e Contato" e o
 * link do mapa. Comer no Local tem destaque dourado e roxo, além do texto e do ícone próprios.
 */
function StorePlaceCard({ kind, contact }: { kind: 'retirada' | 'local'; contact: StoreContact }) {
  const local = kind === 'local'
  return (
    <div data-store-place={kind} className={`rounded-2xl p-4 ring-1 ${local ? 'bg-orchid-100 ring-orchid-400' : 'bg-acai-50 ring-line'}`}>
      <p className="font-display text-base leading-snug font-extrabold text-acai-800">
        {local ? '🍨 Consumo no Local — Vamos deixar tudo pronto!' : '🛍️ Retirada no Balcão — Açaí Doce Sabor'}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-acai-950">
        {local
          ? 'Assim que você finalizar o pedido, já começamos a preparar para você só chegar e aproveitar.'
          : 'Faça seu pedido e retire diretamente na nossa loja.'}
      </p>
      <p className="mt-2 text-sm font-bold text-acai-950">📍 {storePlaceText(contact)}</p>
      <a
        data-store-map=""
        href={mapsUrl(storeAddressText(contact))}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-center text-sm leading-tight font-bold text-acai-800 ring-1 ring-acai-800/30 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
      >
        🗺️ Ver localização da sorveteria no Google Maps
      </a>
    </div>
  )
}

/** Cartão de escolha (modalidade, forma de pagamento): o rádio fica escondido e o cartão marca. */
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
        checked ? 'border-orchid-400 bg-orchid-100' : 'border-line bg-white hover:border-acai-600/40'
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
        className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-acai-800 text-orchid-400 shadow-sm"
      >
        <Check className="size-4" />
      </m.span>
    </label>
  )
}
