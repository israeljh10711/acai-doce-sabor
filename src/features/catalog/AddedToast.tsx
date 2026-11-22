import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Check, Close } from '../../components/ui/icons.tsx'
import { paths } from '../../paths.ts'

export type AddedNotice = { name: string; key: number }

/**
 * Aviso de item adicionado ("Adicionar e continuar comprando"), fixo embaixo da tela para
 * aparecer em qualquer ponto do cardápio, com atalho para o carrinho. Some sozinho depois de
 * 6 segundos. A região de anúncio fica sempre na página, para o leitor de tela ler o aviso.
 */
export function AddedToast({ notice, onDismiss }: { notice: AddedNotice | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(timer)
  }, [notice, onDismiss])

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <m.div
            key={notice.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            // Celular: aviso e fechar na primeira linha, "Ver carrinho" embaixo. Telas maiores: uma linha só.
            className="pointer-events-auto grid w-full max-w-md grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl bg-acai-950 py-2 pr-2 pl-4 text-sm text-white shadow-lift sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
          >
            <Check className="row-span-2 size-5 self-start text-orchid-400 max-sm:mt-2.5 sm:row-span-1 sm:self-center" />
            <span className="col-start-2 row-start-1 min-w-0 py-1 leading-snug">
              <span className="block font-extrabold">Adicionado ao carrinho</span>
              <span className="line-clamp-2 font-medium text-white/85">{notice.name}</span>
            </span>
            <Link
              to={paths.cart}
              className="col-start-2 row-start-2 -ml-3 inline-flex min-h-11 items-center gap-1 justify-self-start rounded-full px-3 font-extrabold text-orchid-400 transition hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-orchid-400 sm:col-start-3 sm:row-start-1 sm:ml-0"
            >
              Ver carrinho
              <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={onDismiss}
              className="col-start-3 row-start-1 grid size-11 cursor-pointer place-items-center rounded-full transition hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-orchid-400 sm:col-start-4"
            >
              <Close className="size-4" />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
