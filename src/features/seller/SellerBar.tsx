import { soundAlert } from '../orders/orderAlert.ts'
import { AddedItemsNotices } from '../orders/AddedItemsNotices.tsx'
import { useOrdersConnection, useSoundState } from '../orders/ordersRuntime.ts'

/**
 * Parte do Modo Vendedor que fica ligada em toda página (carrega só com o modo ligado).
 *
 * Até 2026-11-22 isto era uma faixa roxa enorme com os botões todos empilhados no topo. Desde
 * 2026-11-23 os botões moram no painel (`/painel`), aberto pela aba "Painel" do topo, e a faixa
 * some. O que continua aqui é o que precisa rodar em qualquer página:
 * - a escuta dos pedidos (liga com o modo vendedor e para ao sair), que alimenta o selo da aba
 *   "Painel" e o painel de pedidos;
 * - o aviso fino de som bloqueado (o navegador só toca depois de um toque na página);
 * - os avisos de itens acrescentados pelo cliente (2026-11-20).
 *
 * O marcador `data-seller-bar` fica no invólucro: as conferências o usam como "Modo Vendedor
 * ligado". Sem aviso na tela, ele não ocupa espaço.
 */
export function SellerBar() {
  useOrdersConnection()
  const sound = useSoundState()

  return (
    <div data-seller-bar="">
      {/*
        Som bloqueado (2026-11-21): o navegador só toca depois de um toque na página. Em qualquer
        página do Modo Vendedor, o aviso diz isso e oferece o toque. Silenciado de propósito: nada.
      */}
      {(sound === 'blocked' || sound === 'unsupported') && (
        <div data-orders-sound-hint={sound} role="status" className="border-b border-orchid-400 bg-orchid-100 text-acai-950">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-1.5 text-xs sm:px-6 sm:text-sm">
            <p className="min-w-0 font-semibold">
              {sound === 'blocked'
                ? '🔇 Som dos avisos bloqueado pelo navegador. Toque em “Ativar som” (ou em qualquer lugar da página) para ouvir os pedidos novos e os itens acrescentados.'
                : '🔇 Este navegador não toca os avisos sonoros. Fique de olho no selo da aba “Painel”.'}
            </p>
            {sound === 'blocked' && (
              <button
                type="button"
                data-sound-unlock=""
                onClick={() => soundAlert.unlock()}
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-lg bg-acai-800 px-3 text-xs font-extrabold text-white transition hover:bg-acai-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
              >
                🔔 Ativar som
              </button>
            )}
          </div>
        </div>
      )}
      <AddedItemsNotices />
    </div>
  )
}
