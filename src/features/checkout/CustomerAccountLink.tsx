import { Link } from 'react-router'
import { paths } from '../../paths.ts'
import { getCustomerSession, useCustomerAccount } from '../tracking/trackingRuntime.ts'

export function CustomerAccountLink({ from }: { from: 'cart' | 'tracking' }) {
  const account = useCustomerAccount()
  if (!getCustomerSession()) return null
  return (
    <Link
      to={paths.account}
      state={{ from }}
      className="mt-3 inline-flex min-h-11 items-center rounded-full border border-white/60 px-4 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {account ? 'Minha conta e últimos pedidos' : 'Entrar ou criar conta'}
    </Link>
  )
}
