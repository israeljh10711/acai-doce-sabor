import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { paths } from '../../paths.ts'
import { formatBRL } from '../../utils/money.ts'
import { type Cart, cartCount, cartItemProblem, cartTotalCents, serializeCart } from '../cart/cart.ts'
import { cartActions } from '../cart/cartStore.ts'
import { parseReais, reaisText } from '../checkout/payment.ts'
import { ComandaItems } from '../orders/ComandaItems.tsx'
import { refreshCatalogNow } from '../seller/sellerBackend.ts'
import type { AddMode } from './addMode.ts'
import { ADDABLE_STATUSES } from './orderView.ts'
import { CUSTOMER_STATUS_LABEL } from './timeline.ts'
import type { AddResult } from './trackingApi.ts'
import type { TrackState } from './trackState.ts'
import { getAddMode, getAttempts, getCustomerLive, getTrackingApi, useCustomerConnection, useCustomerLive } from './trackingRuntime.ts'

type Outcome = { key: string; text: string }

/** O que o cliente lê quando a adição não passa (o banco confere a situação, o troco e a repetição). */
function addProblemText(result: Exclude<AddResult, { ok: true }>): string {
  switch (result.reason) {
    case 'situacao':
      return 'A loja já terminou de preparar este pedido e ele não aceita mais itens. Você pode fazer um novo pedido com estes itens.'
    case 'troco':
      return `O troco não cobre o novo total de ${formatBRL(result.totalCents ?? 0)}. Informe um novo valor de troco ou marque "valor exato".`
    case 'total-mudou':
      return `Os preços mudaram: os novos itens agora somam ${formatBRL(result.totalCents ?? 0)}. Confira o carrinho e confirme de novo.`
    case 'esgotado':
      return `Esgotou: ${result.detail ?? 'um item do carrinho'}. Remova ou edite o item marcado.`
    case 'item-indisponivel':
      // Com o nome (2026-11-21): a escolha do item mudou no cardápio (ex.: o máximo de um grupo).
      return result.detail
        ? `O item "${result.detail}" mudou no cardápio. Confira as escolhas dele e confirme de novo.`
        : 'Um item do carrinho não está mais no cardápio. Remova o item marcado.'
    case 'loja-fechada':
      return 'A loja fechou e não está recebendo pedidos agora.'
    case 'carrinho-vazio':
      return 'Escolha pelo menos um item para acrescentar.'
    case 'pagamento-invalido':
      return `Confira o troco: ${result.detail ?? ''}`
    case 'expirado':
      return 'Este pedido é antigo demais para receber itens.'
    case 'sem-sessao':
      return 'A sessão deste aparelho expirou e não dá para mexer neste pedido. Fale com a loja pelo WhatsApp.'
    case 'nao-encontrado':
    case 'pedido-invalido':
      return 'Não encontramos este pedido na sessão deste aparelho.'
    default:
      return 'Não foi possível confirmar a adição agora. Nada foi acrescentado ainda: tente de novo (se já tiver chegado à loja, não é acrescentado duas vezes).'
  }
}

/**
 * O carrinho no modo de adição (pedido 100% no site, 2026-11-20): o pedido atual, os novos itens,
 * o novo total (sem cobrar a entrega de novo) e, no dinheiro, o troco. "Confirmar adição ao
 * pedido" manda os itens para a função `pedido`, que confere preços, estoque, a situação (só
 * Novo ou Preparando), o troco e a repetição dentro do banco, de uma vez só.
 */
export function AddItemsPanel({ cart, mode }: { cart: Cart; mode: AddMode }) {
  const navigate = useNavigate()
  useCustomerConnection(true, mode.orderId)
  const snapshot = useCustomerLive()
  const view = snapshot.views[mode.orderId]
  const lookupError = snapshot.errors[mode.orderId]
  const [changeFor, setChangeFor] = useState('')
  const [exact, setExact] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [sending, setSending] = useState(false)
  const busy = useRef(false)
  const changeField = useRef<HTMLInputElement>(null)

  const subtotal = cartTotalCents(cart)
  const count = cartCount(cart)
  const stockProblem = cart.items.some((item) => cartItemProblem(item) !== null)
  const cash = view?.paymentMethod === 'dinheiro'
  const newTotal = view ? view.totalCents + subtotal : null
  const key = JSON.stringify([serializeCart(cart), cash ? [changeFor.trim(), exact] : null])
  const shown = outcome && outcome.key === key ? outcome : null
  const typedChange = cash && !exact && changeFor.trim() ? parseReais(changeFor) : null
  const changeProblem =
    !view || !cash || exact || newTotal === null
      ? null
      : changeFor.trim()
        ? typedChange === null
          ? 'Digite o valor em reais, por exemplo 50,00.'
          : typedChange < newTotal
            ? `O troco precisa ser para ${formatBRL(newTotal)} ou mais.`
            : null
        : view.changeForCents !== null && view.changeForCents < newTotal
          ? `O troco informado antes (${formatBRL(view.changeForCents)}) não cobre o novo total. Informe outro valor ou marque "valor exato".`
          : null

  const cancel = () => {
    getAddMode().stop()
    void navigate(paths.track(mode.code))
  }
  /** Sai do modo de adição: os itens continuam no carrinho, para um pedido novo. */
  const newOrder = () => getAddMode().stop()

  const confirm = async () => {
    if (busy.current || !view || !ADDABLE_STATUSES.includes(view.status) || cart.items.length === 0) return
    if (stockProblem) {
      document.querySelector<HTMLElement>('[data-cart-problem] a, [data-cart-problem] button')?.focus()
      return
    }
    if (changeProblem) {
      changeField.current?.focus()
      return
    }
    busy.current = true
    setSending(true)
    const scope = `acrescimo:${mode.orderId}`
    // A mesma tentativa em todo reenvio deste conteúdo: o banco nunca acrescenta duas vezes.
    const attemptId = getAttempts().idFor(scope, key)
    const result = await getTrackingApi().add(mode.orderId, {
      attemptId,
      cart,
      expectedSubtotalCents: subtotal,
      ...(cash ? { payment: { changeFor, exact } } : {}),
    })
    if (result.ok) {
      // Confirmado: o botão não volta a valer (um segundo toque seria outra tentativa).
      getAttempts().done(scope)
      getAddMode().stop()
      void getCustomerLive().refresh(mode.orderId)
      const state: TrackState = { added: true }
      void navigate(paths.track(mode.code), { state })
      cartActions.clear()
      return
    }
    busy.current = false
    setSending(false)
    setOutcome({ key, text: addProblemText(result) })
    if (result.reason === 'situacao' || result.reason === 'troco') void getCustomerLive().refresh(mode.orderId)
    if (result.reason === 'esgotado' || result.reason === 'total-mudou' || result.reason === 'item-indisponivel') void refreshCatalogNow()
  }

  const ghost =
    'inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-white px-5 text-base font-bold text-acai-800 ring-1 ring-acai-800/30 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

  if (!view) {
    return (
      <div data-add-panel="" className="flex flex-col gap-4">
        {lookupError ? (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-200">
            {lookupError === 'falha' ? 'Não conseguimos carregar o pedido agora. Confira a internet: tentando de novo…' : addProblemText({ ok: false, reason: lookupError })}
          </p>
        ) : (
          <p role="status" className="text-center font-bold text-acai-800">
            Carregando o pedido #{mode.code}…
          </p>
        )}
        <button type="button" data-add-cancel="" onClick={cancel} className={ghost}>
          Cancelar adição
        </button>
      </div>
    )
  }

  const addable = ADDABLE_STATUSES.includes(view.status)

  return (
    <div data-add-panel={view.code} className="flex flex-col gap-5">
      <details className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
        <summary className="cursor-pointer font-bold text-acai-950">
          Pedido atual #{view.code}: <span className="nums">{formatBRL(view.totalCents)}</span>
          <span className="block text-sm font-semibold text-ink-soft">Situação: {CUSTOMER_STATUS_LABEL[view.status]} · toque para ver os itens</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <ComandaItems comanda={view.itemsBlock} fallback={view.items} />
          {view.additions.map((addition, index) => (
            <div key={index} className="rounded-xl bg-gold-100 p-3 ring-1 ring-gold-400">
              <p className="mb-2 text-sm font-extrabold text-acai-950">➕ Itens adicionados</p>
              <ComandaItems comanda={addition.itemsBlock} fallback={addition.items} />
            </div>
          ))}
        </div>
      </details>

      {!addable ? (
        <div data-add-closed="" role="alert" className="flex flex-col gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
          <p className="font-bold">
            Este pedido já está “{CUSTOMER_STATUS_LABEL[view.status]}” e não aceita mais itens.
          </p>
          <p>Os itens escolhidos continuam no carrinho: você pode fazer um novo pedido com eles.</p>
          <button type="button" data-add-new-order="" onClick={newOrder} className={ghost}>
            Fazer um novo pedido com estes itens
          </button>
          <Link to={paths.track(view.code)} onClick={() => getAddMode().stop()} className="text-center font-bold text-acai-700 underline underline-offset-2">
            Ver o pedido #{view.code}
          </Link>
        </div>
      ) : (
        <>
          <dl data-add-values="" className="flex flex-col gap-1.5 text-sm text-acai-950">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold">Novos itens: {count}</dt>
              <dd className="nums font-bold">+ {formatBRL(subtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold">Entrega</dt>
              <dd className="font-bold">sem cobrança nova</dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-2">
              <dt className="font-display text-lg font-extrabold text-acai-800 uppercase">Novo total</dt>
              <dd data-add-new-total="" className="nums text-2xl font-extrabold text-acai-800">
                {formatBRL(newTotal ?? 0)}
              </dd>
            </div>
          </dl>

          {cash && (
            <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
              <label htmlFor="troco-acrescimo" className="font-bold text-acai-950">
                Troco para quanto? (pagamento em dinheiro)
              </label>
              <p className="text-xs text-ink-soft">
                {view.changeForCents !== null ? `Antes: troco para ${formatBRL(view.changeForCents)}. ` : ''}Deixe em branco para manter.
              </p>
              <div className={`mt-2 flex items-center rounded-xl bg-white ring-1 focus-within:ring-2 ${changeProblem ? 'ring-red-700' : 'ring-line focus-within:ring-acai-700'} ${exact ? 'opacity-55' : ''}`}>
                <span aria-hidden="true" className="pl-3 font-bold text-ink-soft">
                  R$
                </span>
                <input
                  ref={changeField}
                  id="troco-acrescimo"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="Ex: 100,00"
                  value={changeFor}
                  disabled={exact}
                  aria-invalid={changeProblem ? true : undefined}
                  aria-describedby={changeProblem ? 'troco-acrescimo-erro' : undefined}
                  onChange={(event) => setChangeFor(event.target.value)}
                  onBlur={() => {
                    const cents = parseReais(changeFor)
                    if (cents !== null) setChangeFor(reaisText(cents))
                  }}
                  className="nums min-h-12 w-full min-w-0 bg-transparent px-2 text-lg font-bold text-acai-950 outline-none placeholder:font-normal placeholder:text-ink-soft"
                />
              </div>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-acai-950">
                <input type="checkbox" checked={exact} onChange={(event) => setExact(event.target.checked)} className="size-5 shrink-0 cursor-pointer accent-acai-800" />
                Não preciso de troco (valor exato)
              </label>
              {changeProblem && (
                <p id="troco-acrescimo-erro" role="alert" className="mt-2 text-sm font-bold text-red-800">
                  {changeProblem}
                </p>
              )}
            </div>
          )}

          {stockProblem && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800 ring-1 ring-red-200">
              Tem item esgotado no carrinho: remova ou edite o item marcado para confirmar.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              data-add-confirm=""
              onClick={() => void confirm()}
              disabled={sending || cart.items.length === 0}
              aria-busy={sending || undefined}
              className="btn-gold inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-base leading-tight font-extrabold tracking-tight focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
            >
              {sending ? 'Confirmando…' : 'Confirmar adição ao pedido'}
            </button>
            <button type="button" data-add-cancel="" onClick={cancel} className={ghost}>
              Cancelar adição
            </button>
          </div>
        </>
      )}

      {shown && (
        <div data-add-problem="" role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-900 ring-1 ring-red-200">
          {shown.text}
        </div>
      )}
    </div>
  )
}
