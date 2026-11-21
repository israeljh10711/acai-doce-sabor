import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Check, Copy } from '../../components/ui/icons.tsx'
import { storeInfo } from '../../services/storeInfo.ts'
import { copyText } from './copyText.ts'

/** A orientação de sempre no carrinho. */
export const PIX_INSTRUCTION = 'Faça o Pix e guarde o comprovante. Se a loja pedir, envie pelo botão de dúvidas no WhatsApp, na tela do pedido.'

/**
 * Chave Pix da loja, com o botão de copiar: a mesma no carrinho (antes de finalizar) e no
 * acompanhamento do pedido (2026-11-21), para as duas nunca mostrarem chaves diferentes.
 * `children`: o valor a pagar, no topo (o acompanhamento mostra; o carrinho já tem o total ao lado).
 */
export function PixCard({ children, instruction = PIX_INSTRUCTION }: { children?: ReactNode; instruction?: string }) {
  const { key, type, holder } = storeInfo.pix
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    const copied = await copyText(key)
    setState(copied ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    if (copied) timer.current = window.setTimeout(() => setState('idle'), 2500)
  }

  return (
    <div data-pix-card="" className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
      {children}
      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Chave Pix ({type})</p>
      <p className="nums mt-1 text-2xl font-extrabold tracking-tight break-all text-acai-800 select-all">{key}</p>
      <p className="mt-0.5 text-sm text-ink-soft">Titular: {holder}</p>
      <button
        type="button"
        data-pix-copy=""
        onClick={copy}
        className="mt-3 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-acai-800 px-4 text-sm font-bold text-white transition hover:bg-acai-700 active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
      >
        {state === 'copied' ? <Check className="size-5 text-gold-400" /> : <Copy className="size-5" />}
        {state === 'copied' ? 'Chave Pix copiada!' : 'Copiar chave Pix'}
      </button>
      <p role="status" className="text-sm font-semibold text-acai-950">
        {state === 'copied' && <span className="sr-only">Chave Pix copiada.</span>}
        {state === 'failed' && (
          <span className="mt-2 block">Não deu para copiar aqui. Toque e segure a chave acima para copiar.</span>
        )}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-acai-950">{instruction}</p>
    </div>
  )
}
