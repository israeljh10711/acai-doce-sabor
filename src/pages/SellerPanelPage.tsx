import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { ArrowRight, Clock, ClipboardList, Download, Lock, LockOpen, Scooter } from '../components/ui/icons.tsx'
import { useOrders } from '../features/orders/ordersRuntime.ts'
import { useSellerMode } from '../features/seller/sellerModeContext.ts'
import { BackupRestore, ChangePassword } from '../features/seller/SellerDialogs.tsx'
import { DeliveryTimeButton, StoreSwitch } from '../features/seller/StoreControls.tsx'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'

const rowClass =
  'group flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 hover:bg-acai-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Painel do Modo Vendedor (2026-11-23), aberto pela aba "Painel" do topo. Reúne num lugar só o que
 * antes ficava empilhado numa faixa roxa em toda página: operação, loja e cardápio, segurança e
 * sessão. Tela de trabalho: clara, sem enfeites, cada função num bloco.
 */
export function SellerPanelPage() {
  const seller = useSellerMode()
  usePageTitle('Painel do vendedor', { noindex: true })

  if (!seller.active) {
    return (
      <Container className="py-10 sm:py-14">
        <div data-panel-login="" className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-acai-950 ring-1 ring-line sm:p-8">
          <h1 className="font-display text-2xl font-extrabold text-acai-800">Esta página é do Modo Vendedor</h1>
          <p className="mt-2 leading-relaxed text-ink-soft">Entre com a senha do vendedor para abrir o painel.</p>
          <button
            type="button"
            onClick={seller.openAuth}
            className="btn-primary mt-5 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <LockOpen className="size-5" />
            Entrar no Modo Vendedor
          </button>
        </div>
      </Container>
    )
  }
  return <Panel />
}

function Panel() {
  const seller = useSellerMode()
  const { newCount } = useOrders()
  const [open, setOpen] = useState<'password' | 'backup' | null>(null)
  const cloud = seller.backendKind === 'supabase'

  return (
    <Container className="py-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-acai-800 sm:text-4xl">Painel do vendedor</h1>
        <p data-panel-active="" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2 rounded-full bg-orchid-100 px-3 py-1 font-semibold text-acai-800">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-600" />
            Modo Vendedor ativo
          </span>
          <span className="font-semibold text-acai-800">
            {cloud ? 'Salvo na nuvem: vale para todos os clientes.' : 'Salvo só neste aparelho: os clientes ainda não veem.'}
          </span>
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Block id="operacao" title="Operação" hint="O que muda durante o dia.">
          <li>
            <Link
              to={paths.orders}
              data-orders-link=""
              aria-label={newCount > 0 ? `Pedidos (${newCount} ${newCount === 1 ? 'novo' : 'novos'})` : 'Pedidos'}
              className="btn-primary flex min-h-14 items-center gap-3 rounded-xl px-4 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              <ClipboardList className="size-5 shrink-0" />
              <span className="flex-1">Pedidos</span>
              {newCount > 0 && (
                <span data-panel-orders-badge={newCount} className="nums min-w-6 rounded-full bg-white px-2 text-center text-sm leading-6 font-black text-orchid-700">
                  {newCount}
                </span>
              )}
              <ArrowRight className="size-5 shrink-0" />
            </Link>
          </li>
          <li className="px-3 py-2">
            <StoreSwitch tone="light" />
          </li>
          <li className="px-1">
            <DeliveryTimeButton tone="light" />
          </li>
        </Block>

        <Block id="loja" title="Loja e cardápio" hint="Preços, fotos, ofertas, entrega e horário.">
          <li>
            <Link to={paths.admin()} data-admin-link="" className={rowClass}>
              <Row title="Cardápio" hint="Categorias, produtos, complementos e ofertas." />
            </Link>
          </li>
          <li>
            {/* Aqui ficam os botões rápidos de "Editar" e "Disponível / Esgotado" em cada item. */}
            <Link to={paths.buildOrder} data-panel-menu-link="" className={rowClass}>
              <Row title="Ver o cardápio da loja" hint="Edite ou esgote um item com um toque." />
            </Link>
          </li>
          <li>
            <Link to={`${paths.admin('loja')}#loja-entrega`} data-delivery-settings="" className={rowClass}>
              <Scooter className="size-5 shrink-0 text-acai-700" />
              <Row title="Entrega / Frete" hint="Bairros e taxas." />
            </Link>
          </li>
          <li>
            <Link to={`${paths.admin('loja')}#loja-horario`} data-hours-contact="" className={rowClass}>
              <Clock className="size-5 shrink-0 text-acai-700" />
              <Row title="Horários e Contato" hint="Horário por dia, telefone e endereço." />
            </Link>
          </li>
        </Block>

        <Block id="sessao" title="Segurança e sessão" hint="Senha, cópia de segurança e saída.">
          <li>
            <button type="button" data-panel-password="" className={`${rowClass} w-full cursor-pointer`} onClick={() => setOpen('password')}>
              <Lock className="size-5 shrink-0 text-acai-700" />
              <Row title="Alterar senha" hint="Troque a senha do vendedor." />
            </button>
          </li>
          <li>
            <button type="button" data-panel-backup="" className={`${rowClass} w-full cursor-pointer`} onClick={() => setOpen('backup')}>
              <Download className="size-5 shrink-0 text-acai-700" />
              <Row title="Backup / Restaurar" hint="Baixe ou restaure as configurações." />
            </button>
          </li>
          <li className="pt-2">
            <button
              type="button"
              data-panel-signout=""
              onClick={() => void seller.signOut()}
              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-bold text-red-700 ring-1 ring-red-200 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              Sair do Modo Vendedor
            </button>
          </li>
        </Block>
      </div>

      {open === 'password' && <ChangePassword onClose={() => setOpen(null)} />}
      {open === 'backup' && <BackupRestore onClose={() => setOpen(null)} />}
    </Container>
  )
}

function Block({ id, title, hint, children }: { id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`painel-${id}`} data-panel-block={id} className="rounded-3xl bg-white p-4 shadow-card ring-1 ring-line sm:p-5">
      <h2 id={`painel-${id}`} className="font-display text-xl font-extrabold text-acai-800">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>
      <ul className="mt-3 flex flex-col gap-1">{children}</ul>
    </section>
  )
}

function Row({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-acai-900">{title}</span>
        <span className="block text-sm text-ink-soft">{hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-acai-600 transition-transform duration-150 group-hover:translate-x-0.5" />
    </>
  )
}
