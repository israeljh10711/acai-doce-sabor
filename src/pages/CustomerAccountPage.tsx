import { type FormEvent, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { ArrowLeft } from '../components/ui/icons.tsx'
import { cartActions } from '../features/cart/cartStore.ts'
import { useCatalogStatus } from '../features/catalog/catalogStore.ts'
import { CUSTOMER_STATUS_LABEL } from '../features/tracking/timeline.ts'
import { getAddMode, getCustomerSession, useCustomerAccount } from '../features/tracking/trackingRuntime.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { type CustomerHistoryOrder, listCustomerHistory } from '../services/customerHistory.ts'
import type { CustomerSession } from '../services/customerSession.ts'
import { formatBRL } from '../utils/money.ts'

const card = 'rounded-3xl bg-white p-5 shadow-card ring-1 ring-line sm:p-7'
const button = 'inline-flex min-h-11 items-center justify-center rounded-full bg-acai-800 px-5 text-sm font-bold text-white hover:bg-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:opacity-60'
const linkButton = 'inline-flex min-h-11 items-center text-sm font-bold text-acai-800 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'
const field = 'mt-1 min-h-12 w-full rounded-xl bg-white px-3 text-base text-acai-950 ring-1 ring-line outline-none focus:ring-2 focus:ring-acai-700'
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function CustomerAccountPage() {
  usePageTitle('Minha conta', { noindex: true })
  const account = useCustomerAccount()
  const session = getCustomerSession()
  const fromCart = useLocation().state?.from === 'cart'
  const navigate = useNavigate()
  return (
    <>
      <div className="bg-brand text-white">
        <Container className="pt-6 pb-10 sm:pt-8">
          <Link to={fromCart ? paths.cart : paths.track()} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orchid-400">
            <ArrowLeft className="size-4" /> {fromCart ? 'Voltar ao carrinho' : 'Voltar aos pedidos'}
          </Link>
          <h1 className="font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">Minha conta</h1>
        </Container>
      </div>
      <Container className="py-8">
        <div className="mx-auto max-w-xl">
          {!session ? <p className={card}>As contas de cliente estão indisponíveis nesta demonstração.</p> : account ? (
            <AccountOrders key={account} account={account} session={session} />
          ) : (
            <AccountForm session={session} onSuccess={() => { if (fromCart) void navigate(paths.cart, { replace: true }) }} />
          )}
        </div>
      </Container>
    </>
  )
}

function AccountForm({ session, onSuccess }: { session: CustomerSession; onSuccess(): void }) {
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const identifier = String(data.get('identifier') ?? '').trim()
    const password = String(data.get('password') ?? '')
    setBusy(true)
    setError('')
    try {
      if (register) await session.signUp(identifier, password)
      else await session.signIn(identifier, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confira seus dados e tente de novo.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={card}>
      <h2 className="font-display text-2xl font-black text-acai-800">{register ? 'Criar conta' : 'Entrar'}</h2>
      <p className="mt-1 text-sm text-ink-soft">Salve seu endereço e peça de novo os itens dos seus últimos pedidos.</p>
      <form key={String(register)} onSubmit={submit} className="mt-5 grid gap-4">
        <label className="text-sm font-bold text-acai-950">
          Nome, usuário ou telefone
          <input name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} required className={field} aria-describedby={register ? 'identifier-hint' : undefined} />
        </label>
        {register && <p id="identifier-hint" className="-mt-2 text-xs text-ink-soft">Use seu nome ou usuário de 3 a 60 caracteres, ou um telefone com DDD.</p>}
        <label className="text-sm font-bold text-acai-950">
          Senha
          <input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : undefined} className={field} aria-describedby={register ? 'password-hint' : undefined} />
        </label>
        {register && <p id="password-hint" className="-mt-2 text-xs text-ink-soft">Use pelo menos 8 caracteres.</p>}
        {error && <p role="alert" className="text-sm font-semibold text-red-800">{error}</p>}
        <button className={button} disabled={busy}>{busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar'}</button>
      </form>
      <button type="button" className={linkButton} disabled={busy} onClick={() => { setRegister(!register); setError('') }}>
        {register ? 'Já tenho conta' : 'Criar uma conta'}
      </button>
    </section>
  )
}

function AccountOrders({ account, session }: { account: string; session: CustomerSession }) {
  const [orders, setOrders] = useState<CustomerHistoryOrder[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [leaving, setLeaving] = useState(false)
  const catalog = useCatalogStatus()
  const navigate = useNavigate()
  useEffect(() => {
    let current = true
    listCustomerHistory().then(
      rows => { if (current) setOrders(rows) },
      () => { if (current) setLoadError(true) },
    )
    return () => { current = false }
  }, [attempt])

  function repeat(order: CustomerHistoryOrder) {
    if (session.account() !== account) return
    const result = cartActions.repeat(order.carts)
    if (result.full) {
      setNotice('Falta espaço no carrinho para este pedido. Remova alguns itens antes de repetir.')
      return
    }
    if (!result.quantity) {
      setNotice('Os itens deste pedido não estão disponíveis com as mesmas escolhas no cardápio de hoje.')
      return
    }
    getAddMode().stop()
    const incomplete = result.skipped || result.quantity < order.items.reduce((sum, item) => sum + item.quantity, 0)
    void navigate(paths.cart, { state: { reorderNotice: incomplete
      ? 'Adicionamos os itens disponíveis. Alguns itens ou escolhas do pedido antigo ficaram de fora.'
      : 'Itens do pedido adicionados. Confira as quantidades e os preços atuais.' } })
  }

  async function signOut() {
    setLeaving(true)
    try {
      await session.signOut()
    } catch {
      setLeaving(false)
      setNotice('Não foi possível sair da conta. Tente de novo.')
    }
  }

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
        <p className="break-all text-sm font-semibold text-ink-soft">{account}</p>
        <button type="button" className={linkButton} disabled={leaving} onClick={() => void signOut()}>Sair da conta</button>
      </div>
      <h2 className="mt-5 font-display text-2xl font-black text-acai-800">Últimos Pedidos</h2>
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-acai-800">{notice}</p>}
      {loadError ? (
        <div role="alert" className="mt-3 text-sm text-red-800">
          <p>Não foi possível carregar seus pedidos.</p>
          <button type="button" className={linkButton} onClick={() => { setLoadError(false); setAttempt(value => value + 1) }}>Tentar de novo</button>
        </div>
      ) : orders === null ? <p role="status" className="mt-3 text-ink-soft">Carregando pedidos…</p> : orders.length === 0 ? (
        <div className="mt-3 text-sm text-ink-soft">
          <p>Os pedidos que você fizer com esta conta aparecem aqui.</p>
          <Link className={linkButton} to={paths.buildOrder}>Ver o cardápio</Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map(order => (
            <li key={order.id} className="space-y-2 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-display text-lg font-extrabold text-acai-800">Pedido #{order.code}</h3>
                <span className="nums font-bold text-acai-950">{formatBRL(order.totalCents)}</span>
              </div>
              <p className="text-sm text-ink-soft">{date.format(new Date(order.createdAt))} · {CUSTOMER_STATUS_LABEL[order.status]}</p>
              <ul className="text-sm text-acai-950">{order.items.map((item, index) => <li key={index}>{item.quantity} × {item.name}</li>)}</ul>
              {order.carts.length > 0 ? (
                <button type="button" className={button} disabled={catalog.state !== 'ready'} onClick={() => repeat(order)}>Refazer pedido anterior</button>
              ) : <p className="text-xs text-ink-soft">As escolhas deste pedido antigo não estão disponíveis para repetir.</p>}
            </li>
          ))}
        </ul>
      )}
      {orders?.length && catalog.state !== 'ready' ? (
        <p className="text-sm text-ink-soft">{catalog.state === 'loading' ? 'Carregando o cardápio para repetir pedidos…' : 'O cardápio está indisponível para repetir pedidos agora.'}</p>
      ) : null}
    </section>
  )
}
