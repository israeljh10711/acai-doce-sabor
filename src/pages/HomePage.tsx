import { Link } from 'react-router'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { storeInfo } from '../services/storeInfo.ts'

export function HomePage() {
  usePageTitle()

  return (
    <>
      <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
        {storeInfo.name}
      </h1>
      <p className="mt-3 max-w-prose text-lg text-brand-950/80">
        Açaí e milk-shake montados do seu jeito, em {storeInfo.address.city},{' '}
        {storeInfo.address.state}.
      </p>

      <Link
        to={paths.buildOrder}
        className="mt-6 inline-flex min-h-12 items-center rounded-full bg-accent-600 px-6 font-semibold text-white transition-colors hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
      >
        Montar meu pedido
      </Link>

      <p
        role="note"
        className="mt-10 max-w-prose rounded-xl border border-brand-900/15 bg-white px-4 py-3 text-sm text-brand-950/80"
      >
        Site em construção. A personalização dos produtos e o carrinho ainda não estão
        disponíveis.
      </p>
    </>
  )
}
