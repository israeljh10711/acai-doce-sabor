import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Close } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'
import type { AddedNotice } from './ordersLive.ts'
import { requestOrderFocus } from './orderFocus.ts'
import { getOrdersLive, useOrders } from './ordersRuntime.ts'

/** Quanto tempo cada aviso fica na tela. */
const NOTICE_MS = 9000

/**
 * Avisos de itens acrescentados pelo cliente (2026-11-20): "🔔 Novos itens adicionados ao pedido
 * ADS-0003", no alto da tela, em qualquer página enquanto o vendedor estiver no Modo Vendedor (fica
 * na faixa do vendedor, que só aparece para ele). Cada aviso some sozinho em 9 s, fecha no ✕ e não
 * apaga os outros; "Ver pedido" abre o painel no cartão. Não bloqueia a página.
 */
export function AddedItemsNotices() {
  const { notices } = useOrders()
  return (
    <div
      data-added-notices=""
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-40 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:w-96"
    >
      <AnimatePresence initial={false}>
        {notices.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function NoticeCard({ notice }: { notice: AddedNotice }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    const timer = window.setTimeout(() => getOrdersLive().dismissNotice(notice.id), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice.id])

  const show = () => {
    getOrdersLive().dismissNotice(notice.id)
    requestOrderFocus(notice.code)
    if (pathname !== paths.orders) void navigate(paths.orders)
  }

  return (
    <m.div
      layout
      data-added-notice={notice.code}
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
      className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-acai-950 py-2.5 pr-2 pl-4 text-sm text-white shadow-lift ring-2 ring-gold-400"
    >
      <p className="min-w-0 flex-1 py-1 leading-snug">
        <span className="block font-extrabold">
          🔔 Novos itens adicionados ao pedido <span className="nums text-gold-300">{notice.code}</span>
        </span>
        <span className="block text-white/85">{notice.batches > 1 ? `${notice.batches} acréscimos do cliente.` : 'O cliente acrescentou ao mesmo pedido.'}</span>
      </p>
      <button
        type="button"
        data-added-notice-open=""
        onClick={show}
        className="btn-gold inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full px-3 text-xs font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Ver pedido
      </button>
      <button
        type="button"
        data-added-notice-close=""
        aria-label={`Fechar o aviso do pedido ${notice.code}`}
        onClick={() => getOrdersLive().dismissNotice(notice.id)}
        className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-white/85 hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <Close className="size-4" />
      </button>
    </m.div>
  )
}
