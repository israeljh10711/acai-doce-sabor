import { useStoreStatus } from './useStoreStatus.ts'

/**
 * Selo discreto do cabeçalho, em todas as páginas (pedido de 2026-11-17): "Aberto agora • Entrega:
 * 30–45 min" ou "Loja fechada no momento". A bolinha verde ou vermelha substitui os emojis pedidos
 * (🟢 / 🔴), como no selo da página inicial. `strip`: a linha fina abaixo do cabeçalho, no celular,
 * onde ao lado da logo não cabe.
 */
export function StoreHeaderBadge({ strip = false, className = '' }: { strip?: boolean; className?: string }) {
  const status = useStoreStatus()
  const dot = (
    <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ring-2 ring-white/25 ${status.open ? 'bg-emerald-400' : 'bg-red-500'}`} />
  )
  const text = status.open ? (
    <span className="min-w-0">
      <span className="font-bold">Aberto agora</span>
      <span aria-hidden="true" className="mx-1.5 text-white/60">
        •
      </span>
      <span className="sr-only">, </span>
      <span className="nums">{status.detail}</span>
    </span>
  ) : (
    <span className="min-w-0 font-bold">Loja fechada no momento</span>
  )

  if (strip) {
    return (
      <p data-store-badge="strip" className={`flex items-center justify-center gap-2 border-t border-white/10 bg-acai-950/40 px-4 py-1.5 text-xs text-white/90 ${className}`}>
        {dot}
        {text}
      </p>
    )
  }
  return (
    <p data-store-badge="" className={`items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/90 ring-1 ring-white/20 ${className}`}>
      {dot}
      {text}
    </p>
  )
}
