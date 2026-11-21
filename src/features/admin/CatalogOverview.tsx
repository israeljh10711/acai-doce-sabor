import { Link } from 'react-router'
import { paths } from '../../paths.ts'
import { useNow } from './adminData.ts'
import type { CatalogRecords } from '../catalog/records.ts'
import { offerState } from '../catalog/recordsAdapter.ts'

/** Resumo do cardápio: quantos de cada, o que está oculto ou esgotado e o atalho para cada aba. */
export function CatalogOverview({ records }: { records: CatalogRecords }) {
  const now = useNow()
  const products = records.products.filter((product) => product.archivedAt === null)
  const categories = records.categories.filter((category) => category.archivedAt === null)
  const options = records.options.filter((option) => option.archivedAt === null)
  const cards = [
    { tab: 'categorias' as const, title: 'Categorias', value: categories.length, detail: `${categories.filter((category) => !category.visible).length} ocultas` },
    {
      tab: 'produtos' as const,
      title: 'Produtos',
      value: products.length,
      detail: `${products.filter((product) => !product.visible).length} ocultos · ${products.filter((product) => !product.available).length} esgotados`,
    },
    { tab: 'complementos' as const, title: 'Complementos', value: options.length, detail: `${records.groups.length} grupos · ${options.filter((option) => !option.available).length} esgotados` },
    {
      tab: 'ofertas' as const,
      title: 'Ofertas',
      value: records.offers.filter((offer) => offerState(offer, now) === 'ativa').length,
      detail: `ativas agora · ${records.offers.filter((offer) => offer.status !== 'arquivada').length} no total`,
    },
  ]
  return (
    <div data-admin-overview className="flex flex-col gap-6">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.tab}>
            <Link
              to={paths.admin(card.tab)}
              className="flex h-full flex-col rounded-3xl bg-white p-5 ring-1 ring-line transition hover:ring-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              <span className="text-sm font-bold text-ink-soft">{card.title}</span>
              <span className="nums mt-1 font-display text-4xl font-black text-acai-800">{card.value}</span>
              <span className="mt-1 text-sm text-ink-soft">{card.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="rounded-3xl bg-acai-50 p-5 text-sm leading-relaxed text-acai-950 ring-1 ring-line">
        <p className="font-bold text-acai-800">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Tudo o que você salva aqui vai para o banco e aparece para os clientes em poucos segundos.</li>
          <li>"Ocultar" tira da loja sem apagar; "Esgotado" mostra o item desligado; "Arquivar" guarda o item fora das listas.</li>
          <li>O preço que vale no pedido é sempre o do banco: o servidor confere antes de registrar.</li>
        </ul>
        <p className="mt-3">
          <Link to={paths.buildOrder} className="font-bold text-acai-800 underline underline-offset-2">
            Ver a loja como o cliente vê
          </Link>
        </p>
      </div>
    </div>
  )
}
