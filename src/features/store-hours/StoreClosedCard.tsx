import { useId } from 'react'
import { Chat, Moon, Pin } from '../../components/ui/icons.tsx'
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import { mapsUrl, storeAddressText } from '../store/storeSettings.ts'
import { useStoreStatus } from './useStoreStatus.ts'

/**
 * Aviso acolhedor de loja fechada (pedido de 2026-11-17), no início, no cardápio e no carrinho,
 * sempre que a loja estiver fechada (pelo interruptor do vendedor ou pelo horário): o convite para
 * voltar quando abre, o endereço clicável e o WhatsApp da loja. Some sozinho quando a loja abre.
 */
export function StoreClosedCard({ heading = 'h2', compact = false, className = '' }: { heading?: 'h2' | 'h3'; compact?: boolean; className?: string }) {
  const status = useStoreStatus()
  const settings = useStoreSettings()
  const titleId = useId()
  if (status.open) return null

  const Heading = heading
  const address = storeAddressText(settings.contact)
  const link =
    'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

  return (
    <section
      data-store-closed=""
      aria-labelledby={titleId}
      className={`rounded-3xl bg-acai-50 ring-1 ring-line ${compact ? 'p-4' : 'p-5 sm:p-6'} ${className}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-acai-800 text-orchid-400 ${compact ? 'size-10' : 'size-12'}`}>
          <Moon className={compact ? 'size-5' : 'size-6'} />
        </span>
        <div className="min-w-0">
          <Heading id={titleId} className={`font-display font-black tracking-tight text-acai-800 uppercase ${compact ? 'text-lg' : 'text-xl sm:text-2xl'}`}>
            Estamos fechados agora
          </Heading>
          <p className="mt-1 leading-relaxed text-acai-950">
            Obrigado pela visita! Volte <strong className="font-bold">{status.reopenText}</strong> para pedir o seu açaí.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {settings.closedOrders === 'antecipado'
              ? 'Se quiser, já pode montar o pedido e enviar como pedido antecipado: ele é preparado assim que abrirmos.'
              : 'Os pedidos pelo site voltam assim que abrirmos.'}
          </p>
        </div>
      </div>
      <div className={`mt-4 flex flex-wrap gap-2 ${compact ? '' : 'sm:pl-16'}`}>
        <a href={mapsUrl(address)} target="_blank" rel="noreferrer" className={`${link} bg-white text-acai-800 ring-1 ring-acai-800/25 hover:bg-acai-100`}>
          <Pin className="size-4" />
          {address}
          <span className="sr-only"> (abre o mapa em nova aba)</span>
        </a>
        <a href={buildWhatsAppUrl(settings.contact.whatsapp)} target="_blank" rel="noreferrer" className={`${link} btn-primary`}>
          <Chat className="size-4" />
          <span className="nums">WhatsApp {settings.contact.whatsapp}</span>
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </div>
    </section>
  )
}
