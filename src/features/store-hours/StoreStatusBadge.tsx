import { useStoreStatus } from './useStoreStatus.ts'

/**
 * Selo de funcionamento pelo horário de Brasília: "ABERTO AGORA • Entrega rápida em Teixeira"
 * ou "FECHADO AGORA • Abrimos hoje às 13h". A bolinha verde ou vermelha substitui os emojis
 * pedidos (🟢 / 🔴), que mudam de aparência em cada aparelho; o texto continua o mesmo.
 * Muda sozinho na hora de abrir e de fechar, e é anunciado por leitores de tela.
 */
export function StoreStatusBadge({ className = '' }: { className?: string }) {
  const status = useStoreStatus()

  return (
    <p
      role="status"
      data-open={status.open}
      className={`inline-flex max-w-full items-center gap-2.5 rounded-full bg-white/10 py-1.5 pr-4 pl-3 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm ${className}`}
    >
      <span aria-hidden="true" className="relative grid size-3 shrink-0 place-items-center">
        {status.open && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />}
        <span className={`relative size-3 rounded-full ring-2 ring-white/30 ${status.open ? 'bg-emerald-400' : 'bg-red-500'}`} />
      </span>
      <span className="min-w-0">
        <span className="font-extrabold tracking-wide">{status.title}</span>
        <span aria-hidden="true" className="mx-1.5 text-white/60">
          •
        </span>
        <span className="sr-only">, </span>
        <span className="text-white/90">{status.detail}</span>
      </span>
    </p>
  )
}
