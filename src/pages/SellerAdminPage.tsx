import { type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { LockOpen } from '../components/ui/icons.tsx'
import { useAdminCatalog } from '../features/admin/adminData.ts'
import { CatalogOverview } from '../features/admin/CatalogOverview.tsx'
import { CategoriesPanel } from '../features/admin/CategoriesPanel.tsx'
import { ComplementsPanel } from '../features/admin/ComplementsPanel.tsx'
import { OffersPanel } from '../features/admin/OffersPanel.tsx'
import { ProductsPanel } from '../features/admin/ProductsPanel.tsx'
import { StoreSettingsPanel } from '../features/admin/StoreSettingsPanel.tsx'
import { useSellerMode } from '../features/seller/sellerModeContext.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { ADMIN_TABS, type AdminTab, paths } from '../paths.ts'

const TAB_LABELS: Readonly<Record<AdminTab, string>> = {
  catalogo: 'Catálogo',
  categorias: 'Categorias',
  produtos: 'Produtos',
  complementos: 'Complementos',
  ofertas: 'Ofertas',
  loja: 'Configurações da loja',
}

/**
 * Painel do vendedor (cardápio dinâmico, 2026-11-21): o cardápio inteiro e as configurações da
 * loja, gravados no banco. Só com o Modo Vendedor ligado.
 */
export function SellerAdminPage() {
  const seller = useSellerMode()
  const [params] = useSearchParams()
  const raw = params.get('aba')
  const tab: AdminTab = (ADMIN_TABS as readonly string[]).includes(raw ?? '') ? (raw as AdminTab) : 'catalogo'
  usePageTitle(`${TAB_LABELS[tab]} · Painel do vendedor`, { noindex: true })

  if (!seller.active) {
    return (
      <Shell tab={tab}>
        <div data-admin-login className="mx-auto max-w-xl rounded-3xl bg-acai-50 p-6 text-acai-950 ring-1 ring-line">
          <h2 className="font-display text-xl font-extrabold text-acai-800">Esta página é do Modo Vendedor</h2>
          <p className="mt-2 leading-relaxed">Entre com a senha do vendedor para mudar o cardápio e as configurações da loja.</p>
          <button
            type="button"
            onClick={seller.openAuth}
            className="btn-primary mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <LockOpen className="size-5" />
            Entrar no Modo Vendedor
          </button>
        </div>
      </Shell>
    )
  }
  return (
    <Shell tab={tab}>
      <Content tab={tab} />
    </Shell>
  )
}

function Content({ tab }: { tab: AdminTab }) {
  const catalog = useAdminCatalog()
  if (tab === 'loja') return <StoreSettingsPanel />
  if (catalog.state === 'loading') {
    return (
      <p role="status" data-admin-loading className="text-center text-base font-semibold text-ink-soft motion-safe:animate-pulse">
        Carregando o cardápio…
      </p>
    )
  }
  if (catalog.state === 'error') {
    return (
      <div role="alert" data-admin-error className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center ring-1 ring-line">
        <p className="font-semibold text-acai-900">Não foi possível carregar o cardápio.</p>
        <button type="button" onClick={catalog.reload} className="btn-primary mt-4 inline-flex min-h-12 cursor-pointer items-center rounded-xl px-5 font-extrabold">
          Tentar de novo
        </button>
      </div>
    )
  }
  const { records } = catalog
  switch (tab) {
    case 'categorias':
      return <CategoriesPanel records={records} />
    case 'produtos':
      return <ProductsPanel records={records} />
    case 'complementos':
      return <ComplementsPanel records={records} />
    case 'ofertas':
      return <OffersPanel records={records} />
    default:
      return <CatalogOverview records={records} />
  }
}

function Shell({ tab, children }: { tab: AdminTab; children: ReactNode }) {
  const linkClass = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-xl px-3.5 text-sm font-bold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orchid-400 ${
      active ? 'bg-orchid-400 text-acai-950' : 'text-white ring-1 ring-white/30 hover:bg-white/10'
    }`
  return (
    <>
      <div className="bg-brand text-white">
        <Container className="pt-6 pb-6 sm:pt-8">
          <h1 className="font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">Painel do vendedor</h1>
          <p className="mt-1 text-base text-white/85">Cardápio, ofertas e configurações da loja. O que você salva aqui vale na hora para os clientes.</p>
          <nav aria-label="Seções do painel" className="-mx-4 mt-5 overflow-x-auto px-4 pb-1">
            <ul className="flex gap-2">
              <li>
                <Link to={paths.orders} className={linkClass(false)}>
                  Pedidos
                </Link>
              </li>
              {ADMIN_TABS.map((entry) => (
                <li key={entry}>
                  <Link to={paths.admin(entry)} data-admin-tab={entry} aria-current={entry === tab ? 'page' : undefined} className={linkClass(entry === tab)}>
                    {TAB_LABELS[entry]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
      <Container className="py-6 sm:py-8">{children}</Container>
    </>
  )
}
