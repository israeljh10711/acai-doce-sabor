import { m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { ArrowLeft, Check, Clock } from '../components/ui/icons.tsx'
import { useStoreSettings } from '../features/catalog/catalogStore.ts'
import { PixCard } from '../features/checkout/PixCard.tsx'
import { ComandaItems } from '../features/orders/ComandaItems.tsx'
import { ModalityBadge } from '../features/orders/OrderCard.tsx'
import { feeLine } from '../features/orders/ordersPanel.ts'
import { ADDABLE_STATUSES, type OrderView } from '../features/tracking/orderView.ts'
import { CUSTOMER_STATUS_LABEL, type TimelineStep, timelineFor } from '../features/tracking/timeline.ts'
import { isActive, type TrackedOrder } from '../features/tracking/trackedOrders.ts'
import { readTrackState } from '../features/tracking/trackState.ts'
import { supportWhatsAppUrl } from '../features/tracking/support.ts'
import { pixDue } from '../features/tracking/pixDue.ts'
import { deliveryWindow } from '../features/store/deliveryTime.ts'
import { getAddMode, getCustomerLive, useCustomerConnection, useCustomerLive, useTrackedOrders } from '../features/tracking/trackingRuntime.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { formatBRL } from '../utils/money.ts'

const STORE_TIME_ZONE = 'America/Sao_Paulo'
const dayOnly = new Intl.DateTimeFormat('pt-BR', { timeZone: STORE_TIME_ZONE, day: '2-digit', month: '2-digit' })
const timeOnly = new Intl.DateTimeFormat('pt-BR', { timeZone: STORE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "20/11 às 15:42" (horário da loja); data que não dá para ler: nada. */
function whenText(iso: string | null): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN
  return Number.isFinite(at) ? `${dayOnly.format(at)} às ${timeOnly.format(at)}` : null
}
function timeText(iso: string | null): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN
  return Number.isFinite(at) ? timeOnly.format(at) : null
}

const hero = 'bg-acai-800 bg-[radial-gradient(ellipse_at_80%_20%,#6a1650_0%,#4a0e36_50%,#3b072a_100%)] text-white'
const card = 'rounded-3xl bg-white p-5 shadow-card ring-1 ring-line sm:p-6'
const secondaryButton =
  'inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 text-base font-bold text-acai-800 ring-1 ring-acai-800/30 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Acompanhamento do pedido pelo cliente (pedido 100% no site, 2026-11-20).
 * - `/acompanhar`: os pedidos feitos neste aparelho nos últimos 30 dias.
 * - `/acompanhar/:codigo`: um pedido, com a linha do tempo ao vivo, o resumo, "Adicionar mais
 *   itens" (só enquanto a loja não terminou de preparar) e as dúvidas pelo WhatsApp.
 * O código na URL só escolhe qual pedido deste aparelho mostrar: quem autoriza a consulta é a
 * sessão do cliente, conferida no servidor. Um código de outro aparelho não abre nada.
 */
export function TrackOrderPage() {
  const { codigo } = useParams()
  return codigo ? <OrderTracking code={codigo} /> : <TrackedList />
}

function TrackedList() {
  usePageTitle('Meus pedidos', { noindex: true })
  const orders = useTrackedOrders()
  const anyLive = orders.some((order) => isActive(order) && (order.tracked || order.demo))
  useCustomerConnection(anyLive)

  return (
    <>
      <div className={hero}>
        <Container className="pt-6 pb-10 sm:pt-8 sm:pb-12">
          <BackToMenu />
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">Meus pedidos</h1>
          <p className="mt-2 text-lg text-white/85">Os pedidos feitos neste aparelho nos últimos 30 dias.</p>
        </Container>
      </div>
      <Container className="py-8 sm:py-12">
        {orders.length === 0 ? (
          <div data-tracked-empty="" className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-acai-50 px-6 py-12 text-center ring-1 ring-line">
            <p className="font-display text-2xl font-black tracking-tight text-acai-800 uppercase">Nenhum pedido por aqui</p>
            <p className="text-ink-soft">Quando você finalizar um pedido neste aparelho, ele aparece aqui para acompanhar.</p>
            <ButtonLink to={paths.buildOrder}>Ver o cardápio</ButtonLink>
          </div>
        ) : (
          <ul data-tracked-list="" className="mx-auto flex max-w-2xl flex-col gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <TrackedRow order={order} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  )
}

function TrackedRow({ order }: { order: TrackedOrder }) {
  const active = isActive(order)
  return (
    <Link
      to={paths.track(order.code)}
      data-tracked-order={order.code}
      className={`flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-card transition hover:ring-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 ${active ? 'ring-2 ring-gold-400' : 'ring-1 ring-line'}`}
    >
      <span className="min-w-0">
        <span className="nums block font-display text-xl font-black tracking-tight text-acai-800">#{order.code}</span>
        <span className="block text-sm text-ink-soft">
          {whenText(order.createdAt) ?? ''}
          {order.demo && ' · Demonstração'}
        </span>
      </span>
      <span data-tracked-status={order.status} className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold tracking-wide uppercase ring-1 ${active ? 'bg-gold-100 text-acai-950 ring-gold-400' : 'bg-zinc-100 text-zinc-700 ring-zinc-300'}`}>
        {CUSTOMER_STATUS_LABEL[order.status]}
      </span>
    </Link>
  )
}

function BackToMenu() {
  return (
    <Link
      to={paths.buildOrder}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-gold-400 hover:text-gold-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <ArrowLeft className="size-4" />
      <span className="link-draw">Voltar ao cardápio</span>
    </Link>
  )
}

/** Os motivos de não conseguir mostrar o pedido, em palavras do cliente. */
const LOOKUP_ERROR: Record<string, string> = {
  'nao-encontrado': 'Não encontramos este pedido na sessão deste aparelho.',
  'pedido-invalido': 'Não encontramos este pedido na sessão deste aparelho.',
  expirado: 'Este pedido tem mais de 30 dias e não aparece mais no acompanhamento.',
  'sem-sessao': 'A sessão deste aparelho expirou e não dá mais para consultar este pedido por aqui.',
}

function OrderTracking({ code }: { code: string }) {
  usePageTitle(`Pedido #${code}`, { noindex: true })
  const location = useLocation()
  const navigate = useNavigate()
  const orders = useTrackedOrders()
  const order = orders.find((candidate) => candidate.code === code) ?? null
  // O recado da finalização aparece uma vez: a tela limpa o estado da navegação (recarregar não repete).
  const [notice] = useState(() => readTrackState(location.state))
  useEffect(() => {
    if (notice.placed || notice.added) void navigate(location.pathname, { replace: true, state: null })
    // Só na chegada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canQuery = order !== null && (order.tracked || order.demo)
  useCustomerConnection(canQuery, canQuery ? order.id : null)
  const snapshot = useCustomerLive()
  const view = order ? snapshot.views[order.id] : undefined
  const error = order ? snapshot.errors[order.id] : undefined

  return (
    <>
      <div className={hero}>
        <Container className="pt-6 pb-10 sm:pt-8 sm:pb-12">
          <BackToMenu />
          <p className="mt-1 text-sm font-bold tracking-wide text-gold-400 uppercase">Acompanhar pedido</p>
          <h1 className="nums font-display text-4xl font-black tracking-tight sm:text-5xl">Pedido #{code}</h1>
          {order && <p className="mt-1 text-white/85">Feito em {whenText(view?.createdAt ?? order.createdAt) ?? '—'}</p>}
          <p className="mt-2 text-lg text-white/85">Acompanhe cada etapa da preparação do seu pedido.</p>
        </Container>
      </div>

      <Container className="py-8 sm:py-12">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {(notice.placed || notice.added) && <SuccessNotice code={code} added={Boolean(notice.added)} demo={order?.demo ?? false} />}
          {order?.demo && (
            <p data-demo-notice="" className="rounded-2xl bg-gold-100 px-4 py-3 text-sm font-semibold text-acai-950 ring-1 ring-gold-400">
              <strong className="font-extrabold">Modo de demonstração:</strong> este pedido fica só neste navegador e a loja não recebe. As etapas mudam pelo painel de pedidos deste mesmo computador.
            </p>
          )}

          {!order ? (
            <NotOnThisDevice code={code} />
          ) : !canQuery ? (
            <UntrackedOrder code={code} />
          ) : view ? (
            <TrackedView view={view} demo={order.demo} live={snapshot.live} stale={error === 'falha'} />
          ) : error && error !== 'falha' ? (
            <LookupProblem code={code} text={LOOKUP_ERROR[error] ?? 'Não conseguimos mostrar este pedido.'} />
          ) : error === 'falha' ? (
            <LookupProblem code={code} text="Não conseguimos carregar o pedido agora. Confira a internet e tente de novo." retryId={order.id} />
          ) : (
            <p role="status" data-tracking-loading="" className={`${card} text-center font-bold text-acai-800`}>
              Carregando o pedido…
            </p>
          )}

          {orders.length > 1 && (
            <Link
              to={paths.track()}
              className="self-center text-sm font-bold text-acai-700 underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              Ver todos os meus pedidos
            </Link>
          )}
        </div>
      </Container>
    </>
  )
}

function SuccessNotice({ code, added, demo }: { code: string; added: boolean; demo: boolean }) {
  const reduce = useReducedMotion()
  return (
    <m.div
      data-order-success={added ? 'itens' : 'pedido'}
      role="status"
      initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-3xl bg-emerald-50 p-5 text-emerald-950 ring-2 ring-emerald-300"
    >
      <p className="font-display text-xl font-black tracking-tight">{added ? `✅ Itens adicionados ao pedido #${code}!` : '✅ Pedido recebido com sucesso!'}</p>
      <p className="mt-1 leading-relaxed">
        {added
          ? 'Os novos itens já fazem parte do mesmo pedido. A loja vê tudo junto.'
          : demo
            ? `O pedido #${code} foi guardado neste navegador (demonstração). Acompanhe cada etapa aqui.`
            : `A loja recebeu o seu pedido #${code}. Acompanhe cada etapa aqui, sem precisar mandar mensagem.`}
      </p>
    </m.div>
  )
}

function SupportButton({ code }: { code: string }) {
  return (
    <a data-support-whatsapp="" href={supportWhatsAppUrl(code)} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
      💬 Dúvidas? Falar no WhatsApp
    </a>
  )
}

function NotOnThisDevice({ code }: { code: string }) {
  return (
    <section data-tracking-missing="" className={`${card} flex flex-col gap-3`}>
      <h2 className="font-display text-xl font-black tracking-tight text-acai-800 uppercase">Pedido não encontrado neste aparelho</h2>
      <p className="leading-relaxed text-acai-950">
        Por segurança, o acompanhamento só abre no aparelho e no navegador em que o pedido foi feito. Se você fez o pedido #{code} em
        outro aparelho, abra o site nele.
      </p>
      <SupportButton code={code} />
      <ButtonLink to={paths.track()} variant="secondary">
        Ver meus pedidos
      </ButtonLink>
    </section>
  )
}

function UntrackedOrder({ code }: { code: string }) {
  return (
    <section data-tracking-untracked="" className={`${card} flex flex-col gap-3`}>
      <h2 className="font-display text-xl font-black tracking-tight text-acai-800 uppercase">Pedido recebido</h2>
      <p className="leading-relaxed text-acai-950">
        A loja recebeu o pedido #{code}, mas o acompanhamento ao vivo não ficou disponível para ele (o sistema não conseguiu abrir a sessão deste
        aparelho). Se precisar saber como está, fale com a loja.
      </p>
      <SupportButton code={code} />
    </section>
  )
}

function LookupProblem({ code, text, retryId }: { code: string; text: string; retryId?: string }) {
  return (
    <section data-tracking-error="" role="alert" className="flex flex-col gap-3 rounded-3xl bg-red-50 p-5 text-red-900 ring-1 ring-red-200">
      <p className="font-bold">{text}</p>
      {retryId && (
        <button type="button" data-tracking-retry="" onClick={() => void getCustomerLive().refresh(retryId)} className={secondaryButton}>
          Tentar de novo
        </button>
      )}
      <SupportButton code={code} />
    </section>
  )
}

const LIVE_TEXT = {
  off: '',
  connecting: 'Conectando ao acompanhamento ao vivo…',
  live: 'Ao vivo: a tela muda sozinha a cada etapa.',
  offline: 'Sem conexão ao vivo: conferindo a cada 20 segundos.',
} as const

function TrackedView({ view, demo, live, stale }: { view: OrderView; demo: boolean; live: keyof typeof LIVE_TEXT; stale: boolean }) {
  const navigate = useNavigate()
  const timeline = useMemo(() => timelineFor(view), [view])
  const addable = ADDABLE_STATUSES.includes(view.status)
  const startAdding = () => {
    getAddMode().start({ id: view.id, code: view.code })
    void navigate(paths.buildOrder)
  }

  return (
    <>
      <section data-tracking-timeline="" data-status={view.status} aria-labelledby="etapa-atual" className={card}>
        <p
          data-live={live}
          className={`mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${live === 'live' ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200' : 'bg-acai-50 text-acai-800 ring-1 ring-line'}`}
        >
          <span aria-hidden="true" className={`size-2 rounded-full ${live === 'live' ? 'bg-emerald-600' : 'bg-acai-600'}`} />
          {demo && live === 'live' ? 'Ao vivo (demonstração neste navegador)' : LIVE_TEXT[live]}
        </p>
        <h2 id="etapa-atual" aria-live="polite" className="font-display text-2xl leading-tight font-black tracking-tight text-acai-800">
          {timeline.headline}
        </h2>
        {timeline.description && <p className="mt-1 leading-relaxed text-acai-950">{timeline.description}</p>}
        <Forecast view={view} finished={timeline.finished} />
        {stale && (
          <p role="status" className="mt-2 text-sm font-semibold text-red-800">
            Sem conexão agora: mostrando a última situação conhecida.
          </p>
        )}
        <ol className="mt-5 flex flex-col">
          {timeline.steps.map((step, index) => (
            <StepRow key={`${step.key}-${index}`} step={step} last={index === timeline.steps.length - 1} />
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-3">
        {addable && (
          <button type="button" data-add-items="" onClick={startAdding} className="btn-gold inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-base font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800">
            ➕ Adicionar mais itens a este pedido
          </button>
        )}
        <SupportButton code={view.code} />
      </div>

      <TrackingPix view={view} />

      <OrderSummary view={view} />
    </>
  )
}

/**
 * Previsão de entrega da loja (2026-11-21): o "Tempo" de entrega que o vendedor configura (o mesmo
 * do topo do site), contado a partir do pedido. É um prazo de entrega: em Retirar e Comer no Local
 * não aparece (a loja não configura tempo de preparo). Some quando o pedido termina.
 */
function Forecast({ view, finished }: { view: OrderView; finished: boolean }) {
  const settings = useStoreSettings()
  const text = settings.deliveryTime.trim()
  if (finished || view.fulfillment !== 'entrega' || !text) return null
  const range = deliveryWindow(text)
  const created = Date.parse(view.createdAt)
  const until = range && Number.isFinite(created) ? timeOnly.format(created + range.max * 60_000) : null
  return (
    <p data-tracking-forecast="" className="mt-3 rounded-xl bg-acai-50 px-3 py-2 text-sm font-semibold text-acai-950 ring-1 ring-line">
      🕒 Previsão de entrega da loja: <strong className="font-extrabold">{text}</strong> a partir do pedido
      {until && (
        <>
          {' '}
          (até por volta das <span className="nums">{until}</span>)
        </>
      )}
      .
    </p>
  )
}

/**
 * Pix no acompanhamento (2026-11-21): a mesma chave do carrinho, com o valor que o pedido gravado
 * comprova. O site não registra pagamento recebido, então mostra o total e, quando o cliente
 * acrescentou itens, quanto é a diferença para quem já pagou o valor de antes.
 */
function TrackingPix({ view }: { view: OrderView }) {
  const due = pixDue(view)
  if (!due) return null
  return (
    <section aria-labelledby="pix-titulo" data-tracking-pix="">
      <PixCard instruction="Faça o Pix e guarde o comprovante. Se a loja pedir, envie pelo botão “💬 Dúvidas? Falar no WhatsApp”, logo acima. Este site não mostra se o Pix já foi recebido: quem confere é a loja.">
        <div className="mb-3 border-b border-line pb-3">
          <h2 id="pix-titulo" className="font-display text-lg font-extrabold text-acai-800">
            💠 Pagamento via Pix
          </h2>
          <p className="mt-1 flex items-baseline justify-between gap-3 text-acai-950">
            <span className="font-semibold">Total do pedido</span>
            <strong data-pix-total="" className="nums text-2xl font-extrabold whitespace-nowrap text-acai-800">
              {formatBRL(due.totalCents)}
            </strong>
          </p>
          {due.feePending && <p className="text-sm text-ink-soft">+ entrega a combinar: a loja informa o valor quando entrar em contato.</p>}
          {due.additionsCents > 0 && (
            <div data-pix-additions="" className="mt-2 rounded-xl bg-gold-100 p-3 text-sm text-acai-950 ring-1 ring-gold-400">
              <p className="flex justify-between gap-3">
                <span>Pedido antes dos acréscimos</span>
                <span className="nums font-bold whitespace-nowrap">{formatBRL(due.beforeAdditionsCents)}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span>Itens acrescentados</span>
                <span className="nums font-bold whitespace-nowrap">+ {formatBRL(due.additionsCents)}</span>
              </p>
              <p data-pix-difference="" className="mt-1.5 font-semibold">
                Já fez o Pix de {formatBRL(due.beforeAdditionsCents)}? Faça outro Pix só dos itens acrescentados:{' '}
                <strong className="nums">{formatBRL(due.additionsCents)}</strong>.
              </p>
            </div>
          )}
        </div>
      </PixCard>
    </section>
  )
}

const STEP_MARK: Record<TimelineStep['state'], string> = {
  done: 'bg-emerald-600 text-white',
  current: 'bg-gold-400 text-acai-950 ring-4 ring-gold-100',
  pending: 'bg-white text-ink-soft ring-2 ring-line',
  cancelled: 'bg-red-700 text-white',
}

function StepRow({ step, last }: { step: TimelineStep; last: boolean }) {
  const time = timeText(step.at)
  const stateText = step.state === 'done' ? 'feito' : step.state === 'current' ? 'agora' : step.state === 'cancelled' ? 'cancelado' : 'ainda não'
  return (
    <li data-step={step.key} data-step-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <div className="flex flex-col items-center">
        <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full ${STEP_MARK[step.state]}`}>
          {step.state === 'done' ? <Check className="size-4" /> : step.state === 'current' ? <Clock className="size-4" /> : null}
        </span>
        {!last && <span aria-hidden="true" className={`w-0.5 flex-1 ${step.state === 'done' ? 'bg-emerald-600' : 'bg-line'}`} />}
      </div>
      <div className={`pb-5 ${step.state === 'pending' ? 'text-ink-soft' : 'text-acai-950'}`}>
        <p className={`leading-snug ${step.state === 'current' ? 'font-extrabold' : 'font-bold'}`}>
          {step.label}
          <span className="sr-only"> ({stateText})</span>
        </p>
        {time && <p className="nums text-sm text-ink-soft">{time}</p>}
      </div>
    </li>
  )
}

function paymentLine(view: OrderView): string {
  switch (view.paymentMethod) {
    case 'pix':
      return '💠 Pix'
    case 'credito':
      return '💳 Cartão de crédito'
    case 'debito':
      return '💳 Cartão de débito'
    case 'dinheiro':
      return view.changeForCents === null ? '💵 Dinheiro' : `💵 Dinheiro — troco para ${formatBRL(view.changeForCents)}`
    default:
      return 'Não informado'
  }
}

function OrderSummary({ view }: { view: OrderView }) {
  const fee = feeLine(view)
  return (
    <section data-order-summary="" aria-labelledby="resumo-titulo" className={`${card} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="resumo-titulo" className="font-display text-xl font-black tracking-tight text-acai-800 uppercase">
          Resumo do pedido
        </h2>
        <ModalityBadge type={view.fulfillment} />
      </div>
      {view.antecipado && <p className="text-sm font-bold text-acai-800">Pedido antecipado: preparado quando a loja abrir.</p>}
      {view.fulfillment === 'entrega' && view.address && (
        <div data-order-address="" className="rounded-xl bg-acai-50 p-3 text-sm text-acai-950 ring-1 ring-line">
          <p className="font-bold">
            {view.address.street}, {view.address.number}
          </p>
          <p>Bairro: {view.address.district}</p>
          {view.address.reference && <p>Ref.: {view.address.reference}</p>}
        </div>
      )}
      <ComandaItems comanda={view.itemsBlock} fallback={view.items} />
      {view.additions.map((addition, index) => (
        <div key={index} data-order-addition="" className="rounded-xl bg-gold-100 p-3 ring-1 ring-gold-400">
          <p className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-extrabold text-acai-950">
            <span>➕ Itens adicionados</span>
            <span className="nums font-bold text-acai-800">{timeText(addition.createdAt) ?? ''}</span>
          </p>
          <ComandaItems comanda={addition.itemsBlock} fallback={addition.items} />
          <p className="nums mt-2 text-right text-sm font-extrabold text-acai-800">+ {formatBRL(addition.subtotalCents)}</p>
        </div>
      ))}
      <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm text-acai-950">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-semibold">Subtotal</dt>
          <dd className="nums font-bold">{formatBRL(view.subtotalCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-semibold">{fee.label}</dt>
          <dd className="nums font-bold">{fee.value}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-display font-extrabold text-acai-800 uppercase">Total</dt>
          <dd data-order-total="" className="nums text-xl font-extrabold text-acai-800">
            {formatBRL(view.totalCents)}
          </dd>
        </div>
        <div data-order-payment="" className="mt-1 rounded-lg bg-acai-50 px-2.5 py-1.5 font-bold ring-1 ring-line">
          {paymentLine(view)}
        </div>
      </dl>
    </section>
  )
}
